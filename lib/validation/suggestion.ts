// Story 6.5 — schéma de la suggestion d'évolution produit (texte libre ≤ 1000).
// `signed` (chantier identité, 2026-07-26) : le suggérant assume-t-il son nom
// auprès des co_mods ?

import { z } from 'zod';

export const SUGGESTION_MAXLEN = 1000;

// Une checkbox HTML n'envoie RIEN quand elle est décochée et 'on' quand elle est
// cochée. `z.coerce.boolean()` serait un piège ici : `Boolean('false') === true`.
// On teste donc explicitement les valeurs qui signifient « cochée », et tout le
// reste (absent, null, 'false') vaut anonyme — le défaut sûr.
const zCheckbox = z
  .unknown()
  .optional()
  .transform((value) => value === 'on' || value === 'true' || value === true);

export const zSuggestion = z.object({
  body: z.string().trim().min(1).max(SUGGESTION_MAXLEN),
  signed: zCheckbox,
});

export type SuggestionInput = z.infer<typeof zSuggestion>;
