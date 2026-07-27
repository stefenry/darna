// Story 2.2 (AC3) — validation/parsing des searchParams de l'annuaire (Zod 4).
// Les params invalides sont neutralisés (`.catch`) plutôt que de faire planter
// la page : un filtre forgé = aucun filtre, pas une 500.

import { z } from 'zod';

export const PRICE_VALUES = ['$', '$$', '$$$', '$$$$'] as const;
export const FACTURE_VALUES = ['oui'] as const;
// Le référentiel de compétences est DYNAMIQUE : seed initial, migrations
// ultérieures (`more_tags`), et surtout ajouts par les co_mods depuis
// /comod/admin/competences. On valide donc la FORME de la clé, jamais une liste.
//
// Retour bêta 2026-07-26 : ce champ était un `z.enum` de 8 clés codées en dur.
// Filtrer par « osmose » — ou par n'importe laquelle des 8 compétences ajoutées
// par migration — était rejeté puis neutralisé par `.catch`, si bien que la page
// renvoyait l'annuaire ENTIER au lieu du filtre demandé. La liste avait même
// divergé du seed d'origine (`maconnerie` en base, `carrelage` dans le code).
//
// Forme produite par `comod_add_tag` : lower(unaccent(label)), tout caractère
// non alphanumérique remplacé par `_`, sans `_` en tête ni en queue.
const TAG_KEY_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const MAX_TAG_KEY_LENGTH = 64;
// UI = chips [2★, 3★, 4★] ; schema constrained à ces mêmes valeurs (alignement
// review 2026-06-17 D-aligné, évite l'incohérence ?min_rating=5 accepté côté
// schema mais non offert côté UI).
export const MIN_RATING_VALUES = [2, 3, 4] as const;
export const MAX_QUERY_LENGTH = 100;

export const annuaireSearchParamsSchema = z.object({
  q: z.string().max(MAX_QUERY_LENGTH).optional().catch(undefined),
  // Une clé bien formée mais inconnue de la base filtre pour de bon : elle ne
  // renvoie aucun résultat. C'est la réponse honnête — « rien ne correspond » —
  // là où l'ancien comportement renvoyait tout.
  tag: z.string().max(MAX_TAG_KEY_LENGTH).regex(TAG_KEY_PATTERN).optional().catch(undefined),
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
