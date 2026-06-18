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
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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

  log({
    level: 'info',
    event: 'cron.purge_completed',
    user_id: null,
    residence_id: null,
    request_id: null,
    payload: { purged },
  });

  return Response.json({ data: { purged } });
}
