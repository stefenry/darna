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

  it('rejette un téléphone non +212', () => {
    expect(zCreateArtisanForm.safeParse({ ...VALID, phone: '0600000001' }).success).toBe(false);
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
