// @vitest-environment node
// Story 6.2 — server action recordShare : RPC increment_share_count, gate auth,
// whitelist kind.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireResidentMock = vi.fn();
const rpcSpy = vi.fn();
let rpcError: { code?: string } | null = null;

vi.mock('@/lib/auth/require-resident', () => ({ requireResident: () => requireResidentMock() }));
vi.mock('@/lib/logger', () => ({ log: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: (name: string, args: unknown) => {
      rpcSpy(name, args);
      return Promise.resolve({ error: rpcError });
    },
  }),
}));

import { recordShare } from '@/app/actions/record-share';

beforeEach(() => {
  requireResidentMock.mockReset();
  rpcSpy.mockReset();
  rpcError = null;
  requireResidentMock.mockResolvedValue({ ok: true, user: { id: 'user-1' } });
});
afterEach(() => vi.restoreAllMocks());

describe('recordShare', () => {
  it('appelle increment_share_count avec kind + id', async () => {
    const res = await recordShare('artisan', 'art-1');
    expect(res).toEqual({ ok: true });
    expect(rpcSpy).toHaveBeenCalledWith('increment_share_count', {
      p_kind: 'artisan',
      p_id: 'art-1',
    });
  });

  it('refuse si non authentifié (rpc non appelée)', async () => {
    requireResidentMock.mockResolvedValue({ ok: false });
    const res = await recordShare('alert', 'a-1');
    expect(res).toEqual({ ok: false });
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('refuse un kind hors whitelist (rpc non appelée)', async () => {
    const res = await recordShare('comment', 'c-1');
    expect(res).toEqual({ ok: false });
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('remonte ok:false si la RPC échoue', async () => {
    rpcError = { code: 'P0001' };
    const res = await recordShare('tip', 't-1');
    expect(res).toEqual({ ok: false });
  });
});
