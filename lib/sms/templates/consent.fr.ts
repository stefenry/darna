// Story 2.4 — SMS de consentement artisan (FR ; la locale de l'artisan est
// inconnue à la création → FR par défaut, AR togglable sur la page 2.5).
//
// Hardening (review 2026-06-18 P3) : sanitize `artisanName` avant interpolation
// (strip control chars + bidi controls, normalize NFC, truncate ~40 chars)
// pour éviter (a) multi-segment GSM-7 → coût ×N, (b) injection visuelle
// (RTL override / zalgo), (c) corruption de structure du message.

export type ConsentSmsVars = {
  artisanName: string;
  link: string;
};

const MAX_NAME_LEN = 40;

// C0/C1 controls + soft hyphen + zero-width + bidi controls + BOM.
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

export function consentSmsTemplate({ artisanName, link }: ConsentSmsVars): string {
  const safe = sanitizeArtisanName(artisanName);
  return `Darna : ${safe}, un voisin vous recommande sur l'annuaire de votre residence. Confirmez votre fiche (gratuit, sans compte) : ${link}`;
}
