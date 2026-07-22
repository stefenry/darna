// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireComodMock = vi.fn();
const rpcMock = vi.fn();
const updateUserByIdMock = vi.fn();
const logMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('@/lib/auth/require-comod', () => ({
  requireComod: () => requireComodMock(),
}));

// Client SESSION : porte l'appel RPC (les gardes vivent en SQL).
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: (name: string, args: unknown) => rpcMock(name, args),
  }),
}));

// Client ADMIN : uniquement la coupure JWT (app_metadata).
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: { updateUserById: (id: string, attrs: unknown) => updateUserByIdMock(id, attrs) },
    },
  }),
}));

vi.mock('@/lib/logger', () => ({ log: (e: unknown) => logMock(e) }));
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePathMock(...a) }));

import { removeResident } from '@/app/[locale]/comod/residents/actions';

const TARGET = 'target-uuid-1';
const REASON = 'Déménagement confirmé';

function comodOk() {
  requireComodMock.mockResolvedValue({
    ok: true,
    user: { id: 'comod-uuid-1', app_metadata: { role: 'co_mod', residence_id: 'res-1' } },
  });
}

describe('removeResident Server Action', () => {
  beforeEach(() => {
    requireComodMock.mockReset();
    rpcMock.mockReset();
    updateUserByIdMock.mockReset();
    logMock.mockReset();
    revalidatePathMock.mockReset();
    rpcMock.mockResolvedValue({ data: null, error: null });
    updateUserByIdMock.mockResolvedValue({ data: {}, error: null });
  });
  afterEach(() => vi.restoreAllMocks());

  it('forbidden when the caller is not a co_mod — no RPC call', async () => {
    requireComodMock.mockResolvedValue({ ok: false });
    const res = await removeResident(TARGET, REASON);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('forbidden');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('invalid when targetUserId is empty — no RPC call', async () => {
    comodOk();
    const res = await removeResident('', REASON);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('invalid');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('invalid_reason when the reason is empty or too long — no RPC call', async () => {
    comodOk();
    const empty = await removeResident(TARGET, '   ');
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.code).toBe('invalid_reason');

    const tooLong = await removeResident(TARGET, 'x'.repeat(201));
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.code).toBe('invalid_reason');

    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('happy path: calls the RPC with trimmed reason, demotes the JWT, logs, revalidates', async () => {
    comodOk();
    const res = await removeResident(TARGET, `  ${REASON}  `);
    expect(res).toEqual({ ok: true });

    expect(rpcMock).toHaveBeenCalledExactlyOnceWith('comod_remove_resident', {
      p_target_user_id: TARGET,
      p_reason: REASON,
    });
    // Coupure JWT : retour au rôle demandeur.
    expect(updateUserByIdMock).toHaveBeenCalledExactlyOnceWith(TARGET, {
      app_metadata: { role: 'demandeur' },
    });
    // Audit applicatif sans PII (pas de motif dans les logs).
    const removed = logMock.mock.calls
      .map((c) => c[0] as { event: string; payload?: Record<string, unknown> })
      .find((e) => e.event === 'comod.resident_removed');
    expect(removed).toBeDefined();
    expect(JSON.stringify(logMock.mock.calls)).not.toContain(REASON);
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it.each(['invalid', 'cross_residence', 'target_not_resident', 'already_deleted'] as const)(
    'maps the RPC guard error %s — no JWT demotion',
    async (code) => {
      comodOk();
      rpcMock.mockResolvedValue({ data: null, error: { message: code, code: 'P0001' } });
      const res = await removeResident(TARGET, REASON);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe(code);
      expect(updateUserByIdMock).not.toHaveBeenCalled();
    },
  );

  it('maps an unknown RPC error to failed (error log, no JWT demotion)', async () => {
    comodOk();
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom', code: 'XX000' } });
    const res = await removeResident(TARGET, REASON);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('failed');
    expect(updateUserByIdMock).not.toHaveBeenCalled();
    const entry = logMock.mock.calls
      .map((c) => c[0] as { level: string; event: string })
      .find((e) => e.event === 'comod.remove_rpc_failed');
    expect(entry?.level).toBe('error');
  });

  it('app_metadata failure is non-blocking: still ok, logs comod.remove_meta_failed', async () => {
    comodOk();
    updateUserByIdMock.mockResolvedValue({ data: null, error: { code: 'auth_err' } });
    const res = await removeResident(TARGET, REASON);
    expect(res).toEqual({ ok: true });
    const failed = logMock.mock.calls
      .map((c) => c[0] as { event: string })
      .find((e) => e.event === 'comod.remove_meta_failed');
    expect(failed).toBeDefined();
  });
});
