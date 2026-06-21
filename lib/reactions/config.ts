// Story 6.4 — cibles de réaction 👍 (commentaire = rating, alerte, bon plan).
// Aucune notion de « kind » : une seule réaction positive existe (pas de 👎).

export const REACTION_TARGET_TYPES = ['rating', 'alert', 'tip'] as const;
export type ReactionTarget = (typeof REACTION_TARGET_TYPES)[number];

export function isReactionTarget(v: string): v is ReactionTarget {
  return (REACTION_TARGET_TYPES as readonly string[]).includes(v);
}
