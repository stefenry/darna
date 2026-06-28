// @vitest-environment node
// Story 6.5 — submitSuggestion (résident, insert + notif co_mods) et
// markSuggestionReviewed (co_mod, state → reviewed).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireResidentMock = vi.fn();
const requireComodMock = vi.fn();
const insertSpy = vi.fn();
const updateSpy = vi.fn();
const sendEmailMock = vi.fn(() => Promise.resolve({ ok: true, messageId: 'm1' }));
let rlSuccess = true;
let insertError: { code?: string } | null = null;
let updateError: { code?: string } | null = null;

vi.mock('@/lib/auth/require-resident', () => ({ requireResident: () => requireResidentMock() }));
vi.mock('@/lib/auth/require-comod', () => ({ requireComod: () => requireComodMock() }));
vi.mock('@/lib/logger', () => ({ log: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  checkLimit: () => Promise.resolve({ success: rlSuccess, reset: 0 }),
}));
vi.mock('@/lib/email/send', () => ({ sendTransactionalEmail: () => sendEmailMock() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      insert: (payload: unknown) => {
        insertSpy(payload);
        return Promise.resolve({ error: insertError });
      },
      update: (payload: unknown) => ({
        eq: (col: string, val: string) => {
          updateSpy(payload, col, val);
          return Promise.resolve({ error: updateError });
        },
      }),
    }),
  }),
}));

import { submitSuggestion } from '@/app/[locale]/community/profil/parametres/suggestion/actions';
import { SUGGESTION_INITIAL } from '@/app/[locale]/community/profil/parametres/suggestion/state';
import { markSuggestionReviewed } from '@/app/[locale]/comod/suggestions/actions';

function form(body: string): FormData {
  const fd = new FormData();
  fd.set('body', body);
  return fd;
}

beforeEach(() => {
  requireResidentMock.mockReset();
  requireComodMock.mockReset();
  insertSpy.mockReset();
  updateSpy.mockReset();
  sendEmailMock.mockClear();
  rlSuccess = true;
  insertError = null;
  updateError = null;
  requireResidentMock.mockResolvedValue({ ok: true, user: { id: 'user-1' } });
  requireComodMock.mockResolvedValue({ ok: true, user: { id: 'comod-1' } });
});
afterEach(() => vi.restoreAllMocks());

describe('submitSuggestion', () => {
  it('insère la suggestion (body seul) + notifie les co_mods', async () => {
    const res = await submitSuggestion(SUGGESTION_INITIAL, form('Ajouter un mode sombre'));
    expect(res).toEqual({ ok: true });
    expect(insertSpy).toHaveBeenCalledWith({ body: 'Ajouter un mode sombre' });
    // 2 co_mods stub (env.INITIAL_COMOD_EMAILS) notifiés.
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it('refuse non authentifié', async () => {
    requireResidentMock.mockResolvedValue({ ok: false });
    const res = await submitSuggestion(SUGGESTION_INITIAL, form('x'));
    expect(res).toEqual({ ok: false, code: 'forbidden' });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('rate-limit', async () => {
    rlSuccess = false;
    const res = await submitSuggestion(SUGGESTION_INITIAL, form('x'));
    expect(res).toEqual({ ok: false, code: 'rate_limited' });
  });

  it('texte vide → invalid', async () => {
    const res = await submitSuggestion(SUGGESTION_INITIAL, form('   '));
    expect(res).toEqual({ ok: false, code: 'invalid' });
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe('markSuggestionReviewed', () => {
  it('co_mod marque comme lue (state=reviewed)', async () => {
    const res = await markSuggestionReviewed('sug-1');
    expect(res).toEqual({ ok: true });
    expect(updateSpy).toHaveBeenCalledWith({ state: 'reviewed' }, 'id', 'sug-1');
  });

  it('refuse non co_mod', async () => {
    requireComodMock.mockResolvedValue({ ok: false });
    const res = await markSuggestionReviewed('sug-1');
    expect(res).toEqual({ ok: false });
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
