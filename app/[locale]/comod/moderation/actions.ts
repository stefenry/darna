'use server';

// Story 5.3 — Server Actions de modération co_mod : retrait / conservation d'un
// contenu signalé. Le travail atomique (soft-delete cible polymorphe + transition
// report + audit moderation_log) est dans les RPC SECURITY DEFINER moderate_*
// (migration 20260702090000) — la Server Action orchestre auth + Zod + e-mail.
//
// Notification auteur/reporter (catégorie `activite_contributions`) : routée via
// `notifyResident` (Story 7.2) qui respecte l'opt-in du destinataire (FR40) et
// résout sa locale par profil (fallback FR). Échec Brevo non bloquant (la
// décision est déjà committée par le RPC). L'escalade juridique (contact externe,
// non résident, non opt-in-able) garde l'envoi direct via send.ts.

import { requireComod } from '@/lib/auth/require-comod';
import { createClient } from '@/lib/supabase/server';
import {
  zRemoveContent,
  zKeepContent,
  zEscalateLegal,
  zResolveLegal,
} from '@/lib/validation/moderation';
import { sendTransactionalEmail } from '@/lib/email/send';
import { notifyResident } from '@/lib/notifications/dispatch';
import { TARGET_LABELS_FR, MOTIVE_LABELS_FR } from '@/lib/moderation/labels';
import { resolveTarget } from '@/lib/moderation/target-content';
import {
  generateDossierMarkdown,
  dossierSummary,
  authorPseudonymFromId,
  type DossierInput,
} from '@/lib/moderation/dossier';
import { uploadDossier } from '@/lib/moderation/legal-storage';
import type { ReportTargetType } from '@/lib/validation/report';
import type { RemovalMotive } from '@/lib/validation/moderation';
import { env } from '@/lib/env';
import { log } from '@/lib/logger';

export type ModerationErrorCode =
  | 'forbidden'
  | 'invalid_input'
  | 'report_not_found'
  | 'already_resolved'
  | 'not_pending_legal'
  | 'legal_contact_missing'
  | 'action_failed';

// Avertissement non bloquant : l'action a réussi côté DB mais un effet de bord
// post-commit a échoué (ex. e-mail au contact juridique) → on le remonte à l'UI
// plutôt qu'un faux succès silencieux.
export type ModerationWarnCode = 'legal_email_failed';
export type ModerationState =
  | { ok: true; warn?: ModerationWarnCode; dossierUrl?: string | null }
  | { ok: false; code: ModerationErrorCode };

function mapRpcError(message: string): ModerationErrorCode {
  if (message.includes('not_co_mod') || message.includes('wrong_residence')) return 'forbidden';
  if (message.includes('report_not_found')) return 'report_not_found';
  if (message.includes('not_pending_legal')) return 'not_pending_legal';
  if (message.includes('already_resolved')) return 'already_resolved';
  return 'action_failed';
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

  // Notif auteur (activite_contributions) : opt-in + locale gérés par le dispatcher.
  if (targetType) {
    await notifyResident({
      userId: row?.target_author_id ?? null,
      category: 'activite_contributions',
      build: ({ to, locale }) => ({
        template: 'content-removed-author',
        to,
        locale,
        vars: {
          content_label: TARGET_LABELS_FR[targetType],
          motive_label: MOTIVE_LABELS_FR[motive as RemovalMotive],
        },
      }),
    });
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

  // Pour le libellé, on récupère le target_type du report (lecture co_mod RLS).
  const { data: reportRow } = await supabase
    .from('reports')
    .select('target_type')
    .eq('id', report_id)
    .maybeSingle();
  const targetType = (reportRow?.target_type ?? null) as ReportTargetType | null;

  // Notif reporter (activite_contributions) : opt-in + locale gérés par le dispatcher.
  if (targetType) {
    await notifyResident({
      userId: row?.out_reporter_id ?? null,
      category: 'activite_contributions',
      build: ({ to, locale }) => ({
        template: 'report-kept-reporter',
        to,
        locale,
        vars: { content_label: TARGET_LABELS_FR[targetType] },
      }),
    });
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

// ─────────────────────────────────────────────────────────────────────────────
// Story 5.5 — Escalade juridique + résolution out-of-band.
// ─────────────────────────────────────────────────────────────────────────────

export async function escalateReportLegal(input: {
  report_id: string;
  context_note: string;
}): Promise<ModerationState> {
  const guard = await requireComod();
  if (!guard.ok) return { ok: false, code: 'forbidden' };

  const parsed = zEscalateLegal.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'invalid_input' };
  const { report_id, context_note } = parsed.data;

  // NFR30 — le contact juridique doit être configuré (env). Défensif : env le
  // valide en email au boot, mais on garde le garde-fou + renvoi vers le runbook.
  const legalEmail = env.server.LEGAL_CONTACT_EMAIL;
  if (!legalEmail) return { ok: false, code: 'legal_contact_missing' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('escalate_report_legal', {
    p_report_id: report_id,
    p_context_note: context_note,
  });
  if (error) {
    const code = mapRpcError(error.message);
    log({
      level: code === 'action_failed' ? 'error' : 'info',
      event: 'moderation.escalate_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { code, report_id },
    });
    return { ok: false, code };
  }

  const row = Array.isArray(data) ? data[0] : null;
  const targetType = (row?.out_target_type ?? null) as ReportTargetType | null;
  const targetId = row?.out_target_id ?? null;

  // Construire le dossier PII-safe (snippet cible + actions antérieures + pseudos).
  const target = targetType && targetId ? await resolveTarget('fr', targetType, targetId) : null;
  const { data: reportRow } = await supabase
    .from('reports')
    .select('reason, note_text')
    .eq('id', report_id)
    .maybeSingle();
  // Actions antérieures via la VUE moderation_log_public (la table brute n'est plus
  // lisible côté client — review Epic 5). La vue expose ces actions de gouvernance.
  const { data: prior } = await supabase
    .from('moderation_log_public')
    .select('action, created_at')
    .eq('target_id', targetId ?? '')
    .in('action', ['content_removed', 'content_kept', 'escalation_triggered'])
    .order('created_at', { ascending: false });

  const dossier: DossierInput = {
    reportId: report_id,
    targetType: targetType ?? 'inconnu',
    reason: reportRow?.reason ?? 'inconnu',
    reporterNote: reportRow?.note_text ?? null,
    contextNote: context_note,
    targetTitle: target?.title ?? '',
    targetBody: target?.body ?? null,
    authorPseudonym: authorPseudonymFromId(row?.target_author_id ?? null),
    reporterPseudonym: authorPseudonymFromId(row?.out_reporter_id ?? null) ?? 'anonyme',
    priorActions: (prior ?? [])
      .filter((p) => p.action !== null && p.created_at !== null)
      .map((p) => ({ action: p.action as string, createdAt: p.created_at as string })),
    generatedAtIso: new Date().toISOString(),
  };
  const markdown = generateDossierMarkdown(dossier);
  const dossierUrl = await uploadDossier(report_id, markdown);

  // `sendTransactionalEmail` RETOURNE { ok:false } sur rejet Brevo (ne throw pas
  // forcément) — on inspecte la valeur, sinon un échec passerait pour un succès.
  let emailSent = false;
  try {
    const sent = await sendTransactionalEmail({
      template: 'escalation-legal',
      to: legalEmail,
      locale: 'fr',
      vars: {
        summary: dossierSummary(dossier),
        dossier_url: dossierUrl,
        dossier_inline: dossierUrl ? null : markdown,
      },
    });
    emailSent = sent.ok;
  } catch (cause) {
    log({
      level: 'error',
      event: 'moderation.legal_notify_threw',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorName: cause instanceof Error ? cause.name : 'unknown' },
    });
  }

  log({
    level: emailSent ? 'info' : 'error',
    event: 'moderation.escalated',
    user_id: guard.user.id,
    residence_id: row?.out_residence_id ?? null,
    request_id: null,
    payload: {
      report_id,
      target_type: targetType,
      dossier_stored: Boolean(dossierUrl),
      email_sent: emailSent,
    },
  });

  // La transition pending_legal est committée (RPC). Si l'e-mail au juriste a
  // échoué, l'escalade a bien eu lieu mais le contact n'est PAS notifié et le
  // report n'est plus `open` (donc non rejouable) → on le signale au co_mod avec
  // le lien du dossier à transmettre manuellement, au lieu d'un faux succès.
  if (!emailSent) {
    return { ok: true, warn: 'legal_email_failed', dossierUrl };
  }
  return { ok: true };
}

export async function resolveLegalEscalation(input: {
  report_id: string;
  decision: string;
  note?: string | null;
}): Promise<ModerationState> {
  const guard = await requireComod();
  if (!guard.ok) return { ok: false, code: 'forbidden' };

  const parsed = zResolveLegal.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'invalid_input' };
  const { report_id, decision, note } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('resolve_legal_escalation', {
    p_report_id: report_id,
    p_decision: decision,
    p_note: note ?? '',
  });
  if (error) {
    const code = mapRpcError(error.message);
    log({
      level: code === 'action_failed' ? 'error' : 'info',
      event: 'moderation.legal_resolve_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { code, report_id, decision },
    });
    return { ok: false, code };
  }

  const row = Array.isArray(data) ? data[0] : null;
  log({
    level: 'info',
    event: 'moderation.legal_resolved',
    user_id: guard.user.id,
    residence_id: row?.out_residence_id ?? null,
    request_id: null,
    payload: { report_id, decision },
  });
  return { ok: true };
}
