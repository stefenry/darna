// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const usersInMock = vi.fn();
const profilesInMock = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        in: () => (table === 'users' ? usersInMock() : profilesInMock()),
      }),
    }),
  }),
}));

// Pseudonyme déterministe mocké : on teste la LOGIQUE de label, pas le HMAC
// (couvert par lib/artisans/pseudonym.test.ts).
vi.mock('@/lib/artisans/pseudonym', () => ({
  pseudonymSuffix: (userId: string) => `S-${userId}`,
}));

import { resolveTipAuthorLabels, resolveTipAuthorLabel } from '@/lib/content/author-label';

const IDENTIFIED = 'user-identified';
const PSEUDO = 'user-pseudo';
const NOPROFILE = 'user-noprofile';
const DELETED = 'user-deleted';

describe('resolveTipAuthorLabels (FR16 author display for tips)', () => {
  beforeEach(() => {
    usersInMock.mockReset();
    profilesInMock.mockReset();
    usersInMock.mockResolvedValue({
      data: [
        { id: IDENTIFIED, display_name: 'Hassan', deleted_at: null },
        { id: PSEUDO, display_name: 'Hassan B.', deleted_at: null },
        { id: NOPROFILE, display_name: 'Sans Profil', deleted_at: null },
        { id: DELETED, display_name: 'Ex Voisin', deleted_at: '2026-06-01T00:00:00Z' },
      ],
      error: null,
    });
    profilesInMock.mockResolvedValue({
      data: [
        { user_id: IDENTIFIED, identity_mode: 'identified' },
        { user_id: PSEUDO, identity_mode: 'pseudo' },
        // NOPROFILE volontairement absent (bug profiles) → défaut pseudonyme.
      ],
      error: null,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('identité affichée → nom réel', async () => {
    const map = await resolveTipAuthorLabels([IDENTIFIED]);
    expect(map.get(IDENTIFIED)).toEqual({ authorName: 'Hassan', pseudonymSuffix: null });
  });

  it('pseudo → pseudonyme stable, jamais le nom', async () => {
    const map = await resolveTipAuthorLabels([PSEUDO]);
    expect(map.get(PSEUDO)).toEqual({ authorName: null, pseudonymSuffix: `S-${PSEUDO}` });
  });

  it('profil manquant → pseudonyme (défaut sûr, pas de fuite de nom)', async () => {
    const map = await resolveTipAuthorLabels([NOPROFILE]);
    expect(map.get(NOPROFILE)).toEqual({ authorName: null, pseudonymSuffix: `S-${NOPROFILE}` });
  });

  it('contributeur purgé (deleted_at) → ni nom ni pseudo (« Voisin supprimé »)', async () => {
    const map = await resolveTipAuthorLabels([DELETED]);
    expect(map.get(DELETED)).toEqual({ authorName: null, pseudonymSuffix: null });
  });

  it('ids null/undefined ignorés, aucune requête si liste vide', async () => {
    const map = await resolveTipAuthorLabels([null, undefined]);
    expect(map.size).toBe(0);
    expect(usersInMock).not.toHaveBeenCalled();
  });

  it('resolveTipAuthorLabel(null) → label vide sans requête', async () => {
    const label = await resolveTipAuthorLabel(null);
    expect(label).toEqual({ authorName: null, pseudonymSuffix: null });
    expect(usersInMock).not.toHaveBeenCalled();
  });
});
