import { describe, it, expect } from 'vitest';
import { generateConsentToken, hashConsentToken, consentHashEquals } from './token';

const SECRET = 'x'.repeat(40);

describe('consent token', () => {
  it('hash déterministe pour (raw, secret) donnés', () => {
    expect(hashConsentToken('abc', SECRET)).toBe(hashConsentToken('abc', SECRET));
  });

  it('raw ≠ hash, hash = hex 64 (SHA-256)', () => {
    const { raw, hash } = generateConsentToken(SECRET);
    expect(raw).not.toBe(hash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('secret différent → hash différent', () => {
    expect(hashConsentToken('abc', SECRET)).not.toBe(hashConsentToken('abc', 'y'.repeat(40)));
  });

  it('generateConsentToken : le hash correspond au raw', () => {
    const { raw, hash } = generateConsentToken(SECRET);
    expect(hashConsentToken(raw, SECRET)).toBe(hash);
  });

  it('chaque génération produit un raw unique', () => {
    expect(generateConsentToken(SECRET).raw).not.toBe(generateConsentToken(SECRET).raw);
  });

  it('consentHashEquals : égalité timing-safe', () => {
    const h = hashConsentToken('abc', SECRET);
    expect(consentHashEquals(h, h)).toBe(true);
    expect(consentHashEquals(h, hashConsentToken('abd', SECRET))).toBe(false);
    expect(consentHashEquals(h, 'short')).toBe(false);
  });
});
