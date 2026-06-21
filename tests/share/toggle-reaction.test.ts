// @vitest-environment node
// Story 6.4 — toggleReaction : ajoute si absente, retire si présente, renvoie le
// compte frais ; gate auth + whitelist target_type.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireResidentMock = vi.fn();
const insertSpy = vi.fn();
const deleteSpy = vi.fn();
let existing: { id: string } | null = null;
let countRow: { count: number } | null = { count: 3 };

vi.mock('@/lib/auth/require-resident', () => ({ requireResident: () => requireResidentMock() }));
vi.mock('@/lib/logger', () => ({ log: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'reactions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({ maybeSingle: () => Promise.resolve({ data: existing, error: null }) }),
              }),
            }),
          }),
          insert: (payload: unknown) => {
            insertSpy(payload);
            return Promise.resolve({ error: null });
          },
          delete: () => ({
            eq: (col: string, val: string) => {
              deleteSpy(col, val);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      // reaction_counts
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: countRow, error: null }) }),
          }),
        }),
      };
    },
  }),
}));

import { toggleReaction } from '@/app/actions/toggle-reaction';

beforeEach(() => {
  requireResidentMock.mockReset();
  insertSpy.mockReset();
  deleteSpy.mockReset();
  existing = null;
  countRow = { count: 3 };
  requireResidentMock.mockResolvedValue({ ok: true, user: { id: 'user-1' } });
});
afterEach(() => vi.restoreAllMocks());

describe('toggleReaction', () => {
  it('ajoute une réaction absente (insert) + compte frais', async () => {
    const res = await toggleReaction('alert', 'al-1');
    expect(res).toEqual({ ok: true, reacted: true, count: 3 });
    expect(insertSpy).toHaveBeenCalledWith({ target_type: 'alert', target_id: 'al-1' });
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('retire une réaction existante (delete = toggle off)', async () => {
    existing = { id: 'r-9' };
    countRow = { count: 2 };
    const res = await toggleReaction('tip', 't-1');
    expect(res).toEqual({ ok: true, reacted: false, count: 2 });
    expect(deleteSpy).toHaveBeenCalledWith('id', 'r-9');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('compte 0 si aucune ligne agrégée', async () => {
    countRow = null;
    const res = await toggleReaction('rating', 'c-1');
    expect(res).toEqual({ ok: true, reacted: true, count: 0 });
  });

  it('refuse non authentifié', async () => {
    requireResidentMock.mockResolvedValue({ ok: false });
    expect(await toggleReaction('alert', 'al-1')).toEqual({ ok: false });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('refuse un target_type hors whitelist', async () => {
    expect(await toggleReaction('artisan', 'a-1')).toEqual({ ok: false });
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
