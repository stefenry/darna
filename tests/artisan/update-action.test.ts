// @vitest-environment node
// Story 2.7 — updateArtisan : non-PII immédiat, PII → re-consent (RPC + SMS),
// ownership. Client Supabase mocké (RLS réelle testée en gated, tests/rls.test.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireResidentMock = vi.fn();
const checkLimitMock = vi.fn();
const smsMock = vi.fn();
const revalidateMock = vi.fn();
const logMock = vi.fn();

let cfg: {
  artisanRow: Record<string, unknown> | null;
  updateError: unknown;
  tagRows: { id: string; key: string }[];
  rpcError: unknown;
};
let calls: {
  updates: { table: string; payload: Record<string, unknown> }[];
  rpcs: { name: string; params: Record<string, unknown> }[];
  inserts: { table: string }[];
  deletes: { table: string }[];
};

vi.mock('@/lib/auth/require-resident', () => ({ requireResident: () => requireResidentMock() }));
vi.mock('@/lib/rate-limit', () => ({ checkLimit: () => checkLimitMock() }));
vi.mock('@/lib/consent/token', () => ({
  generateConsentToken: () => ({ raw: 'rawtoken', hash: 'hash123' }),
}));
vi.mock('@/lib/sms/send', () => ({ sendTransactionalSms: () => smsMock() }));
vi.mock('@/lib/env', () => ({
  env: {
    client: { NEXT_PUBLIC_SITE_URL: 'https://darna.test' },
    server: { CONSENT_TOKEN_SECRET: 'secret' },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => revalidateMock(p) }));
vi.mock('@/lib/logger', () => ({ log: (e: unknown) => logMock(e) }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => ({
      select: () => {
        const chain = {
          eq: () => chain,
          is: () => chain,
          in: () =>
            table === 'tags' ? Promise.resolve({ data: cfg.tagRows, error: null }) : chain,
          maybeSingle: () => {
            // Story 2.7 review P3 — `assertResidentOrComod` lit `users` ; le row
            // est un user (role, residence_id, deleted_at), pas un artisan.
            if (table === 'users') {
              return Promise.resolve({
                data: { role: 'resident', residence_id: 'res-1', deleted_at: null },
                error: null,
              });
            }
            return Promise.resolve({
              data: table === 'artisans' ? cfg.artisanRow : null,
              error: null,
            });
          },
        };
        return chain;
      },
      update: (payload: Record<string, unknown>) => {
        calls.updates.push({ table, payload });
        // P5 (review 2.7) — `.update().eq().select()` ou `.update().eq()` direct.
        const eqResult = {
          select: () =>
            Promise.resolve({
              data: cfg.updateError ? [] : [{ id: 'art-1' }],
              error: cfg.updateError ?? null,
            }),
          then: (resolve: (v: { error: unknown }) => unknown) =>
            resolve({ error: cfg.updateError ?? null }),
        };
        return { eq: () => eqResult };
      },
      delete: () => {
        calls.deletes.push({ table });
        const d = { eq: () => d, in: () => Promise.resolve({ error: null }) };
        return d;
      },
      insert: () => {
        calls.inserts.push({ table });
        return Promise.resolve({ error: null });
      },
    }),
    rpc: (name: string, params: Record<string, unknown>) => {
      calls.rpcs.push({ name, params });
      return Promise.resolve({
        data: [{ sms_target_phone: params.p_new_phone, sms_artisan_name: params.p_new_name_fr }],
        error: cfg.rpcError ?? null,
      });
    },
  }),
}));

import {
  updateArtisan,
  UPDATE_ARTISAN_INITIAL,
} from '@/app/[locale]/community/artisan/[slug]/modifier/actions';

const USER = { id: 'user-1' };

function fd(entries: Record<string, string>, tagKeys: string[] = ['plomberie']): FormData {
  const f = new FormData();
  f.set('slug', 'hassan-plombier');
  f.set('locale', 'fr');
  f.set('display_name_fr', 'Hassan Plombier');
  f.set('phone', '+212600000001');
  for (const k of tagKeys) f.append('tag_keys', k);
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  cfg = {
    artisanRow: {
      id: 'art-1',
      state: 'published',
      display_name_fr: 'Hassan Plombier',
      phone_e164: '+212600000001',
      created_by: 'user-1',
      artisan_tags: [{ tags: { key: 'plomberie' } }],
    },
    updateError: null,
    tagRows: [],
    rpcError: null,
  };
  calls = { updates: [], rpcs: [], inserts: [], deletes: [] };
  requireResidentMock.mockReset().mockResolvedValue({ ok: true, user: USER });
  checkLimitMock.mockReset().mockResolvedValue({ success: true, reset: 0 });
  smsMock.mockReset().mockResolvedValue({ ok: true });
  revalidateMock.mockReset();
  logMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('updateArtisan', () => {
  it('édition non-PII (prix) → reconsent:none, aucune RPC re-consent', async () => {
    const res = await updateArtisan(UPDATE_ARTISAN_INITIAL, fd({ price_relative: '$$' }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.reconsent).toBe('none');
    expect(calls.rpcs).toHaveLength(0);
    expect(calls.updates.some((u) => u.table === 'artisans')).toBe(true);
  });

  it('édition PII (téléphone) sur published → reconsent:draft + RPC + SMS', async () => {
    const res = await updateArtisan(UPDATE_ARTISAN_INITIAL, fd({ phone: '+212611111111' }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.reconsent).toBe('draft');
    expect(calls.rpcs[0]?.name).toBe('request_artisan_reconsent');
    expect(calls.rpcs[0]?.params.p_new_phone).toBe('+212611111111');
    expect(smsMock).toHaveBeenCalledOnce();
  });

  it('édition PII sur pending_consent → reconsent:in_place', async () => {
    cfg.artisanRow!.state = 'pending_consent';
    const res = await updateArtisan(UPDATE_ARTISAN_INITIAL, fd({ phone: '+212611111111' }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.reconsent).toBe('in_place');
    expect(calls.rpcs[0]?.name).toBe('request_artisan_reconsent');
  });

  it('édition d’une fiche d’autrui → forbidden sans révéler', async () => {
    cfg.artisanRow!.created_by = 'someone-else';
    const res = await updateArtisan(UPDATE_ARTISAN_INITIAL, fd({ price_relative: '$$' }));
    expect(res.ok).toBe(false);
    if (!res.ok && 'error' in res) expect(res.error.code).toBe('forbidden');
    expect(calls.updates).toHaveLength(0);
  });

  it('refuse un non-authentifié', async () => {
    requireResidentMock.mockResolvedValue({ ok: false });
    const res = await updateArtisan(UPDATE_ARTISAN_INITIAL, fd({}));
    expect(res.ok).toBe(false);
    if (!res.ok && 'error' in res) expect(res.error.code).toBe('unauthenticated');
  });
});
