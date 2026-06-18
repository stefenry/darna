// Story 2.4 — résolution de collision de slug contre la DB. Câble la fonction
// pure `withCollisionSuffix` (2.1) avec un lookup des slugs déjà pris. Le lookup
// est injecté → testable sans DB ; l'usage réel passe une requête
// `artisans.slug like '<base>%'` (inclut les tombstones — slug unique global, 2.1).

import { slugify, withCollisionSuffix } from './slugify';

export type SlugLookup = (base: string) => Promise<string[]>;

const FALLBACK_BASE = 'artisan';

/**
 * Renvoie un slug unique pour `displayName` : `slugify` → résolution de
 * collision. Un nom 100% non-translittérable (slug vide) retombe sur `artisan`.
 */
export async function resolveUniqueSlug(displayName: string, lookup: SlugLookup): Promise<string> {
  const base = slugify(displayName) || FALLBACK_BASE;
  const taken = await lookup(base);
  return withCollisionSuffix(base, taken);
}
