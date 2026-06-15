import { describe, it, expect } from 'vitest';
import { zVillaNumber } from './villa-number';

describe('zVillaNumber', () => {
  it('accepte 1 (borne basse)', () => {
    expect(zVillaNumber.safeParse(1).success).toBe(true);
  });

  it('accepte 150 (borne haute)', () => {
    expect(zVillaNumber.safeParse(150).success).toBe(true);
  });

  it('refuse 0 (hors borne basse)', () => {
    expect(zVillaNumber.safeParse(0).success).toBe(false);
  });

  it('refuse 151 (hors borne haute)', () => {
    expect(zVillaNumber.safeParse(151).success).toBe(false);
  });

  it('refuse un nombre non entier', () => {
    expect(zVillaNumber.safeParse(1.5).success).toBe(false);
  });
});
