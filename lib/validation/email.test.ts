import { describe, it, expect } from 'vitest';
import { zEmail } from './email';

describe('zEmail', () => {
  it('accepte un e-mail valide', () => {
    expect(zEmail.safeParse('henry.stephane@gmail.com').success).toBe(true);
  });

  it('refuse une chaine sans @', () => {
    expect(zEmail.safeParse('not-an-email').success).toBe(false);
  });

  it('refuse une chaine vide', () => {
    expect(zEmail.safeParse('').success).toBe(false);
  });
});
