// @vitest-environment node
// Chantier identité (2026-07-26) — matière brute renvoyée par
// resolveNeighbourLabels : chaque surface (bons plans, suggestions, fiches
// artisan) applique ENSUITE sa propre règle.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const usersInMock = vi.fn();
const profilesInMock = vi.fn();
const profilesSelectSpy = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: (cols: string) => {
        if (table === 'profiles') profilesSelectSpy(cols);
        return { in: () => (table === 'users' ? usersInMock() : profilesInMock()) };
      },
    }),
  }),
}));

vi.mock('@/lib/artisans/pseudonym', () => ({
  pseudonymSuffix: (userId: string, scope: string) => `${scope}-${userId}`,
}));

import { resolveNeighbourLabels, authorLabelFromIdentityMode } from '@/lib/content/author-label';

const IDENTIFIED = 'user-identified';
const PSEUDO = 'user-pseudo';
const NOPROFILE = 'user-noprofile';
const DELETED = 'user-deleted';

beforeEach(() => {
  usersInMock.mockReset();
  profilesInMock.mockReset();
  profilesSelectSpy.mockReset();
  usersInMock.mockResolvedValue({
    data: [
      { id: IDENTIFIED, display_name: 'Salma', deleted_at: null },
      { id: PSEUDO, display_name: 'Hassan', deleted_at: null },
      { id: NOPROFILE, display_name: '   ', deleted_at: null },
      { id: DELETED, display_name: 'Ex Voisin', deleted_at: '2026-06-01T00:00:00Z' },
    ],
    error: null,
  });
  profilesInMock.mockResolvedValue({
    data: [
      { user_id: IDENTIFIED, identity_mode: 'identified', villa: 42 },
      { user_id: PSEUDO, identity_mode: 'pseudo', villa: 7 },
      // NOPROFILE volontairement absent.
    ],
    error: null,
  });
});

describe('resolveNeighbourLabels', () => {
  it('renvoie nom, villa, préférence et pseudonyme scopé', async () => {
    const map = await resolveNeighbourLabels([IDENTIFIED], { scope: 'suggestions' });
    expect(map.get(IDENTIFIED)).toEqual({
      displayName: 'Salma',
      villa: 42,
      identityMode: 'identified',
      pseudonym: `suggestions-${IDENTIFIED}`,
      deleted: false,
    });
  });

  it('lit bien la villa dans la requête profiles', async () => {
    await resolveNeighbourLabels([IDENTIFIED], { scope: 'suggestions' });
    expect(profilesSelectSpy).toHaveBeenCalledWith('user_id, identity_mode, villa');
  });

  it('display_name blanc → displayName null (jamais un libellé vide)', async () => {
    const map = await resolveNeighbourLabels([NOPROFILE], { scope: 'tips' });
    expect(map.get(NOPROFILE)?.displayName).toBeNull();
  });

  it('profil manquant → identityMode pseudo et villa null (défaut sûr)', async () => {
    const map = await resolveNeighbourLabels([NOPROFILE], { scope: 'tips' });
    expect(map.get(NOPROFILE)?.identityMode).toBe('pseudo');
    expect(map.get(NOPROFILE)?.villa).toBeNull();
  });

  it('utilisateur purgé → deleted true', async () => {
    const map = await resolveNeighbourLabels([DELETED], { scope: 'tips' });
    expect(map.get(DELETED)?.deleted).toBe(true);
  });

  it('aucune requête si la liste ne contient que null/undefined', async () => {
    const map = await resolveNeighbourLabels([null, undefined], { scope: 'tips' });
    expect(map.size).toBe(0);
    expect(usersInMock).not.toHaveBeenCalled();
  });
});

describe('authorLabelFromIdentityMode', () => {
  it('identité affichée avec nom → nom', async () => {
    const map = await resolveNeighbourLabels([IDENTIFIED], { scope: 'tips' });
    expect(authorLabelFromIdentityMode(map.get(IDENTIFIED))).toEqual({
      authorName: 'Salma',
      pseudonymSuffix: null,
    });
  });

  it('pseudo → pseudonyme, jamais le nom', async () => {
    const map = await resolveNeighbourLabels([PSEUDO], { scope: 'tips' });
    expect(authorLabelFromIdentityMode(map.get(PSEUDO))).toEqual({
      authorName: null,
      pseudonymSuffix: `tips-${PSEUDO}`,
    });
  });

  it('purgé → ni nom ni pseudonyme', async () => {
    const map = await resolveNeighbourLabels([DELETED], { scope: 'tips' });
    expect(authorLabelFromIdentityMode(map.get(DELETED))).toEqual({
      authorName: null,
      pseudonymSuffix: null,
    });
  });

  it('entrée absente de la map → ni nom ni pseudonyme', () => {
    expect(authorLabelFromIdentityMode(undefined)).toEqual({
      authorName: null,
      pseudonymSuffix: null,
    });
  });
});
