// Affichage de l'auteur d'une suggestion côté co_mod. La décision revient au flag
// `signed` FIGÉ sur la ligne à l'envoi — surtout PAS à la préférence de profil
// courante : un voisin qui a envoyé en anonyme puis a activé « identité affichée »
// ne doit pas se retrouver nommé rétroactivement.

import type { NeighbourLabel } from '@/lib/content/author-label';

export const SUGGESTION_PSEUDONYM_SCOPE = 'suggestions';

export type SuggestionAuthor =
  | { kind: 'named'; name: string; villa: number | null }
  | { kind: 'pseudonym'; suffix: string }
  | { kind: 'deleted' };

export function suggestionAuthorLabel(
  signed: boolean,
  label: NeighbourLabel | undefined,
): SuggestionAuthor {
  if (!label || label.deleted || !label.pseudonym) return { kind: 'deleted' };
  // Défaut sûr : signée mais sans nom exploitable → pseudonyme, jamais un blanc.
  if (signed && label.displayName) {
    return { kind: 'named', name: label.displayName, villa: label.villa };
  }
  return { kind: 'pseudonym', suffix: label.pseudonym };
}
