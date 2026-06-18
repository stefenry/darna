// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: () => getUserMock() },
  }),
}));

import { requireComod } from '@/lib/auth/require-comod';

describe('requireComod', () => {
  beforeEach(() => getUserMock.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('returns ok with the user when app_metadata.role === co_mod', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', app_metadata: { role: 'co_mod' } } },
      error: null,
    });
    const res = await requireComod();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.user.id).toBe('u1');
  });

  it('returns not-ok for a resident', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u2', app_metadata: { role: 'resident' } } },
      error: null,
    });
    expect((await requireComod()).ok).toBe(false);
  });

  it('returns not-ok for a demandeur (no co_mod role)', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u3', app_metadata: { role: 'demandeur' } } },
      error: null,
    });
    expect((await requireComod()).ok).toBe(false);
  });

  it('returns not-ok when there is no session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    expect((await requireComod()).ok).toBe(false);
  });
});
