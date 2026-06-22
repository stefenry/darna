// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireResidentMock = vi.fn();
const updateEqMock = vi.fn();
const updateSpy = vi.fn();
const rpcMock = vi.fn();
const signOutMock = vi.fn();
const logMock = vi.fn();

vi.mock('@/lib/auth/require-resident', () => ({
  requireResident: () => requireResidentMock(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      void table;
      return {
        update: (payload: unknown) => {
          updateSpy(payload);
          return {
            eq: (col: string, val: string) => ({
              // Support the .select() chain added by P6 patch
              select: (cols?: string) => {
                void cols;
                return updateEqMock(col, val);
              },
            }),
          };
        },
      };
    },
    rpc: (name: string) => rpcMock(name),
    auth: { signOut: (opts: unknown) => signOutMock(opts) },
  }),
}));

vi.mock('@/lib/logger', () => ({
  log: (entry: unknown) => logMock(entry),
}));

// Story 7.4 — updateProfileSettings pose le cookie NEXT_LOCALE (next/headers).
// On stub le helper pour rester en env node sans contexte de requête.
const setLocaleCookieMock = vi.fn();
vi.mock('@/lib/i18n/locale-cookie', () => ({
  setLocaleCookie: (locale: string) => setLocaleCookieMock(locale),
}));

import { updateProfileSettings, deleteAccount } from '@/app/[locale]/community/profil/actions';

const USER = { id: 'user-uuid-1' };

describe('updateProfileSettings', () => {
  beforeEach(() => {
    requireResidentMock.mockReset();
    updateEqMock.mockReset();
    updateSpy.mockReset();
    logMock.mockReset();
    setLocaleCookieMock.mockReset();
    updateEqMock.mockResolvedValue({ data: [{ user_id: USER.id }], error: null });
  });
  afterEach(() => vi.restoreAllMocks());

  it('persists identity_mode + language via the session client (RLS self) and sets the locale cookie', async () => {
    requireResidentMock.mockResolvedValue({ ok: true, user: USER });
    const res = await updateProfileSettings({ identity_mode: 'identified', language: 'ar' });
    expect(res.ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledOnce();
    const payload = updateSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.identity_mode).toBe('identified');
    expect(payload.language).toBe('ar');
    expect(updateEqMock).toHaveBeenCalledWith('user_id', USER.id);
    // Story 7.4 — la langue choisie est persistée dans le cookie NEXT_LOCALE.
    expect(setLocaleCookieMock).toHaveBeenCalledWith('ar');
  });

  it('returns forbidden without updating when not authenticated', async () => {
    requireResidentMock.mockResolvedValue({ ok: false });
    const res = await updateProfileSettings({ identity_mode: 'pseudo', language: 'fr' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('forbidden');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('rejects an invalid identity_mode before touching the DB', async () => {
    requireResidentMock.mockResolvedValue({ ok: true, user: USER });
    const res = await updateProfileSettings({ identity_mode: 'public', language: 'fr' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('invalid_input');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('returns failed when the DB update returns an error', async () => {
    requireResidentMock.mockResolvedValue({ ok: true, user: USER });
    updateEqMock.mockResolvedValue({ data: null, error: { code: 'db_error' } });
    const res = await updateProfileSettings({ identity_mode: 'pseudo', language: 'fr' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('failed');
      expect(res.message_key).toBe('errors.profil.settings_failed');
    }
    expect(updateSpy).toHaveBeenCalledOnce();
  });
});

describe('deleteAccount', () => {
  beforeEach(() => {
    requireResidentMock.mockReset();
    rpcMock.mockReset();
    signOutMock.mockReset();
    logMock.mockReset();
    rpcMock.mockResolvedValue({ error: null });
    signOutMock.mockResolvedValue({ error: null });
  });
  afterEach(() => vi.restoreAllMocks());

  it('soft-deletes via RPC then signs out globally', async () => {
    requireResidentMock.mockResolvedValue({ ok: true, user: USER });
    const res = await deleteAccount({ confirm: 'SUPPRIMER' });
    expect(res.ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('request_account_deletion');
    expect(signOutMock).toHaveBeenCalledWith({ scope: 'global' });
  });

  it('rejects a wrong confirmation phrase without calling the RPC or signing out', async () => {
    requireResidentMock.mockResolvedValue({ ok: true, user: USER });
    const res = await deleteAccount({ confirm: 'supprimer' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('invalid_input');
      expect(res.message_key).toBe('errors.profil.confirm_mismatch');
    }
    expect(rpcMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('returns forbidden when not authenticated', async () => {
    requireResidentMock.mockResolvedValue({ ok: false });
    const res = await deleteAccount({ confirm: 'SUPPRIMER' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('forbidden');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('returns failed when the RPC returns an error without calling signOut', async () => {
    requireResidentMock.mockResolvedValue({ ok: true, user: USER });
    rpcMock.mockResolvedValue({ error: { code: 'rpc_error' } });
    const res = await deleteAccount({ confirm: 'SUPPRIMER' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('failed');
      expect(res.message_key).toBe('errors.profil.delete_failed');
    }
    expect(rpcMock).toHaveBeenCalledWith('request_account_deletion');
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('never logs PII in any payload', async () => {
    requireResidentMock.mockResolvedValue({ ok: true, user: USER });
    await deleteAccount({ confirm: 'SUPPRIMER' });
    for (const call of logMock.mock.calls) {
      const entry = call[0] as { payload?: Record<string, unknown> };
      if (entry.payload) {
        expect(entry.payload).not.toHaveProperty('email');
        expect(entry.payload).not.toHaveProperty('first_name');
      }
    }
  });
});
