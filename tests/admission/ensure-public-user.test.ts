// @vitest-environment node
// Incident bêta 2026-07-26 — un nouvel inscrit n'arrivait jamais chez les co_mods.
// Cause : `handle_new_auth_user` avale ses erreurs (`exception when others`), donc
// un compte `auth.users` peut exister SANS sa ligne `public.users`. L'insertion de
// la demande d'admission cassait alors sur la clé étrangère (23503), et comme le
// trigger ne rejoue qu'à l'INSERT dans auth.users, la personne restait bloquée
// définitivement.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const usersUpsertMock = vi.fn();
const prefsUpsertMock = vi.fn();
const logMock = vi.fn();

vi.mock('@/lib/logger', () => ({ log: (e: unknown) => logMock(e) }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      upsert: (row: unknown, opts: unknown) =>
        table === 'users' ? usersUpsertMock(row, opts) : prefsUpsertMock(row, opts),
    }),
  }),
}));

import { ensurePublicUser } from '@/lib/auth/ensure-public-user';

const UID = 'user-orphelin';
const RESIDENCE = '00000000-0000-0000-0000-000000000001';

beforeEach(() => {
  usersUpsertMock.mockReset().mockResolvedValue({ error: null });
  prefsUpsertMock.mockReset().mockResolvedValue({ error: null });
  logMock.mockReset();
});

describe('ensurePublicUser', () => {
  it('crée la ligne manquante avec le rôle demandeur', async () => {
    await expect(ensurePublicUser(UID, RESIDENCE)).resolves.toBe(true);
    expect(usersUpsertMock).toHaveBeenCalledWith(
      { id: UID, residence_id: RESIDENCE, role: 'demandeur' },
      expect.objectContaining({ onConflict: 'id', ignoreDuplicates: true }),
    );
  });

  it('provisionne aussi les préférences de notification', async () => {
    await ensurePublicUser(UID, RESIDENCE);
    expect(prefsUpsertMock).toHaveBeenCalledWith(
      { user_id: UID, residence_id: RESIDENCE },
      expect.objectContaining({ onConflict: 'user_id', ignoreDuplicates: true }),
    );
  });

  it('ne dégrade JAMAIS un compte existant : ignoreDuplicates, pas d’écrasement', async () => {
    await ensurePublicUser(UID, RESIDENCE);
    // Un résident ou un co_mod qui repasse ici ne doit pas être remis en
    // « demandeur » — c'est tout l'objet du ignoreDuplicates.
    const [, opts] = usersUpsertMock.mock.calls[0]!;
    expect((opts as { ignoreDuplicates?: boolean }).ignoreDuplicates).toBe(true);
  });

  it('échec sur users → false + log, sans exception', async () => {
    usersUpsertMock.mockResolvedValue({ error: { code: '23503' } });
    await expect(ensurePublicUser(UID, RESIDENCE)).resolves.toBe(false);
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'auth.ensure_public_user_failed' }),
    );
  });

  it('échec sur les préférences seules → true quand même (le blocage, c’est users)', async () => {
    prefsUpsertMock.mockResolvedValue({ error: { code: '23503' } });
    await expect(ensurePublicUser(UID, RESIDENCE)).resolves.toBe(true);
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'auth.ensure_prefs_failed' }),
    );
  });

  it('exception inattendue → false, jamais de throw vers l’appelant', async () => {
    usersUpsertMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(ensurePublicUser(UID, RESIDENCE)).resolves.toBe(false);
  });
});
