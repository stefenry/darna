import { describe, expect, it } from 'vitest';
import { detectLocale, detectLocaleFromHeaders } from '@/lib/i18n/detect-locale';
import type { NextRequest } from 'next/server';

function makeRequest(opts: { cookie?: string; acceptLanguage?: string }): NextRequest {
  const cookies = new Map<string, { value: string }>();
  if (opts.cookie) {
    cookies.set('NEXT_LOCALE', { value: opts.cookie });
  }
  const headers = new Headers();
  if (opts.acceptLanguage) headers.set('accept-language', opts.acceptLanguage);

  return {
    cookies: {
      get: (name: string) => cookies.get(name),
    },
    headers,
  } as unknown as NextRequest;
}

describe('detectLocale', () => {
  it('returns the cookie value when it is a supported locale', () => {
    const req = makeRequest({ cookie: 'ar', acceptLanguage: 'en' });
    expect(detectLocale(req)).toBe('ar');
  });

  it('falls back to Accept-Language when cookie is unsupported', () => {
    const req = makeRequest({
      cookie: 'en',
      acceptLanguage: 'ar-MA,ar;q=0.9,fr;q=0.5,en;q=0.2',
    });
    expect(detectLocale(req)).toBe('ar');
  });

  it('uses Accept-Language first matching supported locale', () => {
    const req = makeRequest({ acceptLanguage: 'en-US,en;q=0.9,fr;q=0.5' });
    expect(detectLocale(req)).toBe('fr');
  });

  it('defaults to fr when nothing matches', () => {
    const req = makeRequest({ acceptLanguage: 'en-US,en;q=0.9' });
    expect(detectLocale(req)).toBe('fr');
  });

  it('defaults to fr when no headers provided', () => {
    const req = makeRequest({});
    expect(detectLocale(req)).toBe('fr');
  });
});

describe('detectLocaleFromHeaders (raw header strings)', () => {
  it('parses NEXT_LOCALE cookie out of a Cookie header', () => {
    expect(detectLocaleFromHeaders('foo=bar; NEXT_LOCALE=ar; other=1', null)).toBe('ar');
  });

  it('ignores Cookie when NEXT_LOCALE absent and falls back to Accept-Language', () => {
    expect(detectLocaleFromHeaders('foo=bar', 'fr-FR,fr;q=0.9')).toBe('fr');
  });

  it('defaults to fr when nothing matches', () => {
    expect(detectLocaleFromHeaders(null, 'en')).toBe('fr');
  });
});
