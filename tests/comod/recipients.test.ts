// @vitest-environment node
// Retour bêta 2026-07-26 — les co_mods ne recevaient plus aucune notification :
// les destinataires venaient d'une variable d'env que le runbook demande de
// supprimer après le bootstrap. Ils sont désormais résolus depuis la base.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const usersQueryMock = vi.fn();
const getUserByIdMock = vi.fn();
const logMock = vi.fn();

vi.mock('@/lib/logger', () => ({ log: (e: unknown) => logMock(e) }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => usersQueryMock(),
        }),
      }),
    }),
    auth: { admin: { getUserById: (id: string) => getUserByIdMock(id) } },
  }),
}));

import { fetchComodEmails } from '@/lib/comod/recipients';

beforeEach(() => {
  usersQueryMock.mockReset();
  getUserByIdMock.mockReset();
  logMock.mockReset();
});

describe('fetchComodEmails', () => {
  it('renvoie les e-mails des co_mods actifs', async () => {
    usersQueryMock.mockResolvedValue({ data: [{ id: 'c1' }, { id: 'c2' }], error: null });
    getUserByIdMock.mockImplementation((id: string) =>
      Promise.resolve({ data: { user: { email: `${id}@darna.test` } }, error: null }),
    );

    await expect(fetchComodEmails()).resolves.toEqual(['c1@darna.test', 'c2@darna.test']);
  });

  it('aucun co_mod → liste vide + log d’alerte (silence anormal, on veut le voir)', async () => {
    usersQueryMock.mockResolvedValue({ data: [], error: null });

    await expect(fetchComodEmails()).resolves.toEqual([]);
    expect(logMock).toHaveBeenCalledWith(expect.objectContaining({ event: 'comod.no_recipients' }));
    expect(getUserByIdMock).not.toHaveBeenCalled();
  });

  it('ignore un compte dont l’e-mail est introuvable, garde les autres', async () => {
    usersQueryMock.mockResolvedValue({ data: [{ id: 'c1' }, { id: 'c2' }], error: null });
    getUserByIdMock.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'c1'
          ? { data: { user: { email: 'c1@darna.test' } }, error: null }
          : { data: { user: null }, error: null },
      ),
    );

    await expect(fetchComodEmails()).resolves.toEqual(['c1@darna.test']);
  });

  it('erreur base → liste vide, jamais d’exception (la notif est accessoire)', async () => {
    usersQueryMock.mockResolvedValue({ data: null, error: { code: '42501' } });

    await expect(fetchComodEmails()).resolves.toEqual([]);
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'comod.recipients_failed' }),
    );
  });
});
