// Story 6.3 — isCanonicalEntityPath : autorise les chemins canoniques d'entité,
// rejette tout vecteur d'open-redirect.

import { describe, expect, it } from 'vitest';
import { isCanonicalEntityPath } from '@/lib/share/safe-next';

describe('isCanonicalEntityPath', () => {
  it('accepte les 4 types canoniques', () => {
    expect(isCanonicalEntityPath('/artisan/hassan-plombier')).toBe(true);
    expect(isCanonicalEntityPath('/alerte/coupure-eau-ab12')).toBe(true);
    expect(isCanonicalEntityPath('/bon-plan/perceuse-xy')).toBe(true);
    expect(isCanonicalEntityPath('/guide/codes-portails')).toBe(true);
  });

  it('rejette les vecteurs d’open-redirect et chemins hors périmètre', () => {
    for (const bad of [
      '//evil.example/artisan/x',
      '/artisan/hassan?next=//evil',
      '/artisan/', // slug vide
      '/artisan/Hassan', // majuscule hors regex slug
      '/fr/community/artisan/hassan', // préfixé locale, pas canonique
      '/artisanEVIL/hassan',
      '/profil/parametres',
      'artisan/hassan', // pas de slash initial
      '/artisan/hassan\\x',
      '/artisan/has\r\nsan',
      'https://evil.example/artisan/x',
    ]) {
      expect(isCanonicalEntityPath(bad)).toBe(false);
    }
  });
});
