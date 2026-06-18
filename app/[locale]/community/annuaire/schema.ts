// Story 2.2 (AC3) — validation/parsing des searchParams de l'annuaire (Zod 4).
// Les params invalides sont neutralisés (`.catch`) plutôt que de faire planter
// la page : un filtre forgé = aucun filtre, pas une 500.

import { z } from 'zod';

export const PRICE_VALUES = ['$', '$$', '$$$', '$$$$'] as const;
export const FACTURE_VALUES = ['oui'] as const;
// AC3 — 8 clés seedées par la migration 2.1. Liste maintenue en miroir du seed.
export const TAG_KEYS = [
  'plomberie',
  'electricite',
  'peinture',
  'menuiserie',
  'carrelage',
  'climatisation',
  'jardinage',
  'serrurerie',
] as const;
// UI = chips [2★, 3★, 4★] ; schema constrained à ces mêmes valeurs (alignement
// review 2026-06-17 D-aligné, évite l'incohérence ?min_rating=5 accepté côté
// schema mais non offert côté UI).
export const MIN_RATING_VALUES = [2, 3, 4] as const;
export const MAX_QUERY_LENGTH = 100;

export const annuaireSearchParamsSchema = z.object({
  q: z.string().max(MAX_QUERY_LENGTH).optional().catch(undefined),
  tag: z.enum(TAG_KEYS).optional().catch(undefined),
  price: z.enum(PRICE_VALUES).optional().catch(undefined),
  facture: z.enum(FACTURE_VALUES).optional().catch(undefined),
  min_rating: z.coerce
    .number()
    .int()
    .refine((n): n is (typeof MIN_RATING_VALUES)[number] =>
      (MIN_RATING_VALUES as readonly number[]).includes(n),
    )
    .optional()
    .catch(undefined),
  sort_by: z.literal('recency').optional().catch('recency'),
});

export type AnnuaireSearchParams = z.infer<typeof annuaireSearchParamsSchema>;
export type AnnuaireTagKey = (typeof TAG_KEYS)[number];

/** Parse des searchParams Next.js (record de string | string[]). */
export function parseAnnuaireParams(
  raw: Record<string, string | string[] | undefined>,
): AnnuaireSearchParams {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    flat[k] = Array.isArray(v) ? v[0] : v;
  }
  return annuaireSearchParamsSchema.parse(flat);
}
