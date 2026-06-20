'use server';

// Story 5.2 — Server Action de signalement de contenu (résident authentifié).
// Flux : auth.getUser → Zod validate → rate-limit (3/h/reporter) → INSERT reports
// (client authentifié, RLS reporter_id=auth.uid) → 23505 ⇒ duplicate → notifier
// les co_mods (Brevo). Le moderation_log report_opened est écrit par le trigger
// log_report_opened (5.1) — le résident n'a aucun grant sur moderation_log.
//
// Idempotence : index UNIQUE partiel reports_unique_open_per_reporter_target
// (5.1) → un seul signalement OUVERT par (reporter, cible). AR31 anti-abus.

import {
  zSubmitReport,
  mapReportFieldError,
  type ReportFieldKey,
  type ReportFieldErrorKey,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/validation/report';
import { createClient } from '@/lib/supabase/server';
import { sendTransactionalEmail } from '@/lib/email/send';
import { checkLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { env } from '@/lib/env';

export type SubmitReportState =
  | { ok: false; fieldErrors: Partial<Record<ReportFieldKey, ReportFieldErrorKey[]>> }
  | { ok: false; errorCode: 'unauthenticated' | 'duplicate' | 'rate_limited' | 'submit_failed' }
  | { ok: true };

// AR31 — 3 signalements / heure / reporter (le 4e dans l'heure → rate_limited).
const REPORT_RATE_LIMIT = 3;
const REPORT_RATE_WINDOW_SECONDS = 3_600;

// Libellés FR pour l'e-mail co_mod (MVP FR-only, comme la notif admission 1.7).
const TARGET_LABELS_FR: Record<ReportTargetType, string> = {
  artisan: 'Fiche artisan',
  rating: 'Avis / commentaire',
  alert: 'Alerte',
  alert_comment: "Commentaire d'alerte",
  tip: 'Bon plan',
  guide_entry: 'Entrée du guide',
  useful_number: 'Numéro utile',
};
const REASON_LABELS_FR: Record<ReportReason, string> = {
  diffamation: 'Diffamation',
  info_erronee: 'Info erronée',
  harcelement: 'Harcèlement',
  spam: 'Spam',
  hors_charte: 'Hors-charte',
  autre: 'Autre',
};

function baseUrl(): string {
  return env.client.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
}

export async function submitReport(input: {
  target_type: string;
  target_id: string;
  reason: string;
  note_text?: string | null;
}): Promise<SubmitReportState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  if (!user) return { ok: false, errorCode: 'unauthenticated' };

  const residenceId =
    typeof user.app_metadata?.residence_id === 'string' ? user.app_metadata.residence_id : null;
  if (!residenceId) return { ok: false, errorCode: 'unauthenticated' };

  const parsed = zSubmitReport.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const out: Partial<Record<ReportFieldKey, ReportFieldErrorKey[]>> = {};
    const fields: ReportFieldKey[] = ['target_type', 'target_id', 'reason', 'note_text'];
    for (const field of fields) {
      if (flat.fieldErrors[field] && flat.fieldErrors[field]!.length > 0) {
        out[field] = [mapReportFieldError(field)];
      }
    }
    return { ok: false, fieldErrors: out };
  }

  const { target_type, target_id, reason, note_text } = parsed.data;

  // AR31 — rate-limit après validation (on ne pénalise pas une saisie invalide).
  const rl = await checkLimit(`report:${user.id}`, REPORT_RATE_LIMIT, REPORT_RATE_WINDOW_SECONDS);
  if (!rl.success) {
    log({
      level: 'info',
      event: 'report.rate_limited',
      user_id: user.id,
      residence_id: residenceId,
      request_id: null,
      payload: { target_type, reason },
    });
    return { ok: false, errorCode: 'rate_limited' };
  }

  // INSERT via client authentifié : RLS reports_reporter_insert_own + grant
  // column-level (reporter_id NON granté → default auth.uid()). Le trigger
  // log_report_opened écrit moderation_log report_opened (audit, no-PII).
  const insert = await supabase.from('reports').insert({
    residence_id: residenceId,
    target_type,
    target_id,
    reason,
    note_text: note_text ?? null,
  });

  if (insert.error) {
    // 23505 = violation de l'index UNIQUE partiel → signalement déjà ouvert.
    if (insert.error.code === '23505') {
      log({
        level: 'info',
        event: 'report.duplicate',
        user_id: user.id,
        residence_id: residenceId,
        request_id: null,
        payload: { target_type, reason },
      });
      return { ok: false, errorCode: 'duplicate' };
    }
    log({
      level: 'error',
      event: 'report.insert_failed',
      user_id: user.id,
      residence_id: residenceId,
      request_id: null,
      payload: { errorCode: insert.error.code ?? 'unknown', target_type, reason },
    });
    return { ok: false, errorCode: 'submit_failed' };
  }

  // Notifier les co_mods (CSV INITIAL_COMOD_EMAILS, comme l'admission 1.7).
  // try/catch par envoi — un échec Brevo ne bloque jamais le signalement.
  const queueUrl = `${baseUrl()}/fr/comod/moderation`;
  for (const comodEmail of env.server.INITIAL_COMOD_EMAILS) {
    try {
      const r = await sendTransactionalEmail({
        template: 'report-notify-comod',
        to: comodEmail,
        locale: 'fr',
        vars: {
          target_label: TARGET_LABELS_FR[target_type],
          reason_label: REASON_LABELS_FR[reason],
          note_text: note_text ?? null,
          queue_url: queueUrl,
        },
      });
      if (!r.ok) {
        log({
          level: 'error',
          event: 'report.comod_notify_failed',
          user_id: user.id,
          residence_id: residenceId,
          request_id: null,
          payload: { errorCode: r.errorCode },
        });
      }
    } catch (cause) {
      log({
        level: 'error',
        event: 'report.comod_notify_threw',
        user_id: user.id,
        residence_id: residenceId,
        request_id: null,
        payload: { errorName: cause instanceof Error ? cause.name : 'unknown' },
      });
    }
  }

  log({
    level: 'info',
    event: 'report.opened',
    user_id: user.id,
    residence_id: residenceId,
    request_id: null,
    payload: { target_type, reason, has_note: Boolean(note_text) },
  });

  return { ok: true };
}
