// Story 2.7 — schéma Zod d'édition de fiche (calque allégé de zCreateArtisanForm,
// SANS `consent_confirmed` ni `comment`, réservés à la création). Erreurs mappées
// sur les clés i18n `errors.artisan.*` existantes (path Zod seul lu — AR17).

import { z } from 'zod';
import { zPhoneMaroc } from './phone-e164';
import { sanitizeName } from './sanitize';
import { PRICE_RELATIVE, HAS_INVOICE, MAX_TAG_KEYS, type ArtisanFieldErrorKey } from './artisan';

// P12 (review 2.7) — accepter FR + AR (client locale-aware) ; le client compare
// via `t('confirmPhrase')`, le serveur accepte les 2 variantes pour rester cohérent.
export const RETRACT_CONFIRM_PHRASES = ['RETIRER', 'إزالة'] as const;
export const RETRACT_CONFIRM_PHRASE = 'RETIRER';
export const zRetractArtisanConfirm = z.object({
  confirm: z.enum(RETRACT_CONFIRM_PHRASES),
});

export const zEditArtisanForm = z.object({
  display_name_fr: z.preprocess(
    (v) => (typeof v === 'string' ? sanitizeName(v) : v),
    z.string().min(1).max(120),
  ),
  display_name_ar: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? sanitizeName(v) : undefined),
    z.string().max(120).optional(),
  ),
  phone: zPhoneMaroc,
  tag_keys: z.array(z.string().min(1).max(64)).min(1).max(MAX_TAG_KEYS),
  price_relative: z.enum(PRICE_RELATIVE).optional(),
  has_invoice: z.enum(HAS_INVOICE).optional(),
});
export type EditArtisanForm = z.infer<typeof zEditArtisanForm>;
export type EditArtisanFieldKey = keyof EditArtisanForm;

export function mapEditArtisanFieldError(field: EditArtisanFieldKey): ArtisanFieldErrorKey {
  switch (field) {
    case 'display_name_fr':
    case 'display_name_ar':
      return 'errors.artisan.display_name_required';
    case 'phone':
      return 'errors.artisan.phone_invalid';
    case 'tag_keys':
      return 'errors.artisan.tags_required';
    case 'price_relative':
      return 'errors.artisan.price_invalid';
    case 'has_invoice':
      return 'errors.artisan.invoice_invalid';
  }
}
