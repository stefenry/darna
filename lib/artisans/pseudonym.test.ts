import { describe, it, expect } from 'vitest';
import { pseudonymSuffix } from './pseudonym';

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const A1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const A2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('pseudonymSuffix', () => {
  it('est déterministe pour le même (user, artisan)', () => {
    expect(pseudonymSuffix(U1, A1)).toBe(pseudonymSuffix(U1, A1));
  });

  it('renvoie un suffixe 4 hex uppercase', () => {
    expect(pseudonymSuffix(U1, A1)).toMatch(/^[0-9A-F]{4}$/);
  });

  it('distingue deux voisins sur le même artisan', () => {
    expect(pseudonymSuffix(U1, A1)).not.toBe(pseudonymSuffix(U2, A1));
  });

  it('distingue le même voisin sur deux artisans', () => {
    expect(pseudonymSuffix(U1, A1)).not.toBe(pseudonymSuffix(U1, A2));
  });

  it('renvoie null si user_id est null (note anonymisée)', () => {
    expect(pseudonymSuffix(null, A1)).toBeNull();
  });
});
