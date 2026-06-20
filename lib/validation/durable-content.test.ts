// Story 3.5 (Task 3 / AC2/AC3/AC8) — validation Zod contenu durable.

import { describe, it, expect } from 'vitest';
import {
  zGuideEntry,
  zUsefulNumber,
  zPackEntry,
  resolveGuideSlug,
  mapDurableFieldError,
} from '@/lib/validation/durable-content';

describe('zGuideEntry', () => {
  const base = {
    theme_key: 'codes_portails',
    title_fr: 'Code du portail',
    body_fr_markdown: 'Le code est **1234**.',
    order_in_theme: '0',
  };

  it('accepte FR rempli, AR optionnel', () => {
    const r = zGuideEntry.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.title_ar).toBeNull();
      expect(r.data.order_in_theme).toBe(0);
    }
  });

  it('refuse title_fr vide', () => {
    const r = zGuideEntry.safeParse({ ...base, title_fr: '   ' });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(mapDurableFieldError(String(r.error.issues[0]!.path[0]))).toBe('fr_required');
  });

  it('refuse un thème hors enum', () => {
    const r = zGuideEntry.safeParse({ ...base, theme_key: 'inexistant' });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(mapDurableFieldError(String(r.error.issues[0]!.path[0]))).toBe('theme_invalid');
  });

  it('refuse un ordre négatif', () => {
    const r = zGuideEntry.safeParse({ ...base, order_in_theme: '-1' });
    expect(r.success).toBe(false);
  });
});

describe('zUsefulNumber', () => {
  const base = {
    category_key: 'securite',
    label_fr: 'Poste de garde',
    phone_e164: '+212600000001',
    order_in_category: '0',
  };

  it('accepte un E.164 valide', () => {
    expect(zUsefulNumber.safeParse(base).success).toBe(true);
  });

  it('refuse un téléphone non E.164', () => {
    const r = zUsefulNumber.safeParse({ ...base, phone_e164: '0600000001' });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(mapDurableFieldError(String(r.error.issues[0]!.path[0]))).toBe('phone_invalid');
  });

  it('refuse une catégorie hors enum', () => {
    const r = zUsefulNumber.safeParse({ ...base, category_key: 'x' });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(mapDurableFieldError(String(r.error.issues[0]!.path[0]))).toBe('category_invalid');
  });
});

describe('zPackEntry', () => {
  it('exige section + FR', () => {
    expect(
      zPackEntry.safeParse({
        section_key: 'Codes portails',
        title_fr: 'Portail',
        body_fr_markdown: 'x',
        order_in_section: '0',
      }).success,
    ).toBe(true);
    const r = zPackEntry.safeParse({
      section_key: '',
      title_fr: 'x',
      body_fr_markdown: 'y',
      order_in_section: '0',
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(mapDurableFieldError(String(r.error.issues[0]!.path[0]))).toBe('section_required');
  });
});

describe('resolveGuideSlug', () => {
  it('slugifie le slug fourni', () => {
    expect(resolveGuideSlug({ slug: 'Code Portail', title_fr: 'x' })).toBe('code-portail');
  });
  it('auto-génère depuis title_fr si slug absent', () => {
    expect(resolveGuideSlug({ slug: '', title_fr: 'Horaires Gardien' })).toBe('horaires-gardien');
  });
});
