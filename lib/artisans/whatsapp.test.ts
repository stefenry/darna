import { describe, expect, it } from 'vitest';
import { waMeUrl } from '@/lib/artisans/whatsapp';

describe('waMeUrl', () => {
  it('numéro marocain E.164 → lien wa.me sans le +', () => {
    expect(waMeUrl('+212600000001')).toBe('https://wa.me/212600000001');
  });

  it('tolère les espaces de saisie', () => {
    expect(waMeUrl('+212 600 000 001')).toBe('https://wa.me/212600000001');
  });

  it('numéro non E.164 (sans +) → null, on n’invente pas d’indicatif', () => {
    expect(waMeUrl('0600000001')).toBeNull();
  });

  it('caractères non numériques → null', () => {
    expect(waMeUrl('+212ABC000001')).toBeNull();
  });

  it('chaîne vide, null, undefined → null', () => {
    expect(waMeUrl('')).toBeNull();
    expect(waMeUrl(null)).toBeNull();
    expect(waMeUrl(undefined)).toBeNull();
  });

  it('longueur invraisemblable → null (garde-fou anti-lien cassé)', () => {
    expect(waMeUrl('+21')).toBeNull();
    expect(waMeUrl(`+${'9'.repeat(20)}`)).toBeNull();
  });
});
