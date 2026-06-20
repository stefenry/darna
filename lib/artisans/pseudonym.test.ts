import { describe, it, expect } from 'vitest';
import { pseudonymSuffix } from './pseudonym';

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const A1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const A2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const SECRET = 'test_pseudonym_secret_32_chars_min____';

describe('pseudonymSuffix', () => {
  it('est déterministe pour le même (user, artisan)', () => {
    expect(pseudonymSuffix(U1, A1, SECRET)).toBe(pseudonymSuffix(U1, A1, SECRET));
  });

  it('renvoie un suffixe 4 hex uppercase', () => {
    expect(pseudonymSuffix(U1, A1, SECRET)).toMatch(/^[0-9A-F]{4}$/);
  });

  it('distingue deux voisins sur le même artisan', () => {
    expect(pseudonymSuffix(U1, A1, SECRET)).not.toBe(pseudonymSuffix(U2, A1, SECRET));
  });

  it('distingue le même voisin sur deux artisans', () => {
    expect(pseudonymSuffix(U1, A1, SECRET)).not.toBe(pseudonymSuffix(U1, A2, SECRET));
  });

  it('renvoie null si user_id est null (note anonymisée)', () => {
    expect(pseudonymSuffix(null, A1, SECRET)).toBeNull();
  });

  it('change si le secret change (review 2.6 D1 HMAC)', () => {
    expect(pseudonymSuffix(U1, A1, SECRET)).not.toBe(
      pseudonymSuffix(U1, A1, 'autre_secret_32_chars_minimum_____'),
    );
  });
});
