// Story 2.4 — Zod schema de createArtisan. Erreurs mappées sur des clés i18n
// `errors.artisan.*` (le path Zod seul est lu, jamais le message natif — AR17).

import { z } from 'zod';
import { zPhoneMaroc } from './phone-e164';

export const PRICE_RELATIVE = ['$', '$$', '$$$', '$$$$'] as const;
export const HAS_INVOICE = ['oui', 'non', 'sur_demande'] as const;
export const VISIBILITY = ['pseudonym', 'named'] as const;
export const MAX_TAG_KEYS = 8;

const zOptionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

export const zCreateArtisanForm = z.object({
  display_name_fr: z.string().trim().min(1).max(120),
  display_name_ar: zOptionalText(120),
  phone: zPhoneMaroc,
  // Review 2026-06-18 P1 — borner le nombre de tags. La validation que chaque
  // clé est un slug existant est faite côté action (lookup `tags` + check de
  // cardinalité — détection de keys forgées/typos).
  tag_keys: z.array(z.string().min(1).max(64)).min(1).max(MAX_TAG_KEYS),
  price_relative: z.enum(PRICE_RELATIVE).optional(),
  has_invoice: z.enum(HAS_INVOICE).optional(),
  comment: zOptionalText(500),
  visibility: z.enum(VISIBILITY).default('pseudonym'),
  // Gate CNDP : la case doit être cochée (true), sinon rejet client + serveur.
  consent_confirmed: z.literal(true, { message: 'errors.artisan.consent_required' }),
});
export type CreateArtisanForm = z.infer<typeof zCreateArtisanForm>;
export type ArtisanFieldKey = keyof CreateArtisanForm;

export const ARTISAN_FIELD_ERROR_KEYS = [
  'errors.artisan.display_name_required',
  'errors.artisan.phone_invalid',
  'errors.artisan.tags_required',
  'errors.artisan.comment_too_long',
  'errors.artisan.consent_required',
  'errors.artisan.price_invalid',
  'errors.artisan.invoice_invalid',
  'errors.artisan.visibility_invalid',
] as const;
export type ArtisanFieldErrorKey = (typeof ARTISAN_FIELD_ERROR_KEYS)[number];

export function mapArtisanFieldError(field: ArtisanFieldKey): ArtisanFieldErrorKey {
  switch (field) {
    case 'display_name_fr':
    case 'display_name_ar':
      return 'errors.artisan.display_name_required';
    case 'phone':
      return 'errors.artisan.phone_invalid';
    case 'tag_keys':
      return 'errors.artisan.tags_required';
    case 'comment':
      return 'errors.artisan.comment_too_long';
    case 'price_relative':
      return 'errors.artisan.price_invalid';
    case 'has_invoice':
      return 'errors.artisan.invoice_invalid';
    case 'visibility':
      return 'errors.artisan.visibility_invalid';
    case 'consent_confirmed':
      return 'errors.artisan.consent_required';
  }
}
