// Lecture *locale* (zéro appel réseau) de la session Supabase telle qu'elle est
// stockée dans les cookies `sb-<ref>-auth-token[.N]`.
//
// Sert au proxy pour décider s'il doit rafraîchir la session sur les requêtes
// RSC / prefetch : sans ça, c'est le Server Component qui déclenche le refresh
// via `getUser()`, et le token pivoté est perdu (`cookies().set()` throw en RSC,
// cf. lib/supabase/server.ts) → la session meurt passé le
// `refresh_token_reuse_interval`.
//
// On ne VÉRIFIE PAS la signature ici : la valeur lue ne sert qu'à décider
// « faut-il rafraîchir maintenant ? ». Toute décision d'autorisation reste prise
// par `supabase.auth.getUser()` (validation serveur) dans le proxy et les gardes
// requireResident / requireComod.

// `sb-<ref>-auth-token` + suffixe de chunk optionnel `.0`, `.1`… L'ancrage de
// fin exclut `sb-<ref>-auth-token-code-verifier` (cookie PKCE, pas une session).
const AUTH_COOKIE_PATTERN = /^sb-.+-auth-token(?:\.(\d+))?$/;
const BASE64_PREFIX = 'base64-';

export type SessionCookieState =
  | { kind: 'absent' }
  | { kind: 'unreadable' }
  | { kind: 'present'; expiresAt: number | null };

// atob + TextDecoder plutôt que Buffer : dispo à l'identique sur le runtime Edge
// (proxy) et sous vitest/node.
function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function jwtExpiry(accessToken: unknown): number | null {
  if (typeof accessToken !== 'string') return null;
  const payload = accessToken.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(decodeBase64Url(payload)) as { exp?: unknown };
    return typeof claims.exp === 'number' ? claims.exp : null;
  } catch {
    return null;
  }
}

/**
 * Reconstitue la session depuis les cookies et renvoie sa date d'expiration
 * (epoch secondes). `unreadable` = cookie présent mais illisible (chunks
 * partiels, format changé par une future version de @supabase/ssr) : l'appelant
 * doit alors retomber sur le chemin réseau plutôt que de supposer la session
 * fraîche.
 */
export function readSessionCookie(
  cookies: readonly { name: string; value: string }[],
): SessionCookieState {
  const chunks = cookies
    .map((cookie) => ({ cookie, match: AUTH_COOKIE_PATTERN.exec(cookie.name) }))
    .filter((entry): entry is { cookie: { name: string; value: string }; match: RegExpExecArray } =>
      Boolean(entry.match),
    );

  if (chunks.length === 0) return { kind: 'absent' };

  const raw = chunks
    .sort((a, b) => Number(a.match[1] ?? 0) - Number(b.match[1] ?? 0))
    .map((entry) => entry.cookie.value)
    .join('');

  if (raw.length === 0) return { kind: 'unreadable' };

  let json = raw;
  if (raw.startsWith(BASE64_PREFIX)) {
    try {
      json = decodeBase64Url(raw.slice(BASE64_PREFIX.length));
    } catch {
      return { kind: 'unreadable' };
    }
  }

  let session: { expires_at?: unknown; access_token?: unknown };
  try {
    session = JSON.parse(json) as typeof session;
  } catch {
    return { kind: 'unreadable' };
  }

  const expiresAt =
    typeof session.expires_at === 'number' ? session.expires_at : jwtExpiry(session.access_token);

  return { kind: 'present', expiresAt };
}

/**
 * Vrai si le proxy doit rafraîchir la session MAINTENANT (appel réseau), faux
 * s'il peut laisser passer la requête sans rien faire.
 *
 * `unreadable` → true (on préfère un appel réseau de trop à une session perdue).
 * `absent` → false (visiteur anonyme, rien à rafraîchir).
 */
export function needsProactiveRefresh(
  state: SessionCookieState,
  nowSeconds: number,
  marginSeconds: number,
): boolean {
  if (state.kind === 'absent') return false;
  if (state.kind === 'unreadable') return true;
  if (state.expiresAt === null) return true;
  return state.expiresAt - nowSeconds <= marginSeconds;
}
