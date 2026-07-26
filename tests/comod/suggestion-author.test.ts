// @vitest-environment node
// Règle d'affichage de l'auteur d'une suggestion : c'est le flag `signed` FIGÉ à
// l'envoi qui décide, PAS la préférence de profil courante.

import { describe, expect, it } from 'vitest';
import { suggestionAuthorLabel } from '@/lib/content/suggestion-author';
import type { NeighbourLabel } from '@/lib/content/author-label';

const base: NeighbourLabel = {
  displayName: 'Salma',
  villa: 42,
  identityMode: 'pseudo',
  pseudonym: 'ABCD',
  deleted: false,
};

describe('suggestionAuthorLabel', () => {
  it('signée → nom + villa, même si le profil est repassé en pseudo', () => {
    expect(suggestionAuthorLabel(true, base)).toEqual({
      kind: 'named',
      name: 'Salma',
      villa: 42,
    });
  });

  it('non signée → pseudonyme, même si le profil est en identité affichée', () => {
    expect(suggestionAuthorLabel(false, { ...base, identityMode: 'identified' })).toEqual({
      kind: 'pseudonym',
      suffix: 'ABCD',
    });
  });

  it('signée sans display_name → pseudonyme (jamais un libellé vide)', () => {
    expect(suggestionAuthorLabel(true, { ...base, displayName: null })).toEqual({
      kind: 'pseudonym',
      suffix: 'ABCD',
    });
  });

  it('signée avec nom mais sans villa → nom seul', () => {
    expect(suggestionAuthorLabel(true, { ...base, villa: null })).toEqual({
      kind: 'named',
      name: 'Salma',
      villa: null,
    });
  });

  it('auteur purgé → deleted, quel que soit signed', () => {
    expect(suggestionAuthorLabel(true, { ...base, deleted: true })).toEqual({ kind: 'deleted' });
    expect(suggestionAuthorLabel(false, { ...base, deleted: true })).toEqual({ kind: 'deleted' });
  });

  it('label absent (user_id null après purge RGPD) → deleted', () => {
    expect(suggestionAuthorLabel(true, undefined)).toEqual({ kind: 'deleted' });
  });
});
