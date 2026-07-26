import { describe, it, expect } from 'vitest';
import { normalizePhoneInput, zPhoneE164 } from './phone-e164';

describe('normalizePhoneInput', () => {
  it('supprime les espaces d’un copier-coller', () => {
    expect(normalizePhoneInput('+212 6 12 34 56 78')).toBe('+212612345678');
  });

  it('supprime aussi les espaces insécables (contacts iOS, Word)', () => {
    expect(normalizePhoneInput('+212 6 12 34 56 78')).toBe('+212612345678');
  });

  it('supprime points, tirets et parenthèses', () => {
    expect(normalizePhoneInput('+212-6.12.34.56.78')).toBe('+212612345678');
    expect(normalizePhoneInput('+33 (0)6 12 34 56 78')).toBe('+33612345678');
  });

  it('convertit le préfixe international 00 en +', () => {
    expect(normalizePhoneInput('00212612345678')).toBe('+212612345678');
  });

  it('complète un numéro local marocain (0…) en +212', () => {
    expect(normalizePhoneInput('0612345678')).toBe('+212612345678');
    expect(normalizePhoneInput('06 12 34 56 78')).toBe('+212612345678');
  });

  it('laisse intact un E.164 déjà propre', () => {
    expect(normalizePhoneInput('+212612345678')).toBe('+212612345678');
  });

  it('ne fabrique rien à partir du vide', () => {
    expect(normalizePhoneInput('   ')).toBe('');
  });
});

describe('zPhoneE164', () => {
  it('accepte un numéro marocain', () => {
    expect(zPhoneE164.safeParse('+212612345678').success).toBe(true);
  });

  it('accepte les autres pays (France, Espagne, Canada)', () => {
    for (const n of ['+33612345678', '+34612345678', '+15145551234']) {
      expect(zPhoneE164.safeParse(n).success).toBe(true);
    }
  });

  it('accepte une saisie avec espaces : la normalisation précède la validation', () => {
    const r = zPhoneE164.safeParse('+212 6 12 34 56 78');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe('+212612345678');
  });

  it('accepte un local marocain et le normalise', () => {
    const r = zPhoneE164.safeParse('06 12 34 56 78');
    expect(r.success && r.data).toBe('+212612345678');
  });

  it('refuse un numéro trop court', () => {
    expect(zPhoneE164.safeParse('+2126123').success).toBe(false);
  });

  it('refuse un numéro trop long (> 15 chiffres, hors E.164)', () => {
    expect(zPhoneE164.safeParse('+2126123456789012').success).toBe(false);
  });

  it('refuse un indicatif commençant par 0 (E.164 l’interdit)', () => {
    expect(zPhoneE164.safeParse('+0612345678').success).toBe(false);
  });

  it('refuse des lettres', () => {
    expect(zPhoneE164.safeParse('+212ABC345678').success).toBe(false);
  });

  it('refuse le vide', () => {
    expect(zPhoneE164.safeParse('').success).toBe(false);
  });
});
