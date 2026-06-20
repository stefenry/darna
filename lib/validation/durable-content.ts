// Story 3.5 (Task 3 / AC2/AC3/AC8) — schémas Zod du CRUD contenu durable, miroir
// client + serveur. ≥ FR rempli, AR optionnel (FR48), phone E.164, enums
// thème/catégorie, ordre entier ≥ 0. On ne lit que le `path` Zod pour la clé
// d'erreur (jamais le message natif — AR17).

import { z } from 'zod';
import { GUIDE_THEME_ORDER } from '@/lib/content/guide';
import { USEFUL_NUMBER_CATEGORY_ORDER } from '@/lib/content/useful-numbers';
import { slugify } from '@/lib/slug/slugify';

// Aligné sur le CHECK DB `useful_numbers_phone_e164_format` (review 3.1 P2).
const E164 = /^\+[1-9]\d{7,14}$/;
const SECTION_KEY = /^[a-z0-9_-]{1,64}$/;

const zRequiredText = (max: number) => z.string().trim().min(1).max(max);
const zOptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v && v.length > 0 ? v : null));
const zOrder = z.coerce.number().int().min(0).default(0);

export const zGuideEntry = z.object({
  slug: z.string().trim().max(60).optional().or(z.literal('')),
  theme_key: z.enum(GUIDE_THEME_ORDER as unknown as [string, ...string[]]),
  title_fr: zRequiredText(200),
  title_ar: zOptionalText(200),
  body_fr_markdown: zRequiredText(20000),
  body_ar_markdown: zOptionalText(20000),
  order_in_theme: zOrder,
});

export const zUsefulNumber = z.object({
  category_key: z.enum(USEFUL_NUMBER_CATEGORY_ORDER as unknown as [string, ...string[]]),
  label_fr: zRequiredText(120),
  label_ar: zOptionalText(120),
  phone_e164: z.string().trim().regex(E164),
  notes_fr: zOptionalText(500),
  notes_ar: zOptionalText(500),
  order_in_category: zOrder,
});

export const zPackEntry = z.object({
  // section_key normalisé en slug (review 3.1 P4 — CHECK `^[a-z0-9_-]{1,64}$`,
  // anti path-traversal). Le co_mod peut saisir « Codes portails » → `codes-portails`.
  section_key: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .transform((v) => slugify(v))
    .refine((v) => SECTION_KEY.test(v)),
  title_fr: zRequiredText(200),
  title_ar: zOptionalText(200),
  body_fr_markdown: zRequiredText(20000),
  body_ar_markdown: zOptionalText(20000),
  order_in_section: zOrder,
});

export type GuideEntryInput = z.infer<typeof zGuideEntry>;
export type UsefulNumberInput = z.infer<typeof zUsefulNumber>;
export type PackEntryInput = z.infer<typeof zPackEntry>;

/** Slug Guide : fourni (slugifié) ou auto-généré depuis title_fr (D5). */
export function resolveGuideSlug(input: { slug?: string | null; title_fr: string }): string {
  const provided = input.slug?.trim();
  const base = provided ? slugify(provided) : slugify(input.title_fr);
  return base || 'entree';
}

export const DURABLE_FIELD_ERROR_KEYS = [
  'fr_required',
  'phone_invalid',
  'theme_invalid',
  'category_invalid',
  'section_required',
  'order_invalid',
  'too_long',
  'submit_failed',
] as const;
export type DurableFieldErrorKey = (typeof DURABLE_FIELD_ERROR_KEYS)[number];

/** Mappe un `path` Zod (jamais le message natif, AR17) sur une clé i18n. */
export function mapDurableFieldError(path: string): DurableFieldErrorKey {
  switch (path) {
    case 'title_fr':
    case 'label_fr':
    case 'body_fr_markdown':
      return 'fr_required';
    case 'phone_e164':
      return 'phone_invalid';
    case 'theme_key':
      return 'theme_invalid';
    case 'category_key':
      return 'category_invalid';
    case 'section_key':
      return 'section_required';
    case 'order_in_theme':
    case 'order_in_category':
    case 'order_in_section':
      return 'order_invalid';
    default:
      return 'too_long';
  }
}
