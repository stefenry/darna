import { describe, expect, it } from 'vitest';
import { zProfileSettings, zDeleteAccount, DELETE_CONFIRM_PHRASE } from './profile';

describe('zProfileSettings', () => {
  it('accepts valid identity_mode + language', () => {
    expect(zProfileSettings.safeParse({ identity_mode: 'pseudo', language: 'fr' }).success).toBe(
      true,
    );
    expect(
      zProfileSettings.safeParse({ identity_mode: 'identified', language: 'ar' }).success,
    ).toBe(true);
  });

  it('rejects identity_mode outside the enum', () => {
    expect(zProfileSettings.safeParse({ identity_mode: 'public', language: 'fr' }).success).toBe(
      false,
    );
  });

  it('rejects language outside the enum', () => {
    expect(zProfileSettings.safeParse({ identity_mode: 'pseudo', language: 'en' }).success).toBe(
      false,
    );
  });
});

describe('zDeleteAccount', () => {
  it('accepts the exact confirmation phrase', () => {
    expect(zDeleteAccount.safeParse({ confirm: DELETE_CONFIRM_PHRASE }).success).toBe(true);
  });

  it('rejects wrong case', () => {
    expect(zDeleteAccount.safeParse({ confirm: 'supprimer' }).success).toBe(false);
  });

  it('rejects extra whitespace', () => {
    expect(zDeleteAccount.safeParse({ confirm: ' SUPPRIMER ' }).success).toBe(false);
  });

  it('maps to the i18n message_key on mismatch', () => {
    const r = zDeleteAccount.safeParse({ confirm: 'nope' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('errors.profil.confirm_mismatch');
    }
  });
});
