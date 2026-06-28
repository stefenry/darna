// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireResidentMock = vi.fn();
const updateEqMock = vi.fn();
const updateSpy = vi.fn();
const fromSpy = vi.fn();
const logMock = vi.fn();

vi.mock('@/lib/auth/require-resident', () => ({
  requireResident: () => requireResidentMock(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      fromSpy(table);
      return {
        update: (payload: unknown) => {
          updateSpy(payload);
          return {
            eq: (col: string, val: string) => ({
              select: (cols?: string) => {
                void cols;
                return updateEqMock(col, val);
              },
            }),
          };
        },
      };
    },
  }),
}));

vi.mock('@/lib/logger', () => ({
  log: (entry: unknown) => logMock(entry),
}));

import { updateNotificationPrefs } from '@/app/[locale]/community/profil/actions';

const USER = { id: 'user-uuid-1' };
const ALL_ON = {
  alerts_urgentes_enabled: true,
  nouvelles_entrees_annuaire_enabled: true,
  activite_contributions_enabled: true,
};

describe('updateNotificationPrefs (Story 7.1)', () => {
  beforeEach(() => {
    requireResidentMock.mockReset();
    updateEqMock.mockReset();
    updateSpy.mockReset();
    fromSpy.mockReset();
    logMock.mockReset();
    updateEqMock.mockResolvedValue({ data: [{ user_id: USER.id }], error: null });
  });
  afterEach(() => vi.restoreAllMocks());

  it('persists the 3 boolean categories on notifications_prefs (RLS self)', async () => {
    requireResidentMock.mockResolvedValue({ ok: true, user: USER });
    const res = await updateNotificationPrefs({
      alerts_urgentes_enabled: true,
      nouvelles_entrees_annuaire_enabled: false,
      activite_contributions_enabled: true,
    });
    expect(res.ok).toBe(true);
    expect(fromSpy).toHaveBeenCalledWith('notifications_prefs');
    const payload = updateSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.alerts_urgentes_enabled).toBe(true);
    expect(payload.nouvelles_entrees_annuaire_enabled).toBe(false);
    expect(payload.activite_contributions_enabled).toBe(true);
    expect(payload).toHaveProperty('updated_at');
    expect(updateEqMock).toHaveBeenCalledWith('user_id', USER.id);
  });

  it('returns forbidden without touching the DB when not authenticated', async () => {
    requireResidentMock.mockResolvedValue({ ok: false });
    const res = await updateNotificationPrefs(ALL_ON);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('forbidden');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('rejects a non-boolean category before touching the DB', async () => {
    requireResidentMock.mockResolvedValue({ ok: true, user: USER });
    const res = await updateNotificationPrefs({
      ...ALL_ON,
      // @ts-expect-error — deliberately invalid input to exercise the Zod guard
      alerts_urgentes_enabled: 'yes',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('invalid_input');
      expect(res.message_key).toBe('errors.profil.notifications_failed');
    }
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('returns failed when the DB update errors', async () => {
    requireResidentMock.mockResolvedValue({ ok: true, user: USER });
    updateEqMock.mockResolvedValue({ data: null, error: { code: 'db_error' } });
    const res = await updateNotificationPrefs(ALL_ON);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('failed');
      expect(res.message_key).toBe('errors.profil.notifications_failed');
    }
  });

  // Régression 2026-06-28 — 0 ligne mise à jour (row notifications_prefs absente
  // / RLS) ne doit PAS renvoyer ok : l'UI optimiste doit rollback + afficher l'erreur.
  it('returns failed (not ok) when the UPDATE matches zero rows', async () => {
    requireResidentMock.mockResolvedValue({ ok: true, user: USER });
    updateEqMock.mockResolvedValue({ data: [], error: null });
    const res = await updateNotificationPrefs(ALL_ON);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('failed');
      expect(res.message_key).toBe('errors.profil.notifications_failed');
    }
  });

  it('logs the updated prefs without any PII', async () => {
    requireResidentMock.mockResolvedValue({ ok: true, user: USER });
    await updateNotificationPrefs(ALL_ON);
    const updated = logMock.mock.calls.find(
      (c) => (c[0] as { event: string }).event === 'profil.notifications_updated',
    );
    expect(updated).toBeDefined();
    const entry = updated?.[0] as { payload: Record<string, unknown> };
    expect(entry.payload).not.toHaveProperty('email');
    expect(entry.payload).not.toHaveProperty('display_name');
    expect(entry.payload.alerts_urgentes_enabled).toBe(true);
  });
});
