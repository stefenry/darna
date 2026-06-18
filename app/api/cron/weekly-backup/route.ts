import { type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { log } from '@/lib/logger';
import { brevoSendEmail } from '@/lib/email/client';

// Story 1.10d (AR29/NFR33) — Déclencheur du backup hebdomadaire.
// Protégé par Authorization: Bearer ${CRON_SECRET} (AR39, Vercel-injected),
// pattern identique au cron purge-expired (1.9). Le dump pg + l'upload R2 sont
// faits par la Supabase Edge Function `weekly-backup` (Deno) — voir
// supabase/functions/weekly-backup/. **Scaffold (D6)** : l'upload réel s'active
// quand le bucket R2 + les secrets sont provisionnés (cf. docs/runbook.md).

async function alertBackupFailure(errorName: string): Promise<void> {
  await brevoSendEmail({
    to: env.server.LEGAL_CONTACT_EMAIL,
    subject: '[Darna] ALERTE — Backup hebdomadaire en échec',
    htmlContent: `<p>Le cron <code>weekly-backup</code> a échoué (<code>${errorName}</code>). Consulter Sentry et le runbook §4.</p>`,
    textContent: `Le cron weekly-backup a échoué (${errorName}). Consulter Sentry et le runbook §4.`,
  });
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

  try {
    const { data, error } = await admin.functions.invoke('weekly-backup', { body: {} });
    if (error) {
      log({
        level: 'error',
        event: 'cron.backup_failed',
        user_id: null,
        residence_id: null,
        request_id: null,
        payload: { errorName: error.name ?? 'unknown' },
      });
      void alertBackupFailure(error.name ?? 'unknown');
      return Response.json(
        { error: { code: 'backup_failed', message_key: 'errors.cron.failed' } },
        { status: 500 },
      );
    }

    const result = data as { ok: boolean; skipped?: string; key?: string } | null;
    if (result?.skipped) {
      log({
        level: 'info',
        event: 'cron.backup_skipped',
        user_id: null,
        residence_id: null,
        request_id: null,
        payload: { reason: result.skipped },
      });
    } else {
      log({
        level: 'info',
        event: 'cron.backup_completed',
        user_id: null,
        residence_id: null,
        request_id: null,
        payload: { key: result?.key ?? '' },
      });
    }
    return Response.json({ data: { ok: true } });
  } catch (cause) {
    const errorName = cause instanceof Error ? cause.name : 'unknown';
    log({
      level: 'error',
      event: 'cron.backup_threw',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorName },
    });
    void alertBackupFailure(errorName);
    return Response.json(
      { error: { code: 'backup_failed', message_key: 'errors.cron.failed' } },
      { status: 500 },
    );
  }
}
