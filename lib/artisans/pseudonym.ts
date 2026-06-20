// Story 2.6 (FR16) — pseudonyme stable « Voisin anonyme #XXXX » dérivé par
// HMAC du couple (user_id, artisan_id). Déterministe → cohérent pour toutes
// les contributions pseudonymes d'un même voisin sur un même artisan ; distinct
// entre voisins.
//
// Review D1 (2026-06-20) : HMAC-SHA256 avec secret — défense en profondeur vs
// co_mod / ops avec accès aux `users.id` (qui pouvait sinon rétro-calculer le
// mapping offline). Le secret est passé en paramètre (testable sans env,
// pattern miroir de `lib/consent/token.ts`).
//
// Server-only : `user_id` n'est JAMAIS sérialisé vers le client ; seul le
// suffixe l'est. `user_id` null (note anonymisée par purge RGPD, ADR 0006) →
// renvoie null → l'UI affiche « Voisin supprimé ».

import { createHmac } from 'node:crypto';
import { env } from '@/lib/env';

/** Suffixe stable 4 hex uppercase (ex. « A3F2 »), ou null si `userId` est null. */
export function pseudonymSuffix(
  userId: string | null,
  artisanId: string,
  secret?: string,
): string | null {
  if (!userId) return null;
  const key = secret ?? env.server.PSEUDONYM_SECRET;
  return createHmac('sha256', key)
    .update(`${userId}:${artisanId}`)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase();
}
