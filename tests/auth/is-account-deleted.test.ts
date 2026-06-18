// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const maybeSingleMock = vi.fn();
const logMock = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => maybeSingleMock() }),
      }),
    }),
  }),
}));

vi.mock('@/lib/logger', () => ({ log: (e: unknown) => logMock(e) }));

import { isAccountDeleted } from '@/lib/auth/is-account-deleted';

describe('isAccountDeleted', () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    logMock.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns true when deleted_at is set', async () => {
    maybeSingleMock.mockResolvedValue({
      data: { deleted_at: '2026-06-15T00:00:00Z' },
      error: null,
    });
    expect(await isAccountDeleted('u1')).toBe(true);
  });

  it('returns false when deleted_at is null', async () => {
    maybeSingleMock.mockResolvedValue({ data: { deleted_at: null }, error: null });
    expect(await isAccountDeleted('u1')).toBe(false);
  });

  it('returns false (fail-open) on query error', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { code: 'boom' } });
    expect(await isAccountDeleted('u1')).toBe(false);
  });

  it('returns false (fail-open) when the query throws', async () => {
    maybeSingleMock.mockRejectedValue(new Error('network'));
    expect(await isAccountDeleted('u1')).toBe(false);
  });
});
