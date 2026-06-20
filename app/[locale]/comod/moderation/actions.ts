'use server';

// Story 5.3 — Server Actions de modération co_mod : retrait / conservation d'un
// contenu signalé. Le travail atomique (soft-delete cible polymorphe + transition
// report + audit moderation_log) est dans les RPC SECURITY DEFINER moderate_*
// (migration 20260702090000) — la Server Action orchestre auth + Zod + e-mail.
//
// Notification auteur/reporter : on récupère l'e-mail via le client admin
// (auth.admin.getUserById) puis on envoie en FR (MVP FR-only). Locale par profil
// différée. Échec Brevo non bloquant (la décision est déjà committée par le RPC).

import { requireComod } from '@/lib/auth/require-comod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { zRemoveContent, zKeepContent } from '@/lib/validation/moderation';
import { sendTransactionalEmail } from '@/lib/email/send';
import { TARGET_LABELS_FR, MOTIVE_LABELS_FR } from '@/lib/moderation/labels';
import type { ReportTargetType } from '@/lib/validation/report';
import type { RemovalMotive } from '@/lib/validation/moderation';
import { log } from '@/lib/logger';

export type ModerationErrorCode =
  | 'forbidden'
  | 'invalid_input'
  | 'report_not_found'
  | 'already_resolved'
  | 'action_failed';

export type ModerationState = { ok: true } | { ok: false; code: ModerationErrorCode };

function mapRpcError(message: string): ModerationErrorCode {
  if (message.includes('not_co_mod') || message.includes('wrong_residence')) return 'forbidden';
  if (message.includes('report_not_found')) return 'report_not_found';
  if (message.includes('already_resolved')) return 'already_resolved';
  return 'action_failed';
}

async function emailFor(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function removeReportedContent(input: {
  report_id: string;
  motive: string;
  note?: string | null;
}): Promise<ModerationState> {
  const guard = await requireComod();
  if (!guard.ok) return { ok: false, code: 'forbidden' };

  const parsed = zRemoveContent.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'invalid_input' };
  const { report_id, motive, note } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('moderate_remove_content', {
    p_report_id: report_id,
    p_motive: motive,
    p_note: note ?? undefined,
  });

  if (error) {
    const code = mapRpcError(error.message);
    log({
      level: code === 'action_failed' ? 'error' : 'info',
      event: 'moderation.remove_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { code, report_id },
    });
    return { ok: false, code };
  }

  const row = Array.isArray(data) ? data[0] : null;
  const targetType = (row?.out_target_type ?? null) as ReportTargetType | null;
  const authorEmail = await emailFor(row?.target_author_id ?? null);

  if (authorEmail && targetType) {
    try {
      await sendTransactionalEmail({
        template: 'content-removed-author',
        to: authorEmail,
        locale: 'fr',
        vars: {
          content_label: TARGET_LABELS_FR[targetType],
          motive_label: MOTIVE_LABELS_FR[motive as RemovalMotive],
        },
      });
    } catch (cause) {
      log({
        level: 'error',
        event: 'moderation.author_notify_threw',
        user_id: guard.user.id,
        residence_id: null,
        request_id: null,
        payload: { errorName: cause instanceof Error ? cause.name : 'unknown' },
      });
    }
  }

  log({
    level: 'info',
    event: 'moderation.content_removed',
    user_id: guard.user.id,
    residence_id: row?.out_residence_id ?? null,
    request_id: null,
    payload: { report_id, target_type: targetType, motive },
  });
  return { ok: true };
}

export async function keepReportedContent(input: {
  report_id: string;
  note?: string | null;
}): Promise<ModerationState> {
  const guard = await requireComod();
  if (!guard.ok) return { ok: false, code: 'forbidden' };

  const parsed = zKeepContent.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'invalid_input' };
  const { report_id, note } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('moderate_keep_content', {
    p_report_id: report_id,
    p_note: note ?? undefined,
  });

  if (error) {
    const code = mapRpcError(error.message);
    log({
      level: code === 'action_failed' ? 'error' : 'info',
      event: 'moderation.keep_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { code, report_id },
    });
    return { ok: false, code };
  }

  const row = Array.isArray(data) ? data[0] : null;
  const reporterEmail = await emailFor(row?.out_reporter_id ?? null);

  // Pour le libellé, on récupère le target_type du report (lecture co_mod RLS).
  let targetType: ReportTargetType | null = null;
  const { data: reportRow } = await supabase
    .from('reports')
    .select('target_type')
    .eq('id', report_id)
    .maybeSingle();
  targetType = (reportRow?.target_type ?? null) as ReportTargetType | null;

  if (reporterEmail && targetType) {
    try {
      await sendTransactionalEmail({
        template: 'report-kept-reporter',
        to: reporterEmail,
        locale: 'fr',
        vars: { content_label: TARGET_LABELS_FR[targetType] },
      });
    } catch (cause) {
      log({
        level: 'error',
        event: 'moderation.reporter_notify_threw',
        user_id: guard.user.id,
        residence_id: null,
        request_id: null,
        payload: { errorName: cause instanceof Error ? cause.name : 'unknown' },
      });
    }
  }

  log({
    level: 'info',
    event: 'moderation.content_kept',
    user_id: guard.user.id,
    residence_id: row?.out_residence_id ?? null,
    request_id: null,
    payload: { report_id, target_type: targetType },
  });
  return { ok: true };
}
