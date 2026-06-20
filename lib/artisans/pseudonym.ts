// Story 2.6 (FR16) — pseudonyme stable « Voisin anonyme #XXXX » dérivé par hash
// du couple (user_id, artisan_id). Déterministe → cohérent pour toutes les
// contributions pseudonymes d'un même voisin sur un même artisan, et distinct
// entre voisins (l'AC FR16 = stabilité + distinction, pas le secret).
//
// Server-only : `user_id` n'est JAMAIS sérialisé vers le client ; seul le suffixe
// l'est. Hash one-way SHA-256 — non réversible (UUID non devinable) ; pas de
// secret requis. `user_id` null (note anonymisée par purge RGPD, ADR 0006) →
// renvoie null → l'UI affiche « Voisin supprimé ».

import { createHash } from 'node:crypto';

/** Suffixe stable 4 hex uppercase (ex. « A3F2 »), ou null si `userId` est null. */
export function pseudonymSuffix(userId: string | null, artisanId: string): string | null {
  if (!userId) return null;
  return createHash('sha256')
    .update(`${userId}:${artisanId}`)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase();
}
