// Story 5.2 — Zod schema du signalement de contenu (raison fermée — FR31).
// Erreurs mappées sur des clés i18n `errors.report.*` (le path Zod seul est lu,
// jamais le message natif — AR17). Miroir applicatif des contraintes DB :
// `report_target_type` / `report_reason` enums, `note_text ≤ 200`. La note libre
// est sanitisée (NFC + strip bidi/control) comme les autres textes utilisateur.

import { z } from 'zod';
import { sanitizeUserText } from './sanitize';

// Liste fermée des cibles signalables (miroir enum DB report_target_type).
// `alert_comment` existe en base (forward-compat Epic 6.4) mais n'est pas encore
// exposé tant que les commentaires d'alerte n'existent pas → SIGNALABLE exclut.
export const REPORT_TARGET_TYPES = [
  'artisan',
  'rating',
  'alert',
  'alert_comment',
  'tip',
  'guide_entry',
  'useful_number',
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

// Cibles réellement câblées dans l'UI 5.2 (les surfaces qui existent au MVP).
export const SIGNALABLE_TARGET_TYPES = [
  'artisan',
  'rating',
  'alert',
  'tip',
  'guide_entry',
  'useful_number',
] as const;

// Liste fermée des motifs (FR31 — affichée telle quelle dans le dropdown).
export const REPORT_REASONS = [
  'diffamation',
  'info_erronee',
  'harcelement',
  'spam',
  'hors_charte',
  'autre',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_NOTE_MAXLEN = 200;

export const zSubmitReport = z.object({
  target_type: z.enum(REPORT_TARGET_TYPES),
  target_id: z.string().uuid(),
  reason: z.enum(REPORT_REASONS),
  // Note optionnelle : sanitize NFC + strip bidi/control (anti spoof), borne 200.
  // Une chaîne vide / blancs → undefined (pas de note).
  note_text: z.preprocess(
    (v) =>
      typeof v === 'string' && v.trim()
        ? sanitizeUserText(v, { maxLen: REPORT_NOTE_MAXLEN })
        : undefined,
    z.string().max(REPORT_NOTE_MAXLEN).optional(),
  ),
});

export type SubmitReportInput = z.infer<typeof zSubmitReport>;
export type ReportFieldKey = keyof SubmitReportInput;

// Champs réellement faillibles côté Zod. `note_text` est toujours sanitisé +
// tronqué à 200 (sanitizeUserText) avant le `.max()` → il ne produit JAMAIS
// d'erreur de validation ; il n'est donc pas mappable (pas de `note_too_long`).
export type ReportErrorableField = Exclude<ReportFieldKey, 'note_text'>;

// Whitelist des clés d'erreur i18n renvoyées au client (AR17 — jamais le message
// Zod natif). Le client résout `errors.report.<key>`.
export const REPORT_FIELD_ERROR_KEYS = ['target_invalid', 'reason_invalid'] as const;
export type ReportFieldErrorKey = (typeof REPORT_FIELD_ERROR_KEYS)[number];

export function mapReportFieldError(field: ReportErrorableField): ReportFieldErrorKey {
  switch (field) {
    case 'target_type':
    case 'target_id':
      return 'target_invalid';
    case 'reason':
      return 'reason_invalid';
  }
}
