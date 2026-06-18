// Story 2.2 (AC2/AC5) — couche de recherche FTS pure : sélection config par
// locale, assainissement de requête, fusion des ensembles de matches.

import { describe, it, expect } from 'vitest';
import {
  nameFtsTarget,
  COMMENT_FTS,
  sanitizeQuery,
  hasQuery,
  mergeArtisanIds,
  MAX_QUERY_LENGTH,
} from './fts';

describe('nameFtsTarget', () => {
  it('FR → config french sur display_name_fr_tsv', () => {
    expect(nameFtsTarget('fr')).toEqual({
      column: 'display_name_fr_tsv',
      config: 'french',
    });
  });

  it('AR → config simple sur display_name_ar_tsv (pas de config arabic — ADR 0001)', () => {
    expect(nameFtsTarget('ar')).toEqual({
      column: 'display_name_ar_tsv',
      config: 'simple',
    });
  });
});

describe('COMMENT_FTS', () => {
  it('cible toujours comment_tsv en français', () => {
    expect(COMMENT_FTS).toEqual({ column: 'comment_tsv', config: 'french' });
  });
});

describe('sanitizeQuery', () => {
  it('null / undefined / vide → chaîne vide', () => {
    expect(sanitizeQuery(null)).toBe('');
    expect(sanitizeQuery(undefined)).toBe('');
    expect(sanitizeQuery('')).toBe('');
  });

  it('espaces uniquement → chaîne vide', () => {
    expect(sanitizeQuery('   ')).toBe('');
    expect(sanitizeQuery('\t\n  ')).toBe('');
  });

  it('collapse les espaces internes et trim', () => {
    expect(sanitizeQuery('  plombier   chauffagiste  ')).toBe('plombier chauffagiste');
  });

  it('préserve les caractères spéciaux (websearch_to_tsquery les absorbe)', () => {
    expect(sanitizeQuery('"plombier" or peintre -menuisier')).toBe(
      '"plombier" or peintre -menuisier',
    );
  });

  it('préserve l’arabe', () => {
    expect(sanitizeQuery('  سباك  ')).toBe('سباك');
  });

  it('tronque à MAX_QUERY_LENGTH', () => {
    const long = 'a'.repeat(MAX_QUERY_LENGTH + 50);
    expect(sanitizeQuery(long)).toHaveLength(MAX_QUERY_LENGTH);
  });

  it('tronque par code points (Unicode safe, review F15)', () => {
    // 🔧 = U+1F527 = surrogate pair UTF-16 (2 code units, 1 code point).
    // Si on tronque en UTF-16, on splitte la paire et on génère un caractère
    // malformé. La sortie doit rester un Unicode valide.
    const emoji = '🔧';
    const long = emoji.repeat(MAX_QUERY_LENGTH + 5);
    const out = sanitizeQuery(long);
    // Array.from itère par code point → MAX_QUERY_LENGTH code points.
    expect(Array.from(out)).toHaveLength(MAX_QUERY_LENGTH);
    // Pas de surrogate isolé : décoder/réencoder doit être identité.
    expect([...out].every((c) => c === emoji)).toBe(true);
  });

  it('est déterministe', () => {
    expect(sanitizeQuery(' Hassan ')).toBe(sanitizeQuery(' Hassan '));
  });
});

describe('hasQuery', () => {
  it('vrai pour une requête non vide, faux sinon', () => {
    expect(hasQuery('plombier')).toBe(true);
    expect(hasQuery('   ')).toBe(false);
    expect(hasQuery(null)).toBe(false);
  });
});

describe('mergeArtisanIds', () => {
  it('déduplique en gardant l’ordre, noms d’abord', () => {
    expect(mergeArtisanIds(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('ensembles vides → vide', () => {
    expect(mergeArtisanIds([], [])).toEqual([]);
  });

  it('matches commentaires seuls', () => {
    expect(mergeArtisanIds([], ['x', 'x', 'y'])).toEqual(['x', 'y']);
  });
});
