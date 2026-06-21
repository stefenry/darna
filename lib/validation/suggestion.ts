// Story 6.5 — schéma de la suggestion d'évolution produit (texte libre ≤ 1000).

import { z } from 'zod';

export const SUGGESTION_MAXLEN = 1000;

export const zSuggestion = z.object({
  body: z.string().trim().min(1).max(SUGGESTION_MAXLEN),
});

export type SuggestionInput = z.infer<typeof zSuggestion>;
