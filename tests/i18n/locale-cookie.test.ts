// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setCookieMock = vi.fn();

vi.mock('next/headers', () => ({
  cookies: async () => ({ set: (...args: unknown[]) => setCookieMock(...args) }),
}));

import {
  applyLocaleFromProfile,
  setLocaleCookie,
  LOCALE_COOKIE_NAME,
} from '@/lib/i18n/locale-cookie';

// Minimal supabase-client shape used by applyLocaleFromProfile.
function fakeClient(language: string | null, throws = false) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => {
                  if (throws) throw new Error('db down');
                  return { data: language === null ? null : { language } };
                },
              };
            },
          };
        },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('locale-cookie (Story 7.4)', () => {
  beforeEach(() => setCookieMock.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('setLocaleCookie writes NEXT_LOCALE with path / and a long maxAge', async () => {
    await setLocaleCookie('ar');
    const [name, value, opts] = setCookieMock.mock.calls[0] as [
      string,
      string,
      { path: string; maxAge: number; sameSite: string },
    ];
    expect(name).toBe(LOCALE_COOKIE_NAME);
    expect(value).toBe('ar');
    expect(opts.path).toBe('/');
    expect(opts.maxAge).toBeGreaterThan(60 * 60 * 24 * 30);
    expect(opts.sameSite).toBe('lax');
  });

  it('applyLocaleFromProfile sets the cookie and returns the saved AR locale', async () => {
    const locale = await applyLocaleFromProfile(fakeClient('ar'), 'user-1', 'fr');
    expect(locale).toBe('ar');
    expect(setCookieMock).toHaveBeenCalledWith(LOCALE_COOKIE_NAME, 'ar', expect.any(Object));
  });

  it('returns the fallback and sets no cookie when no profile row exists', async () => {
    const locale = await applyLocaleFromProfile(fakeClient(null), 'user-1', 'fr');
    expect(locale).toBe('fr');
    expect(setCookieMock).not.toHaveBeenCalled();
  });

  it('ignores an unsupported saved language (keeps fallback)', async () => {
    const locale = await applyLocaleFromProfile(fakeClient('en'), 'user-1', 'fr');
    expect(locale).toBe('fr');
    expect(setCookieMock).not.toHaveBeenCalled();
  });

  it('is best-effort: a DB error returns the fallback without throwing', async () => {
    const locale = await applyLocaleFromProfile(fakeClient(null, true), 'user-1', 'ar');
    expect(locale).toBe('ar');
  });
});
