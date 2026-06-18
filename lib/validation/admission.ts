import { z } from 'zod';
import { zEmail } from './email';
import { zVillaNumber } from './villa-number';

// Story 1.7 — Zod schema pour la Server Action submitAdmissionRequest.
// Toutes les erreurs sont mappées sur des clés i18n `errors.admission.*` via
// `mapAdmissionFieldError` côté Server Action (AR17, architecture.md:549).
// Les messages Zod natifs (hérités de zVillaNumber/zEmail) ne sont jamais
// affichés à l'utilisateur — on ne lit que le path de l'erreur.

export const zTranche = z.enum(['A', 'B', 'C', 'D', 'E']);
export type Tranche = z.infer<typeof zTranche>;

export const zFirstName = z.string().trim().min(1).max(40);
export type FirstName = z.infer<typeof zFirstName>;

export const zSubmitAdmissionForm = z.object({
  villa: zVillaNumber,
  tranche: zTranche,
  first_name: zFirstName,
  email: zEmail,
  cgu_accepted: z.literal(true, { message: 'errors.admission.cgu_required' }),
});
export type SubmitAdmissionForm = z.infer<typeof zSubmitAdmissionForm>;

export type AdmissionFieldKey = keyof SubmitAdmissionForm;

// Whitelist des `message_key` i18n acceptables pour le form. Toute autre
// chaîne renvoyée au Client Component doit être filtrée (anti-XSS + cohérence
// next-intl). Le 6e code `duplicate_pending` n'est PAS un fieldError — c'est
// un `errorCode` business retourné par la Server Action quand une demande
// pending existe déjà pour cet e-mail.
export const ADMISSION_FIELD_ERROR_KEYS = [
  'errors.admission.villa_out_of_range',
  'errors.admission.tranche_invalid',
  'errors.admission.first_name_required',
  'errors.admission.email_invalid',
  'errors.admission.cgu_required',
] as const;
export type AdmissionFieldErrorKey = (typeof ADMISSION_FIELD_ERROR_KEYS)[number];

export function mapAdmissionFieldError(field: AdmissionFieldKey): AdmissionFieldErrorKey {
  switch (field) {
    case 'villa':
      return 'errors.admission.villa_out_of_range';
    case 'tranche':
      return 'errors.admission.tranche_invalid';
    case 'first_name':
      return 'errors.admission.first_name_required';
    case 'email':
      return 'errors.admission.email_invalid';
    case 'cgu_accepted':
      return 'errors.admission.cgu_required';
  }
}
