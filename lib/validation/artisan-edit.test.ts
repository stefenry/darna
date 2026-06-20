import { describe, it, expect } from 'vitest';
import { zEditArtisanForm, mapEditArtisanFieldError, zRetractArtisanConfirm } from './artisan-edit';

describe('zEditArtisanForm', () => {
  const base = {
    display_name_fr: 'Hassan Plombier',
    phone: '+212600000001',
    tag_keys: ['plomberie'],
  };

  it('accepte une édition valide (pas de consent_confirmed requis)', () => {
    const r = zEditArtisanForm.safeParse(base);
    expect(r.success).toBe(true);
  });

  it('exige au moins 1 compétence', () => {
    const r = zEditArtisanForm.safeParse({ ...base, tag_keys: [] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path[0]).toBe('tag_keys');
  });

  it('rejette un téléphone non E.164', () => {
    const r = zEditArtisanForm.safeParse({ ...base, phone: '06 12' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path[0]).toBe('phone');
  });

  it('strip les caractères bidi/control du nom (sanitizeName)', () => {
    const r = zEditArtisanForm.safeParse({ ...base, display_name_fr: 'Has‮san' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.display_name_fr).toBe('Hassan');
  });

  it('rejette un nom vide', () => {
    const r = zEditArtisanForm.safeParse({ ...base, display_name_fr: '   ' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path[0]).toBe('display_name_fr');
  });
});

describe('mapEditArtisanFieldError', () => {
  it('mappe sur les clés errors.artisan.* existantes', () => {
    expect(mapEditArtisanFieldError('phone')).toBe('errors.artisan.phone_invalid');
    expect(mapEditArtisanFieldError('tag_keys')).toBe('errors.artisan.tags_required');
    expect(mapEditArtisanFieldError('display_name_fr')).toBe(
      'errors.artisan.display_name_required',
    );
  });
});

describe('zRetractArtisanConfirm', () => {
  it('accepte la phrase exacte RETIRER', () => {
    expect(zRetractArtisanConfirm.safeParse({ confirm: 'RETIRER' }).success).toBe(true);
  });
  it('rejette une casse différente', () => {
    expect(zRetractArtisanConfirm.safeParse({ confirm: 'retirer' }).success).toBe(false);
  });
});
