import { z } from 'zod';

// Story 1.9 — Zod pour les Server Actions profil (paramètres + suppression).
// Miroir exact des CHECK DB profiles.identity_mode ('pseudo'|'identified') et
// profiles.language ('fr'|'ar') (init_schema.sql:55-57).

export const zProfileSettings = z.object({
  identity_mode: z.enum(['pseudo', 'identified']),
  language: z.enum(['fr', 'ar']),
  display_name: z
    .string()
    .trim()
    .min(1, 'errors.profil.display_name_required')
    .max(50, 'errors.profil.display_name_too_long')
    .optional(),
});
export type ProfileSettings = z.infer<typeof zProfileSettings>;

// Story 7.1 — Préférences notifications opt-in 3 catégories. Miroir exact des
// colonnes booléennes de notifications_prefs (init_schema.sql:120-134). Le
// résident toggle chaque catégorie indépendamment (RLS self-update).
export const zNotificationPrefs = z.object({
  alerts_urgentes_enabled: z.boolean(),
  nouvelles_entrees_annuaire_enabled: z.boolean(),
  activite_contributions_enabled: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof zNotificationPrefs>;

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
  'errors.profil.display_name_required',
  'errors.profil.display_name_too_long',
  'errors.profil.notifications_failed',
] as const;
export type ProfilErrorKey = (typeof PROFIL_ERROR_KEYS)[number];
