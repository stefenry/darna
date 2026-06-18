// @vitest-environment node
// (lookup lit env.server → node env ; le client admin est mocké)
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => mockResult,
        }),
      }),
    }),
  }),
}));

import { resolveConsentToken } from './lookup';

function artisan(extra: Record<string, unknown> = {}) {
  return {
    slug: 'hassan-plombier',
    display_name_fr: 'Hassan',
    display_name_ar: null,
    state: 'pending_consent',
    artisan_tags: [{ tags: { key: 'plomberie', label_fr: 'Plomberie', label_ar: null } }],
    ...extra,
  };
}

const RAW = 'x'.repeat(24);

describe('resolveConsentToken', () => {
  beforeEach(() => {
    mockResult = { data: null, error: null };
  });

  it('raw trop court → invalid sans lookup', async () => {
    expect((await resolveConsentToken('short', 'fr')).status).toBe('invalid');
  });

  it('token introuvable → invalid (AR38 : ne révèle rien)', async () => {
    mockResult = { data: null, error: null };
    expect((await resolveConsentToken(RAW, 'fr')).status).toBe('invalid');
  });

  it('token utilisé → used + état artisan', async () => {
    mockResult = {
      data: {
        used_at: '2026-01-01T00:00:00Z',
        expires_at: '2030-01-01T00:00:00Z',
        artisans: artisan({ state: 'published' }),
      },
      error: null,
    };
    const r = await resolveConsentToken(RAW, 'fr');
    expect(r.status).toBe('used');
    if (r.status === 'used') expect(r.state).toBe('published');
  });

  it('token expiré → expired', async () => {
    mockResult = {
      data: { used_at: null, expires_at: '2020-01-01T00:00:00Z', artisans: artisan() },
      error: null,
    };
    expect((await resolveConsentToken(RAW, 'fr')).status).toBe('expired');
  });

  it('token valide → valid avec nom + tags (locale)', async () => {
    mockResult = {
      data: { used_at: null, expires_at: '2030-01-01T00:00:00Z', artisans: artisan() },
      error: null,
    };
    const r = await resolveConsentToken(RAW, 'fr');
    expect(r.status).toBe('valid');
    if (r.status === 'valid') {
      expect(r.displayName).toBe('Hassan');
      expect(r.tags).toEqual(['Plomberie']);
    }
  });
});
