// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const logSpy = vi.fn();
const selectSpy = vi.fn();

vi.mock('@/lib/logger', () => ({
  log: (entry: unknown) => logSpy(entry),
}));

// Chain builder: admin.from(...).update(...).eq(...).eq(...).is(...).is(...).select(...)
function makeAdmin(result: { data: { id: string }[] | null; error: { code: string } | null }) {
  const finalSelect = vi.fn(async () => result);
  selectSpy.mockImplementation(finalSelect);
  const chain = {
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    select: selectSpy,
  };
  return {
    from: vi.fn(() => chain),
  };
}

const ADMIN_REF = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof makeAdmin> }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ADMIN_REF.current,
}));

import { markAdmissionEmailVerified } from '@/lib/auth/mark-admission-email-verified';

describe('markAdmissionEmailVerified', () => {
  beforeEach(() => {
    logSpy.mockReset();
    selectSpy.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates and returns { updated: true } when a pending row without email_verified_at exists', async () => {
    ADMIN_REF.current = makeAdmin({
      data: [{ id: 'admission-row-1' }],
      error: null,
    });

    const result = await markAdmissionEmailVerified({ userId: 'user-uuid-1' });
    expect(result).toEqual({ updated: true });

    const entry = logSpy.mock.calls.at(-1)?.[0] as {
      event: string;
      payload: Record<string, unknown>;
    };
    expect(entry.event).toBe('admission.email_verified');
    expect(entry.payload.rowCount).toBe(1);
  });

  it('returns { updated: false } when no row matches (already verified, accepted/rejected, or no record)', async () => {
    ADMIN_REF.current = makeAdmin({
      data: [],
      error: null,
    });

    const result = await markAdmissionEmailVerified({ userId: 'user-uuid-2' });
    expect(result).toEqual({ updated: false });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('returns { updated: false } and logs error when Supabase returns an error (never throws)', async () => {
    ADMIN_REF.current = makeAdmin({
      data: null,
      error: { code: 'PGRST301' },
    });

    const result = await markAdmissionEmailVerified({ userId: 'user-uuid-3' });
    expect(result).toEqual({ updated: false });

    const entry = logSpy.mock.calls.at(-1)?.[0] as {
      event: string;
      level: string;
      payload: Record<string, unknown>;
    };
    expect(entry.event).toBe('admission.email_verified_update_failed');
    expect(entry.level).toBe('error');
    expect(entry.payload.errorCode).toBe('PGRST301');
  });

  it('returns { updated: false } when the admin client throws (caught + logged)', async () => {
    ADMIN_REF.current = {
      from: vi.fn(() => {
        throw new Error('unexpected');
      }),
    } as unknown as ReturnType<typeof makeAdmin>;

    const result = await markAdmissionEmailVerified({ userId: 'user-uuid-4' });
    expect(result).toEqual({ updated: false });

    const entry = logSpy.mock.calls.at(-1)?.[0] as {
      event: string;
      level: string;
      payload: Record<string, unknown>;
    };
    expect(entry.event).toBe('admission.email_verified_threw');
    expect(entry.level).toBe('error');
    expect(entry.payload.errorName).toBe('Error');
  });
});
