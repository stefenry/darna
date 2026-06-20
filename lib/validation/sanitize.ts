// Story 2.7 — helper de normalisation de nom, extrait de lib/validation/artisan.ts
// pour réutilisation par l'édition (2.7). Strip bidi / zero-width / control chars
// qui spoofent visuellement le nom (RIGHT-TO-LEFT OVERRIDE, ZWJ, soft hyphen, BOM —
// review 2.5 P23). NFC normalise puis collapse les espaces multiples.

const STRIP_CONTROL_AND_BIDI = new RegExp(
  '[\\u0000-\\u001F\\u007F-\\u009F\\u00AD\\u200B-\\u200F\\u202A-\\u202E\\u2060\\u2066-\\u2069\\uFEFF]',
  'g',
);

// Variante qui PRÉSERVE le saut de ligne (\n) — pour les textes libres
// multilignes (droit de réponse 2.8) où les paragraphes ont du sens.
const STRIP_CONTROL_KEEP_NEWLINE = new RegExp(
  '[\\u0000-\\u0009\\u000B-\\u001F\\u007F-\\u009F\\u00AD\\u200B-\\u200F\\u202A-\\u202E\\u2060\\u2066-\\u2069\\uFEFF]',
  'g',
);

export function sanitizeName(s: string): string {
  return s.normalize('NFC').replace(STRIP_CONTROL_AND_BIDI, '').replace(/\s+/g, ' ').trim();
}

/**
 * Story 2.8 — sanitize d'un texte libre saisi par un utilisateur public sans
 * session (droit de réponse / rectification). NFC + strip control/bidi (anti
 * spoof visuel RTL/zalgo) + borne longueur + fallback si vide. `multiline:true`
 * préserve les sauts de ligne (réponse artisan) ; sinon collapse en une ligne.
 */
export function sanitizeUserText(
  raw: string,
  opts: { maxLen: number; fallback?: string; multiline?: boolean },
): string {
  let s = raw.normalize('NFC');
  if (opts.multiline) {
    s = s
      .replace(/\r\n?/g, '\n')
      .replace(STRIP_CONTROL_KEEP_NEWLINE, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } else {
    s = s.replace(STRIP_CONTROL_AND_BIDI, '').replace(/\s+/g, ' ').trim();
  }
  if (s.length === 0) return opts.fallback ?? '';
  return s.length > opts.maxLen ? s.slice(0, opts.maxLen).trimEnd() : s;
}
