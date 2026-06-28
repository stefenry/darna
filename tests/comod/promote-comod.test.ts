// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireComodMock = vi.fn();
const fromMock = vi.fn();
const readMaybeSingleMock = vi.fn();
const updateSpy = vi.fn();
const updateEqMock = vi.fn();
const updateUserByIdMock = vi.fn();
const logMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('@/lib/auth/require-comod', () => ({
  requireComod: () => requireComodMock(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      fromMock(table);
      return {
        // read chain: select(...).eq(...).maybeSingle()
        select: () => ({ eq: () => ({ maybeSingle: () => readMaybeSingleMock() }) }),
        // write chain: update(payload).eq(...)
        update: (payload: unknown) => {
          updateSpy(payload);
          return { eq: () => updateEqMock() };
        },
      };
    },
    auth: {
      admin: { updateUserById: (id: string, attrs: unknown) => updateUserByIdMock(id, attrs) },
    },
  }),
}));

vi.mock('@/lib/logger', () => ({ log: (e: unknown) => logMock(e) }));
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePathMock(...a) }));

import { promoteToComod } from '@/app/[locale]/comod/residents/actions';

const RESIDENCE = 'res-1';
const TARGET = 'target-uuid-1';

function comodOk() {
  requireComodMock.mockResolvedValue({
    ok: true,
    user: { id: 'comod-uuid-1', app_metadata: { role: 'co_mod', residence_id: RESIDENCE } },
  });
}

describe('promoteToComod Server Action', () => {
  beforeEach(() => {
    requireComodMock.mockReset();
    fromMock.mockReset();
    readMaybeSingleMock.mockReset();
    updateSpy.mockReset();
    updateEqMock.mockReset();
    updateUserByIdMock.mockReset();
    logMock.mockReset();
    revalidatePathMock.mockReset();
    // Defaults: target is a resident of the caller's residence, not deleted.
    readMaybeSingleMock.mockResolvedValue({
      data: { id: TARGET, residence_id: RESIDENCE, role: 'resident', deleted_at: null },
      error: null,
    });
    updateUserByIdMock.mockResolvedValue({ data: {}, error: null });
    updateEqMock.mockResolvedValue({ error: null });
  });
  afterEach(() => vi.restoreAllMocks());

  it('forbidden when the caller is not a co_mod', async () => {
    requireComodMock.mockResolvedValue({ ok: false });
    const res = await promoteToComod(TARGET);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('forbidden');
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it('invalid when targetUserId is empty', async () => {
    comodOk();
    const res = await promoteToComod('');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('invalid');
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it('rejects cross-residence promotion', async () => {
    comodOk();
    readMaybeSingleMock.mockResolvedValue({
      data: { id: TARGET, residence_id: 'other-res', role: 'resident', deleted_at: null },
      error: null,
    });
    const res = await promoteToComod(TARGET);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('cross_residence');
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it('returns already_comod without re-writing when target is co_mod', async () => {
    comodOk();
    readMaybeSingleMock.mockResolvedValue({
      data: { id: TARGET, residence_id: RESIDENCE, role: 'co_mod', deleted_at: null },
      error: null,
    });
    const res = await promoteToComod(TARGET);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('already_comod');
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it('returns invalid for a deleted or missing target', async () => {
    comodOk();
    readMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    const res = await promoteToComod(TARGET);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('invalid');
  });

  it('promotes: sets app_metadata (JWT) + public.users.role, then ok', async () => {
    comodOk();
    const res = await promoteToComod(TARGET);
    expect(res.ok).toBe(true);
    // app_metadata = source du JWT.
    expect(updateUserByIdMock).toHaveBeenCalledWith(TARGET, {
      app_metadata: { role: 'co_mod', residence_id: RESIDENCE },
    });
    // public.users.role aligné.
    const payload = updateSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.role).toBe('co_mod');
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it('returns failed if the app_metadata update errors (no role write)', async () => {
    comodOk();
    updateUserByIdMock.mockResolvedValue({ data: null, error: { code: 'auth_err' } });
    const res = await promoteToComod(TARGET);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('failed');
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
