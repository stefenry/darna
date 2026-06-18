// Story 2.2 (AC2/AC5) — couche de recherche plein-texte bilingue, pure (aucune
// I/O). Construit les arguments de `.textSearch(col, q, { type: 'websearch' })`
// du client supabase-js ; l'exécution RLS-scopée vit dans la page (Server
// Component) et le route handler.
//
// Décisions (story 2.1 §FTS, ADR 0001) :
//   - FR = config `french` sur `display_name_fr_tsv`.
//   - AR = config `simple` sur `display_name_ar_tsv` (Postgres n'a PAS de config
//     `arabic` ; le fuzzy AR repose sur pg_trgm, hors de ce builder).
//   - Les commentaires (`ratings.comment_tsv`) sont stockés en `french` au MVP.
//   - On NE construit JAMAIS de tsquery à la main : `websearch_to_tsquery` (côté
//     Postgres, via `type: 'websearch'`) absorbe sans risque guillemets/`or`/`-`.

import type { Locale } from '@/lib/i18n/config';

export const MAX_QUERY_LENGTH = 100;

export type FtsTarget = {
  /** Colonne tsvector du nom d'artisan à interroger. */
  column: 'display_name_fr_tsv' | 'display_name_ar_tsv';
  /** Configuration de recherche Postgres. */
  config: 'french' | 'simple';
};

/** tsvector + config FTS du nom d'artisan pour la locale d'exécution. */
export function nameFtsTarget(locale: Locale): FtsTarget {
  return locale === 'ar'
    ? { column: 'display_name_ar_tsv', config: 'simple' }
    : { column: 'display_name_fr_tsv', config: 'french' };
}

/** Recherche commentaires : toujours le `comment_tsv` français (MVP). */
export const COMMENT_FTS = {
  column: 'comment_tsv',
  config: 'french',
} as const;

/**
 * Normalise une requête utilisateur avant `.textSearch(..., { type: 'websearch' })` :
 * - collapse des espaces + trim
 * - troncature à {@link MAX_QUERY_LENGTH} (garde-fou requêtes géantes)
 * - chaîne vide / blancs uniquement → '' (signal « pas de filtre FTS »)
 *
 * Pure et déterministe. NE construit pas de tsquery (délégué à Postgres).
 */
export function sanitizeQuery(raw: string | null | undefined): string {
  if (!raw) return '';
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  // `String.prototype.slice` opère sur unités UTF-16 → peut splitter une paire
  // de surrogates (Arabic combining, emoji) en milieu de codepoint et envoyer
  // du UTF-16 malformé à `websearch_to_tsquery`. `Array.from` itère par code
  // points : tronquer sur ce tableau garantit l'intégrité Unicode.
  const codePoints = Array.from(collapsed);
  if (codePoints.length <= MAX_QUERY_LENGTH) return collapsed;
  return codePoints.slice(0, MAX_QUERY_LENGTH).join('');
}

/** `true` si la requête, une fois assainie, déclenche une recherche FTS. */
export function hasQuery(raw: string | null | undefined): boolean {
  return sanitizeQuery(raw).length > 0;
}

/**
 * Fusionne deux ensembles d'`artisan_id` (matches sur le nom + matches sur les
 * commentaires) en une liste dédupliquée, en préservant l'ordre du premier
 * ensemble (les matches de nom priment). Pur — la story 2.2 recombine ainsi les
 * deux tsvectors qui vivent sur des tables distinctes (artisans vs ratings).
 */
export function mergeArtisanIds(nameIds: string[], commentIds: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const id of [...nameIds, ...commentIds]) {
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(id);
    }
  }
  return merged;
}
