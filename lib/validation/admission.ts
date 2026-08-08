import { z } from 'zod';
import { zEmail } from './email';
import { zVillaNumber } from './villa-number';

// Story 1.7 — Zod schema pour la Server Action submitAdmissionRequest.
// Toutes les erreurs sont mappées sur des clés i18n `errors.admission.*` via
// `mapAdmissionFieldError` côté Server Action (AR17, architecture.md:549).
// Les messages Zod natifs (hérités de zVillaNumber/zEmail) ne sont jamais
// affichés à l'utilisateur — on ne lit que le path de l'erreur.

// 2026-08-08 — la résidence ne compte en pratique que 3 tranches. Les anciennes
// lettres A/B/C deviennent 1/2/3, la 4e (D) est supprimée, et la 5e (E) devient
// `T` : la tranche de test, conservée pour les parcours de recette.
// Les valeurs déjà en base sont converties par la migration
// supabase/migrations/20260808120000_tranches_1_2_3_test.sql, qui pose aussi le
// CHECK miroir de cet enum.
export const zTranche = z.enum(['1', '2', '3', 'T']);
export type Tranche = z.infer<typeof zTranche>;

/**
 * Source UNIQUE de la liste des tranches, pour les `<select>` et les tests.
 *
 * Elle était auparavant recopiée à la main dans cinq endroits (cet enum, un
 * second `type Tranche` local à settings-form.tsx, un tableau `TRANCHES` dans ce
 * même fichier, cinq `<option>` en dur dans admission-form.tsx, et cinq clés
 * i18n par locale) — cinq occasions de dériver à chaque changement.
 */
export const TRANCHES = zTranche.options;

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
