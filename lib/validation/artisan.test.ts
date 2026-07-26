import { describe, it, expect } from 'vitest';
import { zCreateArtisanForm, mapArtisanFieldError } from './artisan';

const VALID = {
  display_name_fr: 'Hassan Plombier',
  phone: '+212600000001',
  tag_keys: ['plomberie'],
  price_relative: '$$',
  has_invoice: 'oui',
  visibility: 'pseudonym',
  consent_confirmed: true,
};

describe('zCreateArtisanForm', () => {
  it('accepte un formulaire valide', () => {
    expect(zCreateArtisanForm.safeParse(VALID).success).toBe(true);
  });

  it('rejette si consentement non coché → consent_required', () => {
    const r = zCreateArtisanForm.safeParse({ ...VALID, consent_confirmed: false });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('errors.artisan.consent_required');
  });

  it('rejette display_name_fr vide', () => {
    expect(zCreateArtisanForm.safeParse({ ...VALID, display_name_fr: '' }).success).toBe(false);
  });

  it('rejette 0 tag', () => {
    expect(zCreateArtisanForm.safeParse({ ...VALID, tag_keys: [] }).success).toBe(false);
  });

  // 2026-07-26 — la saisie s'est assouplie : autres pays autorisés, séparateurs
  // tolérés, local marocain complété. Seul un numéro non conforme à E.164 est
  // encore refusé.
  it('accepte un numéro étranger (E.164 international)', () => {
    expect(zCreateArtisanForm.safeParse({ ...VALID, phone: '+33612345678' }).success).toBe(true);
  });

  it('accepte un local marocain et le normalise en +212', () => {
    const r = zCreateArtisanForm.safeParse({ ...VALID, phone: '06 00 00 00 01' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe('+212600000001');
  });

  it('rejette un téléphone qui n’est pas un E.164 valide', () => {
    expect(zCreateArtisanForm.safeParse({ ...VALID, phone: '12345' }).success).toBe(false);
  });

  it('rejette un commentaire > 500 caractères', () => {
    expect(zCreateArtisanForm.safeParse({ ...VALID, comment: 'a'.repeat(501) }).success).toBe(
      false,
    );
  });

  it('accepte display_name_ar et comment vides', () => {
    expect(
      zCreateArtisanForm.safeParse({ ...VALID, display_name_ar: '', comment: '' }).success,
    ).toBe(true);
  });
});

describe('mapArtisanFieldError', () => {
  it('mappe chaque champ sur une clé i18n', () => {
    expect(mapArtisanFieldError('phone')).toBe('errors.artisan.phone_invalid');
    expect(mapArtisanFieldError('tag_keys')).toBe('errors.artisan.tags_required');
    expect(mapArtisanFieldError('consent_confirmed')).toBe('errors.artisan.consent_required');
  });
});
