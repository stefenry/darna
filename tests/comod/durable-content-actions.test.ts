// @vitest-environment node
// Story 3.5 (Task 4 / AC3/AC5/AC8) — Server Actions CRUD durable : create/edit via
// client session, retire via RPC, garde forbidden, validation KO.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireComodMock = vi.fn();
const insertSpy = vi.fn();
const updateSpy = vi.fn();
const updateEqSpy = vi.fn();
const rpcSpy = vi.fn();
let insertError: unknown = null;
let updateError: unknown = null;
let rpcError: { message?: string } | null = null;

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/require-comod', () => ({ requireComod: () => requireComodMock() }));
vi.mock('@/lib/logger', () => ({ log: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => ({
      insert: (payload: unknown) => {
        insertSpy(table, payload);
        return Promise.resolve({ error: insertError });
      },
      update: (payload: unknown) => {
        updateSpy(table, payload);
        return {
          eq: (c: string, v: string) => {
            updateEqSpy(c, v);
            return Promise.resolve({ error: updateError });
          },
        };
      },
    }),
    rpc: (name: string, args: unknown) => {
      rpcSpy(name, args);
      return Promise.resolve({ error: rpcError });
    },
  }),
}));

import {
  saveDurableEntry,
  retireDurableEntry,
  DURABLE_INITIAL,
} from '@/app/[locale]/comod/admin/_actions/durable-content';

const COMOD = { id: 'comod-1', app_metadata: { role: 'co_mod', residence_id: 'res-1' } };

function guideForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('theme_key', 'codes_portails');
  fd.set('title_fr', 'Code du portail');
  fd.set('body_fr_markdown', 'Le code est 1234.');
  fd.set('order_in_theme', '0');
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  requireComodMock.mockReset();
  insertSpy.mockReset();
  updateSpy.mockReset();
  updateEqSpy.mockReset();
  rpcSpy.mockReset();
  insertError = null;
  updateError = null;
  rpcError = null;
  requireComodMock.mockResolvedValue({ ok: true, user: COMOD });
});
afterEach(() => vi.restoreAllMocks());

describe('saveDurableEntry (create)', () => {
  it('insère une entrée Guide via client session (residence du JWT, created_by self)', async () => {
    const res = await saveDurableEntry({ kind: 'guide' }, DURABLE_INITIAL, guideForm());
    expect(res.ok).toBe(true);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const [table, payload] = insertSpy.mock.calls[0]!;
    expect(table).toBe('guide_entries');
    // created_by n'est PLUS posé par le client (review 3.1 P10 : default auth.uid()).
    expect(payload).toMatchObject({ residence_id: 'res-1', slug: 'code-du-portail' });
    expect(payload).not.toHaveProperty('created_by');
    // AR vide → avertissement non bloquant (AC3).
    expect((res as { warning?: string }).warning).toBe('untranslated');
  });

  it('refuse si pas co_mod (forbidden)', async () => {
    requireComodMock.mockResolvedValue({ ok: false });
    const res = await saveDurableEntry({ kind: 'guide' }, DURABLE_INITIAL, guideForm());
    expect(res).toMatchObject({ ok: false, code: 'forbidden' });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('validation KO (title_fr vide) → invalid_input + field', async () => {
    const res = await saveDurableEntry(
      { kind: 'guide' },
      DURABLE_INITIAL,
      guideForm({ title_fr: '  ' }),
    );
    expect(res).toMatchObject({ ok: false, code: 'invalid_input', field: 'title_fr' });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('numéro : refuse un téléphone non E.164', async () => {
    const fd = new FormData();
    fd.set('category_key', 'securite');
    fd.set('label_fr', 'Garde');
    fd.set('phone_e164', '0600');
    fd.set('order_in_category', '0');
    const res = await saveDurableEntry({ kind: 'numeros' }, DURABLE_INITIAL, fd);
    expect(res).toMatchObject({ ok: false, code: 'invalid_input', field: 'phone_e164' });
  });
});

describe('saveDurableEntry (edit)', () => {
  it('met à jour via client session (jamais residence_id en update)', async () => {
    const res = await saveDurableEntry(
      { kind: 'guide', id: 'g1' },
      DURABLE_INITIAL,
      guideForm({ title_ar: 'كود' }),
    );
    expect(res.ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const [table, payload] = updateSpy.mock.calls[0]!;
    expect(table).toBe('guide_entries');
    expect(payload).not.toHaveProperty('residence_id');
    expect(updateEqSpy).toHaveBeenCalledWith('id', 'g1');
  });
});

describe('retireDurableEntry', () => {
  it('appelle le RPC retire_durable_entry avec le dbKind', async () => {
    const res = await retireDurableEntry('guide', 'g1', 'spam');
    expect(res.ok).toBe(true);
    expect(rpcSpy).toHaveBeenCalledWith('retire_durable_entry', {
      p_kind: 'guide_entry',
      p_id: 'g1',
      p_reason: 'spam',
    });
  });

  it('mappe not_co_mod du RPC → forbidden', async () => {
    rpcError = { message: 'not_co_mod' };
    const res = await retireDurableEntry('pack', 'p1', '');
    expect(res).toMatchObject({ ok: false, code: 'forbidden' });
  });

  it('mappe wrong_residence du RPC', async () => {
    rpcError = { message: 'wrong_residence' };
    const res = await retireDurableEntry('numeros', 'n1', '');
    expect(res).toMatchObject({ ok: false, code: 'wrong_residence' });
  });
});
