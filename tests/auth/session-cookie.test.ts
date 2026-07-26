// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { needsProactiveRefresh, readSessionCookie } from '@/lib/auth/session-cookie';

const NOW = 1_800_000_000;

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sessionCookie(
  session: Record<string, unknown>,
  { chunkSize }: { chunkSize?: number } = {},
): { name: string; value: string }[] {
  const raw = `base64-${base64Url(JSON.stringify(session))}`;
  if (!chunkSize) return [{ name: 'sb-abcdef-auth-token', value: raw }];
  const chunks: { name: string; value: string }[] = [];
  for (let i = 0; i * chunkSize < raw.length; i += 1) {
    chunks.push({
      name: `sb-abcdef-auth-token.${i}`,
      value: raw.slice(i * chunkSize, (i + 1) * chunkSize),
    });
  }
  return chunks;
}

function jwt(exp: number): string {
  return `${base64Url('{"alg":"HS256"}')}.${base64Url(JSON.stringify({ exp }))}.sig`;
}

describe('readSessionCookie', () => {
  it('renvoie absent sans cookie de session', () => {
    expect(readSessionCookie([])).toEqual({ kind: 'absent' });
    expect(readSessionCookie([{ name: 'NEXT_LOCALE', value: 'fr' }])).toEqual({ kind: 'absent' });
  });

  it('ignore le cookie PKCE code-verifier (pas une session)', () => {
    expect(
      readSessionCookie([{ name: 'sb-abcdef-auth-token-code-verifier', value: 'xyz' }]),
    ).toEqual({ kind: 'absent' });
  });

  it('lit expires_at depuis un cookie base64 non chunké', () => {
    const cookies = sessionCookie({ expires_at: NOW + 1200, access_token: jwt(NOW + 1200) });
    expect(readSessionCookie(cookies)).toEqual({ kind: 'present', expiresAt: NOW + 1200 });
  });

  it('recombine les chunks dans l’ordre numérique (y compris .10 après .9)', () => {
    const cookies = sessionCookie(
      { expires_at: NOW + 60, padding: 'x'.repeat(400) },
      {
        chunkSize: 40,
      },
    );
    expect(cookies.length).toBeGreaterThan(10);
    const shuffled = [...cookies].reverse();
    expect(readSessionCookie(shuffled)).toEqual({ kind: 'present', expiresAt: NOW + 60 });
  });

  it('retombe sur le exp du JWT quand expires_at est absent', () => {
    const cookies = sessionCookie({ access_token: jwt(NOW + 300) });
    expect(readSessionCookie(cookies)).toEqual({ kind: 'present', expiresAt: NOW + 300 });
  });

  it('accepte une valeur JSON brute (sans préfixe base64-)', () => {
    const cookies = [
      { name: 'sb-abcdef-auth-token', value: JSON.stringify({ expires_at: NOW + 10 }) },
    ];
    expect(readSessionCookie(cookies)).toEqual({ kind: 'present', expiresAt: NOW + 10 });
  });

  it('renvoie unreadable sur des chunks tronqués', () => {
    const chunks = sessionCookie(
      { expires_at: NOW + 60, padding: 'x'.repeat(400) },
      {
        chunkSize: 40,
      },
    );
    expect(readSessionCookie(chunks.slice(0, 1))).toEqual({ kind: 'unreadable' });
  });

  it('renvoie unreadable sur un cookie vide', () => {
    expect(readSessionCookie([{ name: 'sb-abcdef-auth-token', value: '' }])).toEqual({
      kind: 'unreadable',
    });
  });

  it('renvoie present/expiresAt null quand aucune date n’est exploitable', () => {
    const cookies = sessionCookie({ token_type: 'bearer' });
    expect(readSessionCookie(cookies)).toEqual({ kind: 'present', expiresAt: null });
  });
});

describe('needsProactiveRefresh', () => {
  const margin = 300;

  it('ne rafraîchit rien pour un visiteur anonyme', () => {
    expect(needsProactiveRefresh({ kind: 'absent' }, NOW, margin)).toBe(false);
  });

  it('laisse passer une session largement valide', () => {
    expect(needsProactiveRefresh({ kind: 'present', expiresAt: NOW + 3600 }, NOW, margin)).toBe(
      false,
    );
  });

  it('rafraîchit dans la marge, avant expiration réelle', () => {
    expect(needsProactiveRefresh({ kind: 'present', expiresAt: NOW + 299 }, NOW, margin)).toBe(
      true,
    );
  });

  it('rafraîchit une session déjà expirée', () => {
    expect(needsProactiveRefresh({ kind: 'present', expiresAt: NOW - 1 }, NOW, margin)).toBe(true);
  });

  it('rafraîchit par défaut quand le cookie est illisible ou sans expiration', () => {
    expect(needsProactiveRefresh({ kind: 'unreadable' }, NOW, margin)).toBe(true);
    expect(needsProactiveRefresh({ kind: 'present', expiresAt: null }, NOW, margin)).toBe(true);
  });
});
