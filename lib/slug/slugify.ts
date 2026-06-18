// Story 2.1 (AC5/AC6) — slugify déterministe FR + AR, sans dépendance externe.
//
// Génère un slug ASCII kebab-case stable à partir d'un nom d'artisan, en FR
// (diacritiques normalisés) comme en AR (translittération consonantique). Pure,
// aucune I/O : la résolution de collision contre la DB est câblée en story 2.4
// via `withCollisionSuffix`.

// Table de translittération arabe → ASCII (consonantique). Les voyelles longues
// alif (ا) et la hamza (ء et porteurs) sont supprimées ; و/ي gardent w/y (choix
// déterministe assumé — cf. story 2.1 Dev Notes §Slugify, table ambiguë tranchée
// en faveur du mapping explicite و→w / ي→y, seul ا étant contraint par les AC).
const ARABIC_MAP: Record<string, string> = {
  ا: '',
  أ: '',
  إ: '',
  آ: '',
  ء: '',
  ؤ: '',
  ئ: '',
  ى: '',
  ب: 'b',
  ت: 't',
  ث: 'th',
  ج: 'j',
  ح: 'h',
  خ: 'kh',
  د: 'd',
  ذ: 'd',
  ر: 'r',
  ز: 'z',
  س: 's',
  ش: 'sh',
  ص: 's',
  ض: 'd',
  ط: 't',
  ظ: 'z',
  ع: 'a',
  غ: 'gh',
  ف: 'f',
  ق: 'q',
  ك: 'k',
  ل: 'l',
  م: 'm',
  ن: 'n',
  ه: 'h',
  ة: 't',
  و: 'w',
  ي: 'y',
};

// Marques à supprimer : diacritiques combinants latins (U+0300–U+036F),
// harakat arabes (U+064B–U+065F + U+0670 alif khanjariyya) et tatweel (U+0640).
const COMBINING_MARKS = /[̀-ًͯ-ٰٟـ]/g;

const MAX_LENGTH = 60;

/**
 * Translittère et normalise `input` en slug ASCII kebab-case déterministe.
 * Tronqué à 60 caractères sans laisser de `-` final.
 */
export function slugify(input: string): string {
  if (!input) return '';

  // 1. Décomposition Unicode (NFKD) + suppression des marques combinantes.
  //    "Électricité" → "Electricite", harakat arabes retirés.
  const decomposed = input.normalize('NFKD').replace(COMBINING_MARKS, '');

  // 2. Translittération arabe lettre par lettre (le latin passe inchangé).
  let transliterated = '';
  for (const ch of decomposed) {
    transliterated += ch in ARABIC_MAP ? ARABIC_MAP[ch] : ch;
  }

  // 3. minuscules ; tout ce qui n'est pas [a-z0-9] → `-` (runs collapsés).
  let slug = transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // 4. Troncature à 60 sans couper sur un `-` final.
  if (slug.length > MAX_LENGTH) {
    slug = slug.slice(0, MAX_LENGTH).replace(/-+$/g, '');
  }

  return slug;
}

/**
 * Renvoie `base` si libre, sinon `base-2`, `base-3`… (premier suffixe libre).
 * Pure et testable sans DB ; l'usage réel (lookup `select 1 from artisans where
 * slug = $1`) sera câblé en story 2.4.
 */
export function withCollisionSuffix(base: string, taken: Set<string> | string[]): string {
  const set = taken instanceof Set ? taken : new Set(taken);
  if (!set.has(base)) return base;
  let n = 2;
  while (set.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
