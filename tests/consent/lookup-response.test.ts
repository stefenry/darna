// Story 2.8 — test unitaire de resolveResponseToken (mock du client admin).
// Statuts valid/expired/used/invalid + masquage phone. Le filtre purpose et le
// scope RLS réels sont couverts gated (rls / consent-respond-rpc).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tokenRow: unknown;
let ratingRows: unknown[];

vi.mock('@/lib/env', () => ({
  env: { server: { CONSENT_TOKEN_SECRET: 'test-secret' } },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const b = {
        select: () => b,
        eq: () => b,
        is: () => b,
        order: () => b,
        maybeSingle: async () => ({ data: tokenRow, error: null }),
        limit: async () => ({ data: table === 'ratings' ? ratingRows : [], error: null }),
      };
      return b;
    },
  }),
}));

import { resolveResponseToken } from '@/lib/consent/lookup-response';

const RAW = 'a'.repeat(40); // longueur valide (≥16, ≤200)

function validArtisan(overrides: Record<string, unknown> = {}) {
  return {
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    used_at: null,
    purpose: 'respond',
    artisans: {
      id: 'art-1',
      slug: 'hassan',
      display_name_fr: 'Hassan Plombier',
      display_name_ar: null,
      phone_e164: '+212600000001',
      state: 'published',
      deleted_at: null,
      artisan_tags: [{ tags: { key: 'plomberie', label_fr: 'Plomberie', label_ar: null } }],
      ...overrides,
    },
  };
}

beforeEach(() => {
  tokenRow = validArtisan();
  ratingRows = [];
});
afterEach(() => vi.restoreAllMocks());

describe('resolveResponseToken', () => {
  it('valid → fiche masquée + tags', async () => {
    const r = await resolveResponseToken(RAW, 'fr');
    expect(r.status).toBe('valid');
    if (r.status === 'valid') {
      expect(r.displayName).toBe('Hassan Plombier');
      expect(r.phoneMasked).toBe('+212 •• •• •• 01');
      expect(r.tags).toEqual(['Plomberie']);
    }
  });

  it('raw trop court → invalid', async () => {
    const r = await resolveResponseToken('short', 'fr');
    expect(r.status).toBe('invalid');
  });

  it('token absent (ou cross-purpose filtré) → invalid', async () => {
    tokenRow = null;
    const r = await resolveResponseToken(RAW, 'fr');
    expect(r.status).toBe('invalid');
  });

  it('artisan retiré (state != published) → invalid (AR38)', async () => {
    tokenRow = validArtisan({ state: 'refused' });
    const r = await resolveResponseToken(RAW, 'fr');
    expect(r.status).toBe('invalid');
  });

  it('token déjà utilisé → used', async () => {
    tokenRow = { ...(validArtisan() as object), used_at: new Date().toISOString() };
    const r = await resolveResponseToken(RAW, 'fr');
    expect(r.status).toBe('used');
  });

  it('token expiré → expired', async () => {
    tokenRow = {
      ...(validArtisan() as object),
      expires_at: new Date(Date.now() - 1000).toISOString(),
    };
    const r = await resolveResponseToken(RAW, 'fr');
    expect(r.status).toBe('expired');
  });

  it('mappe les ratings récents pour le sélecteur de cible', async () => {
    ratingRows = [
      {
        id: 'r1',
        created_at: '2026-06-01T10:00:00Z',
        comment_text: 'Très bien',
        score_depannage: 5,
      },
    ];
    const r = await resolveResponseToken(RAW, 'fr');
    expect(r.status).toBe('valid');
    if (r.status === 'valid') {
      expect(r.recentRatings).toHaveLength(1);
      expect(r.recentRatings[0]?.summary).toBe('Très bien');
    }
  });
});
