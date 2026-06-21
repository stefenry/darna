// 2026-06-21 — Construit l'URL PKCE consommée par app/auth/confirm/route.ts à
// partir du `hashed_token` retourné par admin.auth.admin.generateLink().
//
// Avant ce helper, le code envoyait `data.properties.action_link` (URL legacy
// vers /auth/v1/verify Supabase) dans les e-mails magic-link. Le verify Supabase
// redirige ensuite vers redirectTo AVEC le token (success) ou un fragment
// `#error=access_denied&error_code=otp_expired` (échec). Le route handler
// /auth/confirm/route.ts ne lit que les query params `?token_hash=&type=email`
// (PKCE) — il ne parse pas le fragment serveur-side → tout user atterrit sur
// /auth/error?reason=invalid, même au premier clic légitime, dès que le verify
// passe par le fragment flow.
//
// Solution : on saute le verify Supabase et on parle direct au confirm route
// handler en construisant l'URL PKCE nous-mêmes.
//
// NB : `nextPath` doit être une route locale absolue (ex `/fr/admission/pending`).

import { isSafeActionLink } from './safe-action-link';

export function buildPkceConfirmUrl(args: {
  baseUrl: string;
  hashedToken: string;
  nextPath: string;
}): string | null {
  const { baseUrl, hashedToken, nextPath } = args;
  if (!hashedToken || typeof hashedToken !== 'string') return null;
  if (!nextPath.startsWith('/')) return null;
  const url = `${baseUrl}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=email&next=${encodeURIComponent(nextPath)}`;
  return isSafeActionLink(url) ? url : null;
}
