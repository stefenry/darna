import { z } from 'zod';

// Numéro de téléphone au format E.164 international.
//
// 2026-07-26 — assoupli suite aux retours bêta : la saisie était refusée dès qu'un
// espace traînait (un copier-coller depuis les contacts en laisse toujours) et
// seul le Maroc était accepté. On NORMALISE donc avant de valider, et on accepte
// n'importe quel indicatif pays.
//
// La regex est celle que la base applique déjà sur `useful_numbers.phone_e164`
// (migration 20260628090000) : une seule définition de « E.164 valide » dans le
// projet.
const E164 = /^\+[1-9]\d{7,14}$/;

// Indicatif par défaut quand l'utilisateur saisit un numéro local (« 06… ») :
// la résidence est au Maroc.
const DEFAULT_COUNTRY_CODE = '+212';

// Espaces (dont insécable U+00A0 et insécable étroit U+202F, très fréquents dans
// un copier-coller), points, tirets (dont demi-cadratin et cadratin), parenthèses
// et barres obliques.
const SEPARATORS = /[\s  .\-–—()/]/g;

/**
 * Nettoie une saisie utilisateur en E.164 exploitable. Ne valide RIEN : renvoie la
 * meilleure interprétation possible, à charge de `zPhoneE164` de la refuser si
 * elle n'est pas conforme.
 */
export function normalizePhoneInput(raw: string): string {
  // « +33 (0)6 12… » : le zéro entre parenthèses est le préfixe national, il ne se
  // compose PAS en international. On le retire avant de nettoyer le reste, sinon
  // il resterait collé à l'indicatif (+330612…).
  const compact = raw.replace(/\(\s*0\s*\)/g, '').replace(SEPARATORS, '');
  if (compact.length === 0) return '';

  // Préfixe international composé : 00212… → +212…
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;

  // Numéro local : on préfixe avec l'indicatif du pays de la résidence.
  if (compact.startsWith('0')) return `${DEFAULT_COUNTRY_CODE}${compact.slice(1)}`;

  return compact;
}

export const zPhoneE164 = z
  .string()
  .transform(normalizePhoneInput)
  .pipe(
    z.string().regex(E164, 'Numéro invalide (format international attendu, ex. +212612345678)'),
  );

export type PhoneE164 = z.infer<typeof zPhoneE164>;
