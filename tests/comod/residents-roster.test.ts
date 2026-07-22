// Feedback bêta 2026-07-22 — la liste « qui habite où » du co_mod doit refléter
// les modifications de profil du résident (villa/tranche éditées dans
// /community/profil/parametres, stockées dans `profiles`), pas la photo figée
// de l'admission (`admission_requests`).

import { describe, it, expect } from 'vitest';
import { buildVillaRoster } from '@/app/[locale]/comod/residents/roster';

const U1 = 'user-1';
const U2 = 'user-2';
const U3 = 'user-3';

const admission = (userId: string, villa: number, tranche: string | null, firstName = 'Test') => ({
  user_id: userId,
  villa,
  tranche,
  first_name: firstName,
  created_at: '2026-01-01T00:00:00Z',
});

describe('buildVillaRoster', () => {
  it('prend villa/tranche du profil courant quand il existe (pas la photo admission)', () => {
    const roster = buildVillaRoster({
      admissions: [admission(U1, 3, 'A', 'Aïcha')],
      users: [{ id: U1, role: 'resident', deleted_at: null }],
      profiles: [{ user_id: U1, villa: 12, tranche: 'B' }],
      locale: 'fr',
    });
    expect([...roster.keys()]).toEqual([12]);
    expect(roster.get(12)).toEqual([
      { userId: U1, firstName: 'Aïcha', tranche: 'B', isComod: false },
    ]);
  });

  it('une tranche effacée dans le profil (null) ne retombe pas sur la valeur admission', () => {
    const roster = buildVillaRoster({
      admissions: [admission(U1, 3, 'A')],
      users: [{ id: U1, role: 'resident', deleted_at: null }],
      profiles: [{ user_id: U1, villa: 3, tranche: null }],
      locale: 'fr',
    });
    expect(roster.get(3)![0]!.tranche).toBeNull();
  });

  it('retombe sur les valeurs admission si la row profile manque (bug profiles connu)', () => {
    const roster = buildVillaRoster({
      admissions: [admission(U1, 5, 'C')],
      users: [{ id: U1, role: 'resident', deleted_at: null }],
      profiles: [],
      locale: 'fr',
    });
    expect(roster.get(5)).toEqual([
      { userId: U1, firstName: 'Test', tranche: 'C', isComod: false },
    ]);
  });

  it('dédup par user (admission la plus récente) + exclut supprimés + badge co_mod', () => {
    const roster = buildVillaRoster({
      admissions: [
        admission(U1, 1, null, 'Karim'),
        admission(U1, 2, null, 'Karim (vieux)'),
        admission(U2, 1, null, 'Sara'),
        admission(U3, 1, null, 'Ghost'),
      ],
      users: [
        { id: U1, role: 'co_mod', deleted_at: null },
        { id: U2, role: 'resident', deleted_at: null },
        { id: U3, role: 'resident', deleted_at: '2026-02-01T00:00:00Z' },
      ],
      profiles: [],
      locale: 'fr',
    });
    expect(roster.get(1)).toEqual([
      { userId: U1, firstName: 'Karim', tranche: null, isComod: true },
      { userId: U2, firstName: 'Sara', tranche: null, isComod: false },
    ]);
    expect(roster.get(2)).toBeUndefined();
    expect(roster.get(1)!.map((r) => r.userId)).not.toContain(U3);
  });

  it('trie les villas numériquement et les résidents par prénom (locale)', () => {
    const roster = buildVillaRoster({
      admissions: [
        admission(U1, 10, null, 'Zineb'),
        admission(U2, 2, null, 'Élise'),
        admission(U3, 10, null, 'Adam'),
      ],
      users: [
        { id: U1, role: 'resident', deleted_at: null },
        { id: U2, role: 'resident', deleted_at: null },
        { id: U3, role: 'resident', deleted_at: null },
      ],
      profiles: [],
      locale: 'fr',
    });
    expect([...roster.keys()]).toEqual([2, 10]);
    expect(roster.get(10)!.map((r) => r.firstName)).toEqual(['Adam', 'Zineb']);
  });
});
