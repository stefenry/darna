import { z } from 'zod';

// Story 1.9 — Zod pour les Server Actions profil (paramètres + suppression).
// Miroir exact des CHECK DB profiles.identity_mode ('pseudo'|'identified') et
// profiles.language ('fr'|'ar') (init_schema.sql:55-57).

export const zProfileSettings = z.object({
  identity_mode: z.enum(['pseudo', 'identified']),
  language: z.enum(['fr', 'ar']),
});
export type ProfileSettings = z.infer<typeof zProfileSettings>;

// Phrase de confirmation destructive (D2). Constante, casse exacte, locale-
// indépendante — tapée par l'utilisateur dans la Danger Zone.
export const DELETE_CONFIRM_PHRASE = 'SUPPRIMER';

export const zDeleteAccount = z.object({
  confirm: z.literal(DELETE_CONFIRM_PHRASE, { message: 'errors.profil.confirm_mismatch' }),
});

export const PROFIL_ERROR_KEYS = [
  'errors.profil.forbidden',
  'errors.profil.confirm_mismatch',
  'errors.profil.settings_failed',
  'errors.profil.delete_failed',
] as const;
export type ProfilErrorKey = (typeof PROFIL_ERROR_KEYS)[number];
