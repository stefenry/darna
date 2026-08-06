import { describe, expect, it } from 'vitest';
import { resolveGlitchtipDsn } from '@/lib/sentry/dsn';

describe('resolveGlitchtipDsn (régression observabilité 2026-08-05)', () => {
  it('accepte un DSN GlitchTip Cloud et en dérive l’origine pour la CSP', () => {
    const resolved = resolveGlitchtipDsn('https://abc123def@app.glitchtip.com/42');
    expect(resolved).toEqual({
      dsn: 'https://abc123def@app.glitchtip.com/42',
      origin: 'https://app.glitchtip.com',
    });
  });

  it('rejette le DSN bouchon réellement posé en prod', () => {
    // Valeur exacte lue dans le bundle client servi par darnatips.app.
    expect(resolveGlitchtipDsn('https://placeholder@glitchtip.example/0')).toBeNull();
  });

  it('rejette un DSN absent ou vide', () => {
    expect(resolveGlitchtipDsn(undefined)).toBeNull();
    expect(resolveGlitchtipDsn(null)).toBeNull();
    expect(resolveGlitchtipDsn('')).toBeNull();
  });

  it('rejette les TLD réservés et localhost (RFC 2606)', () => {
    expect(resolveGlitchtipDsn('https://key@glitchtip.example/1')).toBeNull();
    expect(resolveGlitchtipDsn('https://key@collector.invalid/1')).toBeNull();
    expect(resolveGlitchtipDsn('https://key@localhost/1')).toBeNull();
    expect(resolveGlitchtipDsn('https://key@glitchtip.test/1')).toBeNull();
  });

  it('rejette un DSN sans clé publique — ingestion impossible', () => {
    expect(resolveGlitchtipDsn('https://app.glitchtip.com/42')).toBeNull();
    expect(resolveGlitchtipDsn('https://stub@app.glitchtip.com/42')).toBeNull();
  });

  it('rejette une URL non parsable ou un schéma non HTTP', () => {
    expect(resolveGlitchtipDsn('pas-une-url')).toBeNull();
    expect(resolveGlitchtipDsn('ftp://key@app.glitchtip.com/42')).toBeNull();
  });

  it('accepte un GlitchTip auto-hébergé — l’origine suit le DSN', () => {
    // La CSP ne doit pas figer un domaine : elle dérive de ce qui est posé.
    const resolved = resolveGlitchtipDsn('https://k@errors.darnatips.app/3');
    expect(resolved?.origin).toBe('https://errors.darnatips.app');
  });
});
