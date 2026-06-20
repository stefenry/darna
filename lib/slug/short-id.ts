// Story 4.2/4.3 — suffixe court aléatoire pour les slugs de contenu éphémère.
//
// Les alertes / bons plans sont à fort renouvellement et créés par n'importe quel
// résident : un suffixe aléatoire évite la collision sans lookup DB (vs
// `withCollisionSuffix` séquentiel du durable, story 2.4). Sortie en
// [a-z0-9] uniquement → conforme au CHECK slug `^[a-z0-9][a-z0-9-]{0,79}$`.

import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Identifiant court aléatoire (alphanumérique minuscule), par défaut 8 chars. */
export function shortId(len = 8): string {
  const bytes = randomBytes(len);
  let out = '';
  for (const b of bytes) {
    // Biais modulo négligeable pour un suffixe de slug (non cryptographique).
    out += ALPHABET.charAt(b % ALPHABET.length);
  }
  return out;
}
