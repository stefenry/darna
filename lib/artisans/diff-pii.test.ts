import { describe, it, expect } from 'vitest';
import { piiChanged } from './diff-pii';

const cur = { display_name_fr: 'Hassan Plombier', phone_e164: '+212600000001' };

describe('piiChanged', () => {
  it('false si rien ne change', () => {
    expect(piiChanged(cur, { ...cur })).toBe(false);
  });
  it('true si le nom change', () => {
    expect(piiChanged(cur, { ...cur, display_name_fr: 'Hassan Plomberie' })).toBe(true);
  });
  it('true si le téléphone change', () => {
    expect(piiChanged(cur, { ...cur, phone_e164: '+212600000002' })).toBe(true);
  });
  it('false sur un simple reformatage du téléphone (séparateurs)', () => {
    expect(piiChanged(cur, { ...cur, phone_e164: '+212 600 000 001' })).toBe(false);
  });
  it('false sur des espaces de bord du nom', () => {
    expect(piiChanged(cur, { ...cur, display_name_fr: '  Hassan Plombier  ' })).toBe(false);
  });
});
