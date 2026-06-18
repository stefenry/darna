import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSafeActionLink } from './safe-action-link';

describe('isSafeActionLink', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('accepts https links', () => {
    expect(isSafeActionLink('https://darna.example/auth/confirm?t=x')).toBe(true);
  });

  it('rejects http links in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isSafeActionLink('http://darna.example/auth/confirm')).toBe(false);
  });

  it('tolerates http links outside production (tunnel/staging)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isSafeActionLink('http://localhost:3000/auth/confirm')).toBe(true);
  });

  it('rejects non-http(s) protocols', () => {
    expect(isSafeActionLink('javascript:alert(1)')).toBe(false);
    expect(isSafeActionLink('ftp://x/y')).toBe(false);
  });

  it('rejects empty / non-string / unparseable values', () => {
    expect(isSafeActionLink('')).toBe(false);
    expect(isSafeActionLink(null)).toBe(false);
    expect(isSafeActionLink(42)).toBe(false);
    expect(isSafeActionLink('not a url')).toBe(false);
  });
});
