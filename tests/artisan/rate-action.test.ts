// @vitest-environment node
// Story 2.6 — submitRating : insert/update, garde rôle, validation, rate-limit.
// Le client Supabase est mocké (chaînes select/insert/update) ; RLS réelle testée
// en gated (tests/rls.test.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireResidentMock = vi.fn();
const checkLimitMock = vi.fn();
const revalidateMock = vi.fn();
const logMock = vi.fn();

let cfg: {
  users: unknown;
  artisan: unknown;
  existing: unknown;
  insertError: unknown;
  updateError: unknown;
};
let calls: {
  inserts: { table: string; payload: Record<string, unknown> }[];
  updates: { table: string; payload: Record<string, unknown> }[];
};

vi.mock('@/lib/auth/require-resident', () => ({ requireResident: () => requireResidentMock() }));
vi.mock('@/lib/rate-limit', () => ({ checkLimit: () => checkLimitMock() }));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidateMock(p) }));
vi.mock('@/lib/logger', () => ({ log: (e: unknown) => logMock(e) }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => ({
      select: () => {
        const b = {
          eq: () => b,
          maybeSingle: async () => {
            if (table === 'users') return { data: cfg.users, error: null };
            if (table === 'artisans') return { data: cfg.artisan, error: null };
            if (table === 'ratings') return { data: cfg.existing, error: null };
            return { data: null, error: null };
          },
        };
        return b;
      },
      insert: async (payload: Record<string, unknown>) => {
        calls.inserts.push({ table, payload });
        return { error: cfg.insertError ?? null };
      },
      update: (payload: Record<string, unknown>) => {
        calls.updates.push({ table, payload });
        return {
          eq: async () => ({ error: table === 'ratings' ? (cfg.updateError ?? null) : null }),
        };
      },
    }),
  }),
}));

import { submitRating } from '@/app/[locale]/community/artisan/[slug]/noter/actions';
import { RATING_INITIAL } from '@/app/[locale]/community/artisan/[slug]/noter/state';

const USER = { id: 'user-1' };

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  f.set('slug', 'hassan-plombier');
  f.set('locale', 'fr');
  f.set('visibility', 'pseudonym');
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  cfg = {
    users: { residence_id: 'res-1', role: 'resident' },
    artisan: { id: 'art-1', state: 'published' },
    existing: null,
    insertError: null,
    updateError: null,
  };
  calls = { inserts: [], updates: [] };
  requireResidentMock.mockReset().mockResolvedValue({ ok: true, user: USER });
  checkLimitMock.mockReset().mockResolvedValue({ success: true, reset: 0 });
  revalidateMock.mockReset();
  logMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('submitRating', () => {
  it('insère une nouvelle note (axes NA → NULL) + mémorise identity_mode + revalidate', async () => {
    const res = await submitRating(
      RATING_INITIAL,
      fd({ score_depannage: '5', visibility: 'named' }),
    );
    expect(res.ok).toBe(true);
    const ins = calls.inserts.find((c) => c.table === 'ratings');
    expect(ins).toBeDefined();
    expect(ins?.payload.score_depannage).toBe(5);
    expect(ins?.payload.score_petits_travaux).toBeNull();
    expect(ins?.payload.user_id).toBe('user-1');
    expect(ins?.payload.residence_id).toBe('res-1');
    expect(ins?.payload.visibility).toBe('named');
    const prof = calls.updates.find((c) => c.table === 'profiles');
    expect(prof?.payload.identity_mode).toBe('identified');
    expect(revalidateMock).toHaveBeenCalledWith('/fr/community/artisan/hassan-plombier');
  });

  it('met à jour la note existante (UPDATE, pas INSERT)', async () => {
    cfg.existing = { id: 'rating-1' };
    const res = await submitRating(RATING_INITIAL, fd({ score_urgences: '4' }));
    expect(res.ok).toBe(true);
    expect(calls.inserts.find((c) => c.table === 'ratings')).toBeUndefined();
    const upd = calls.updates.find((c) => c.table === 'ratings');
    expect(upd?.payload.score_urgences).toBe(4);
  });

  it('rejette 0 axe noté (validation)', async () => {
    const res = await submitRating(RATING_INITIAL, fd({ comment: 'rien' }));
    expect(res.ok).toBe(false);
    if (!res.ok && 'error' in res) {
      expect(res.error.code).toBe('validation');
      if (res.error.code === 'validation') expect(res.error.field).toBe('scores');
    }
    expect(calls.inserts).toHaveLength(0);
  });

  it('refuse un non-authentifié', async () => {
    requireResidentMock.mockResolvedValue({ ok: false });
    const res = await submitRating(RATING_INITIAL, fd({ score_depannage: '3' }));
    expect(res.ok).toBe(false);
    if (!res.ok && 'error' in res) expect(res.error.code).toBe('unauthenticated');
  });

  it('refuse si rate-limité', async () => {
    checkLimitMock.mockResolvedValue({ success: false, reset: 0 });
    const res = await submitRating(RATING_INITIAL, fd({ score_depannage: '3' }));
    expect(res.ok).toBe(false);
    if (!res.ok && 'error' in res) expect(res.error.code).toBe('rate_limited');
  });

  it('refuse un rôle non-résident', async () => {
    cfg.users = { residence_id: 'res-1', role: 'demandeur' };
    const res = await submitRating(RATING_INITIAL, fd({ score_depannage: '3' }));
    expect(res.ok).toBe(false);
    if (!res.ok && 'error' in res) expect(res.error.code).toBe('forbidden');
  });

  it('renvoie artisan_not_found si artisan non publié/absent', async () => {
    cfg.artisan = null;
    const res = await submitRating(RATING_INITIAL, fd({ score_depannage: '3' }));
    expect(res.ok).toBe(false);
    if (!res.ok && 'error' in res) expect(res.error.code).toBe('artisan_not_found');
  });

  it('renvoie submit_failed + log si l’écriture DB échoue', async () => {
    cfg.insertError = { code: '42501' };
    const res = await submitRating(RATING_INITIAL, fd({ score_depannage: '3' }));
    expect(res.ok).toBe(false);
    if (!res.ok && 'error' in res) expect(res.error.code).toBe('submit_failed');
    expect(logMock).toHaveBeenCalled();
  });
});
