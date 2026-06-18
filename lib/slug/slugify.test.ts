// Story 2.1 (AC6) — cas limites slugify : diacritiques FR, lettres arabes,
// scripts mixtes, troncature 60. + résolution de collision déterministe.

import { describe, it, expect } from 'vitest';
import { slugify, withCollisionSuffix } from './slugify';

describe('slugify', () => {
  it('latin simple → kebab-case', () => {
    expect(slugify('Hassan le Plombier')).toBe('hassan-le-plombier');
  });

  it('arabe → translittération consonantique (fixture AC5)', () => {
    // حسن (ح→h س→s ن→n) + السباك (ا∅ ل→l س→s ب→b ا∅ ك→k).
    expect(slugify('حسن السباك')).toBe('hsn-lsbk');
  });

  it('diacritiques FR normalisés', () => {
    expect(slugify('Électricité Générale')).toBe('electricite-generale');
    expect(slugify('Plomberie à côté')).toBe('plomberie-a-cote');
  });

  it('scripts mixtes latin + arabe', () => {
    expect(slugify('Café حسن 2024')).toBe('cafe-hsn-2024');
  });

  it('ponctuation et séparateurs multiples collapsés', () => {
    expect(slugify('  Jean--Pierre & Fils !!! ')).toBe('jean-pierre-fils');
  });

  it('chaîne vide / sans caractère alphanumérique → vide', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ---  ')).toBe('');
    expect(slugify('!@#$%')).toBe('');
  });

  it('nom très long tronqué à 60 caractères sans `-` final', () => {
    // 10 mots de 8 lettres séparés par espaces → bien > 60 chars.
    const longName = Array.from({ length: 10 }, (_, i) => `artisan${i}`).join(' ');
    const result = slugify(longName);
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result.endsWith('-')).toBe(false);
    expect(result.startsWith('artisan0-artisan1')).toBe(true);
  });

  it('est déterministe (même entrée → même sortie)', () => {
    expect(slugify('حسن السباك')).toBe(slugify('حسن السباك'));
    expect(slugify('Électricité Générale')).toBe(slugify('Électricité Générale'));
  });
});

describe('withCollisionSuffix', () => {
  it('renvoie la base si libre', () => {
    expect(withCollisionSuffix('hassan-le-plombier', [])).toBe('hassan-le-plombier');
    expect(withCollisionSuffix('hassan-le-plombier', ['autre'])).toBe('hassan-le-plombier');
  });

  it('ajoute -2 sur première collision', () => {
    expect(withCollisionSuffix('hassan', ['hassan'])).toBe('hassan-2');
  });

  it('incrémente jusqu’au premier suffixe libre', () => {
    expect(withCollisionSuffix('hassan', ['hassan', 'hassan-2', 'hassan-3'])).toBe('hassan-4');
  });

  it('accepte un Set comme un tableau', () => {
    expect(withCollisionSuffix('hassan', new Set(['hassan', 'hassan-2']))).toBe('hassan-3');
  });
});
