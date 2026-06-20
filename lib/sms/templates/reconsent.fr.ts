// Story 2.7 code review P22 (D3) — SMS dédié au re-consent d'un artisan déjà
// publié dont un voisin propose une modif PII (nom et/ou téléphone). Wording
// distinct du `consent.fr.ts` (qui annonce la PUBLICATION initiale).
//
// Hardening sanitize : strip control + bidi (NFC + truncate ~40 chars), pattern
// review 2.4 P3 réutilisé.

export type ReconsentSmsVars = {
  artisanName: string;
  link: string;
};

const MAX_NAME_LEN = 40;
const CONTROL_AND_BIDI = new RegExp(
  '[\\u0000-\\u001F\\u007F-\\u009F\\u00AD\\u200B-\\u200F\\u202A-\\u202E\\u2060\\u2066-\\u2069\\uFEFF]',
  'g',
);

function sanitizeArtisanName(raw: string): string {
  const normalized = raw.normalize('NFC').replace(CONTROL_AND_BIDI, '').trim();
  if (normalized.length === 0) return 'voisin';
  return normalized.length > MAX_NAME_LEN
    ? `${normalized.slice(0, MAX_NAME_LEN - 1).trimEnd()}…`
    : normalized;
}

export function reconsentSmsTemplate({ artisanName, link }: ReconsentSmsVars): string {
  const safe = sanitizeArtisanName(artisanName);
  return `Darna : ${safe}, un voisin propose une mise a jour de votre fiche. Confirmez ou refusez (gratuit, sans compte) : ${link}`;
}
