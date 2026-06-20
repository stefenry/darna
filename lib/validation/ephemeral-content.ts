// Story 4.2/4.3 — schémas Zod du contenu éphémère (alertes & bons plans), miroir
// client + serveur. ≥ FR rempli, AR optionnel (FR48), enums modèle/catégorie,
// durée d'alerte ∈ {24,72,168}. On ne lit que le `path` Zod pour la clé d'erreur
// (jamais le message natif — AR17). L'expiration des bons plans (passé / >30j)
// est validée dans la Server Action pour renvoyer `invalid_expiration` (4.3 AC2).

import { z } from 'zod';
import {
  ALERT_DURATIONS_HOURS,
  ALERT_TEMPLATE_KEYS,
  TIP_CATEGORY_KEYS,
} from '@/lib/content/ephemeral';
import { slugify } from '@/lib/slug/slugify';
import { shortId } from '@/lib/slug/short-id';

const zRequiredText = (max: number) => z.string().trim().min(1).max(max);
const zOptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v && v.length > 0 ? v : null));

// ── Alerte (4.2) ──────────────────────────────────────────────────────────────
export const zCreateAlert = z.object({
  template_key: z.enum(ALERT_TEMPLATE_KEYS as unknown as [string, ...string[]]),
  title_fr: zRequiredText(200),
  title_ar: zOptionalText(200),
  body_fr: zRequiredText(5000),
  body_ar: zOptionalText(5000),
  duration_hours: z.coerce
    .number()
    .int()
    .refine((n) => (ALERT_DURATIONS_HOURS as readonly number[]).includes(n)),
});
export type CreateAlertInput = z.infer<typeof zCreateAlert>;

// ── Bon plan (4.3) ────────────────────────────────────────────────────────────
// `expires_on` = date `YYYY-MM-DD` du picker ; les bornes (futur / ≤30j) sont
// vérifiées dans l'action (clé `invalid_expiration`). Ici on garantit juste un
// format date parseable.
export const zCreateTip = z.object({
  category_key: z.enum(TIP_CATEGORY_KEYS as unknown as [string, ...string[]]),
  title_fr: zRequiredText(200),
  title_ar: zOptionalText(200),
  body_fr: zRequiredText(5000),
  body_ar: zOptionalText(5000),
  expires_on: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type CreateTipInput = z.infer<typeof zCreateTip>;

// ── Clés d'erreur i18n (namespace errors.alert / errors.tip) ──────────────────
export type EphemeralFieldErrorKey =
  | 'fr_required'
  | 'too_long'
  | 'category_invalid'
  | 'template_invalid'
  | 'duration_invalid'
  | 'invalid_expiration';

export function mapAlertFieldError(path: string): EphemeralFieldErrorKey {
  switch (path) {
    case 'title_fr':
    case 'body_fr':
      return 'fr_required';
    case 'template_key':
      return 'template_invalid';
    case 'duration_hours':
      return 'duration_invalid';
    default:
      return 'too_long';
  }
}

export function mapTipFieldError(path: string): EphemeralFieldErrorKey {
  switch (path) {
    case 'title_fr':
    case 'body_fr':
      return 'fr_required';
    case 'category_key':
      return 'category_invalid';
    case 'expires_on':
      return 'invalid_expiration';
    default:
      return 'too_long';
  }
}

/**
 * Slug d'un contenu éphémère : `slugify(title_fr)` (≤60) + suffixe court aléatoire
 * (anti-collision sans lookup DB). Conforme au CHECK `^[a-z0-9][a-z0-9-]{0,79}$`.
 */
export function buildEphemeralSlug(titleFr: string, fallback: string): string {
  const base = slugify(titleFr).slice(0, 60).replace(/-+$/, '') || fallback;
  return `${base}-${shortId()}`;
}
