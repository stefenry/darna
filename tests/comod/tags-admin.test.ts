// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireComodMock = vi.fn();
const rpcMock = vi.fn();
const logMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('@/lib/auth/require-comod', () => ({
  requireComod: () => requireComodMock(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: (name: string, args: unknown) => rpcMock(name, args),
  }),
}));

vi.mock('@/lib/logger', () => ({ log: (e: unknown) => logMock(e) }));
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePathMock(...a) }));

import { addTag, renameTag } from '@/app/[locale]/comod/admin/_actions/tags';

function comodOk() {
  requireComodMock.mockResolvedValue({
    ok: true,
    user: { id: 'comod-uuid-1', app_metadata: { role: 'co_mod', residence_id: 'res-1' } },
  });
}

describe('addTag / renameTag Server Actions', () => {
  beforeEach(() => {
    requireComodMock.mockReset();
    rpcMock.mockReset();
    logMock.mockReset();
    revalidatePathMock.mockReset();
    rpcMock.mockResolvedValue({ data: [{ key: 'jardinage', label_fr: 'Jardinage' }], error: null });
  });
  afterEach(() => vi.restoreAllMocks());

  it('addTag: forbidden when caller is not co_mod — no RPC call', async () => {
    requireComodMock.mockResolvedValue({ ok: false });
    const res = await addTag('Jardinage', '');
    expect(res).toEqual({ ok: false, code: 'forbidden' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('addTag: invalid_label for too-short or too-long labels — no RPC call', async () => {
    comodOk();
    expect(await addTag(' j ', '')).toEqual({ ok: false, code: 'invalid_label' });
    expect(await addTag('x'.repeat(41), '')).toEqual({ ok: false, code: 'invalid_label' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('addTag happy path: trims labels, returns the generated key, logs and revalidates', async () => {
    comodOk();
    const res = await addTag('  Jardinage  ', '  ');
    expect(res).toEqual({ ok: true, key: 'jardinage' });
    expect(rpcMock).toHaveBeenCalledExactlyOnceWith('comod_add_tag', {
      p_label_fr: 'Jardinage',
      p_label_ar: '',
    });
    const addedLog = logMock.mock.calls
      .map((c) => c[0] as { event: string; payload?: Record<string, unknown> })
      .find((e) => e.event === 'comod.tag_added');
    expect(addedLog?.payload?.key).toBe('jardinage');
    expect(revalidatePathMock).toHaveBeenCalled();
  });

  it.each(['duplicate', 'invalid_label', 'forbidden'] as const)(
    'addTag maps RPC guard error %s (info log)',
    async (code) => {
      comodOk();
      rpcMock.mockResolvedValue({ data: null, error: { message: code, code: 'P0001' } });
      const res = await addTag('Jardinage', '');
      expect(res).toEqual({ ok: false, code });
      const entry = logMock.mock.calls
        .map((c) => c[0] as { level: string; event: string })
        .find((e) => e.event === 'comod.tag_add_failed');
      expect(entry?.level).toBe('info');
    },
  );

  it('addTag maps an unknown RPC error to failed (error log)', async () => {
    comodOk();
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom', code: 'XX000' } });
    const res = await addTag('Jardinage', '');
    expect(res).toEqual({ ok: false, code: 'failed' });
    const entry = logMock.mock.calls
      .map((c) => c[0] as { level: string; event: string })
      .find((e) => e.event === 'comod.tag_add_failed');
    expect(entry?.level).toBe('error');
  });

  it('renameTag: not_found for an empty key — no RPC call', async () => {
    comodOk();
    const res = await renameTag('', 'Jardinage', '');
    expect(res).toEqual({ ok: false, code: 'not_found' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('renameTag happy path: calls the RPC with trimmed labels and logs', async () => {
    comodOk();
    rpcMock.mockResolvedValue({ data: null, error: null });
    const res = await renameTag('jardinage', ' Jardinage & entretien ', '');
    expect(res).toEqual({ ok: true, key: 'jardinage' });
    expect(rpcMock).toHaveBeenCalledExactlyOnceWith('comod_rename_tag', {
      p_key: 'jardinage',
      p_label_fr: 'Jardinage & entretien',
      p_label_ar: '',
    });
    const renamed = logMock.mock.calls
      .map((c) => c[0] as { event: string })
      .find((e) => e.event === 'comod.tag_renamed');
    expect(renamed).toBeDefined();
  });

  it('renameTag maps not_found from the RPC', async () => {
    comodOk();
    rpcMock.mockResolvedValue({ data: null, error: { message: 'not_found', code: 'P0001' } });
    const res = await renameTag('inconnu', 'Jardinage', '');
    expect(res).toEqual({ ok: false, code: 'not_found' });
  });
});
