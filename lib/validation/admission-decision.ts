import { z } from 'zod';

// Story 1.8 — Zod schemas pour les Server Actions de décision co-mod
// (validateAdmission / rejectAdmission). Miroir EXACT de l'enum DB
// `admission_decision_reason` (init_enums.sql:18-24). Toutes les erreurs
// mappent sur des clés i18n `errors.comod.*` côté Server Action (AR17).

export const zAdmissionDecisionReason = z.enum([
  'villa_out_of_range',
  'duplicate',
  'incomplete_info',
  'manual_review_needed',
]);
export type AdmissionDecisionReason = z.infer<typeof zAdmissionDecisionReason>;

export const ADMISSION_DECISION_REASONS = zAdmissionDecisionReason.options;

export const zValidateAdmission = z.object({
  admission_request_id: z.string().uuid(),
});
export type ValidateAdmissionInput = z.infer<typeof zValidateAdmission>;

export const zRejectAdmission = z.object({
  admission_request_id: z.string().uuid(),
  motive: zAdmissionDecisionReason,
});
export type RejectAdmissionInput = z.infer<typeof zRejectAdmission>;

// Whitelist des `message_key` i18n acceptables (anti-XSS + cohérence next-intl).
export const COMOD_ERROR_KEYS = [
  'errors.comod.forbidden',
  'errors.comod.invalid_id',
  'errors.comod.motive_required',
  'errors.comod.motive_invalid',
  'errors.comod.already_decided',
  'errors.comod.wrong_residence',
  'errors.comod.decision_failed',
] as const;
export type ComodErrorKey = (typeof COMOD_ERROR_KEYS)[number];
