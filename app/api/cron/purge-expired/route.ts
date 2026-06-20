import { type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { log } from '@/lib/logger';

// Story 1.9 (AC8) — Purge dure quotidienne des comptes soft-deleted depuis >7j.
// Protégé par Authorization: Bearer ${CRON_SECRET} (AR39, Vercel-injected).
// auth.admin.deleteUser(id) supprime auth.users → cascade FK hard-delete
// users/profiles/admission_requests/notifications_prefs + SET NULL sur
// moderation_log.actor_id (la trace user_deleted ET purge_completed deviennent
// anonymes). NFR18 (purge dure J+7) / NFR55 (logs).
//
// Story 4.5 (FR28) — étend ce cron : soft-delete des alertes & bons plans expirés
// (expires_at < now, deleted_at IS NULL). deleted_by reste NULL (acteur système :
// pas de JWT → auth.uid() NULL dans le trigger enforce_deleted_by_actor),
// deletion_reason='auto_expiration'. Trace moderation_log `content_expired` par
// item (visible en audit, masqué du feed). NFR55 (logs structurés avec compteurs).
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type Admin = ReturnType<typeof createAdminClient>;

// Soft-delete atomique des items expirés d'une table éphémère + trace d'audit.
// L'UPDATE ... WHERE deleted_at IS NULL ... RETURNING évite la race SELECT→UPDATE
// et ne loggue QUE les lignes réellement transitionnées (pas d'orphelins log).
async function expireEphemeral(
  admin: Admin,
  table: 'alerts' | 'tips',
  targetKind: 'alert' | 'tip',
  logEvent: 'alerts.auto_expired' | 'tips.auto_expired',
): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data: deleted, error } = await admin
    .from(table)
    .update({ deleted_at: nowIso, deletion_reason: 'auto_expiration' })
    .is('deleted_at', null)
    .lt('expires_at', nowIso)
    .select('id, residence_id');

  if (error) {
    log({
      level: 'error',
      event: 'cron.expire_update_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { table, errorCode: error.code ?? 'unknown' },
    });
    return 0;
  }

  const rows = deleted ?? [];
  if (rows.length > 0) {
    const { error: logErr } = await admin.from('moderation_log').insert(
      rows.map((r) => ({
        residence_id: r.residence_id,
        actor_id: null,
        action: 'content_expired' as const,
        target_kind: targetKind,
        target_id: r.id,
        reason_text_anonymized: 'auto_expiration',
      })),
    );
    if (logErr) {
      log({
        level: 'error',
        event: 'cron.expire_log_failed',
        user_id: null,
        residence_id: null,
        request_id: null,
        payload: { table, count: rows.length, errorCode: logErr.code ?? 'unknown' },
      });
    }
  }

  log({
    level: 'info',
    event: logEvent,
    user_id: null,
    residence_id: null,
    request_id: null,
    payload: { count: rows.length },
  });
  return rows.length;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.server.CRON_SECRET}`) {
    return Response.json(
      { error: { code: 'unauthorized', message_key: 'errors.cron.unauthorized' } },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

  const { data, error } = await admin
    .from('users')
    .select('id, residence_id')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff);

  if (error) {
    log({
      level: 'error',
      event: 'cron.purge_query_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown' },
    });
    return Response.json({ error: { code: 'query_failed' } }, { status: 500 });
  }

  let purged = 0;
  for (const row of data ?? []) {
    try {
      // Trace AVANT le delete (tant que l'id existe). actor_id sera SET NULL par
      // la cascade FK → trace anonyme.
      const { error: insErr } = await admin.from('moderation_log').insert({
        residence_id: row.residence_id,
        actor_id: row.id,
        action: 'purge_completed',
        target_kind: 'user',
        target_id: row.id,
      });
      if (insErr) {
        log({
          level: 'error',
          event: 'cron.purge_log_failed',
          user_id: row.id,
          residence_id: null,
          request_id: null,
          payload: { errorCode: insErr.code ?? 'unknown' },
        });
        // Skip deleteUser : le prochain cron retentera avec la trace d'audit.
        // Un hard-delete sans entrée purge_completed violerait NFR55.
        continue;
      }

      const del = await admin.auth.admin.deleteUser(row.id);
      if (del.error) {
        log({
          level: 'error',
          event: 'cron.purge_delete_failed',
          user_id: row.id,
          residence_id: null,
          request_id: null,
          payload: { errorCode: del.error.code ?? 'unknown' },
        });
        continue;
      }
      purged += 1;
    } catch (cause) {
      log({
        level: 'error',
        event: 'cron.purge_threw',
        user_id: row.id,
        residence_id: null,
        request_id: null,
        payload: { errorName: cause instanceof Error ? cause.name : 'unknown' },
      });
    }
  }

  // Story 2.5 review P24 — purger les `artisan_consent_tokens` expirés depuis
  // >90j (used_at NULL = jamais consommés ; on garde une fenêtre d'audit).
  // Les tokens utilisés restent indéfiniment (trace `moderation_log` lie
  // l'action consent au token via target_id artisan).
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { count: tokensPurged, error: tokenPurgeErr } = await admin
    .from('artisan_consent_tokens')
    .delete({ count: 'exact' })
    .is('used_at', null)
    .lt('expires_at', ninetyDaysAgo);
  if (tokenPurgeErr) {
    log({
      level: 'error',
      event: 'cron.purge_tokens_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: tokenPurgeErr.code ?? 'unknown' },
    });
  }

  // Story 4.5 — auto-expiration des alertes & bons plans (FR28).
  const alertsExpired = await expireEphemeral(admin, 'alerts', 'alert', 'alerts.auto_expired');
  const tipsExpired = await expireEphemeral(admin, 'tips', 'tip', 'tips.auto_expired');

  log({
    level: 'info',
    event: 'cron.purge_completed',
    user_id: null,
    residence_id: null,
    request_id: null,
    payload: { purged, tokensPurged: tokensPurged ?? 0, alertsExpired, tipsExpired },
  });

  return Response.json({
    data: { purged, tokensPurged: tokensPurged ?? 0, alertsExpired, tipsExpired },
  });
}
