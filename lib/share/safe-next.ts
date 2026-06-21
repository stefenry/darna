// Story 6.3 — validation d'un chemin de redirection post-login pointant vers une
// ENTITÉ canonique (`/artisan/<slug>`, `/alerte/<slug>`, `/bon-plan/<slug>`,
// `/guide/<slug>`). Match strict full-string sur caractères sûrs → exclut par
// construction `//`, backslash, CR/LF, query, et tout préfixe `…EVIL`.

import { CANONICAL_SEGMENT } from './entities';

const SEGMENTS = Object.values(CANONICAL_SEGMENT).join('|');
const CANONICAL_ENTITY_RE = new RegExp(`^/(?:${SEGMENTS})/[a-z0-9][a-z0-9-]{0,79}$`);

/** Vrai si `path` est un chemin canonique d'entité partageable (locale-less). */
export function isCanonicalEntityPath(path: string): boolean {
  return CANONICAL_ENTITY_RE.test(path);
}
