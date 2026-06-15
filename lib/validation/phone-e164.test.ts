import { describe, it, expect } from 'vitest';
import { zPhoneMaroc } from './phone-e164';

describe('zPhoneMaroc', () => {
  it('accepte +212 + 9 chiffres', () => {
    expect(zPhoneMaroc.safeParse('+212612345678').success).toBe(true);
  });

  it('refuse un numero sans indicatif international', () => {
    expect(zPhoneMaroc.safeParse('0612345678').success).toBe(false);
  });

  it('refuse un indicatif non marocain (+33)', () => {
    expect(zPhoneMaroc.safeParse('+33612345678').success).toBe(false);
  });

  it('refuse un numero trop court', () => {
    expect(zPhoneMaroc.safeParse('+2126123456').success).toBe(false);
  });

  it('refuse un prefixe national invalide (commence par 4)', () => {
    expect(zPhoneMaroc.safeParse('+212412345678').success).toBe(false);
  });
});
