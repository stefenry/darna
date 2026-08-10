// Story 1.2 — résolution du DSN GlitchTip, partagée par les 3 points d'init
// (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`)
// ET par la CSP de `next.config.ts`.
//
// Régression prod 2026-08-05 : `NEXT_PUBLIC_GLITCHTIP_DSN` valait
// `https://placeholder@glitchtip.example/0` sur Vercel (constaté inliné dans le
// bundle client servi). `Sentry.init()` acceptait ce DSN sans broncher, donc le
// SDK tentait d'émettre à chaque erreur, la CSP bloquait chaque envoi, et la
// console partait en boucle de « Refused to connect ». L'observabilité avait
// l'air câblée alors qu'aucune erreur ne remontait.
//
// Deux règles en découlent :
//   1. un DSN inutilisable n'initialise PAS le SDK — on préfère un
//      avertissement explicite à une remontée silencieusement morte ;
//   2. l'origine autorisée par `connect-src` est DÉRIVÉE du DSN, pour qu'elle ne
//      puisse plus diverger de lui. La CSP whitelistait `https://*.glitchtip.app`
//      alors que GlitchTip Cloud est sur `app.glitchtip.com` : même en posant le
//      bon DSN, tous les envois seraient restés bloqués.

/**
 * Hôtes qui ne peuvent pas être un vrai collecteur : `.example` et `.invalid`
 * sont des TLD réservés (RFC 2606), `localhost` n'est pas joignable depuis le
 * navigateur d'un résident.
 */
function isUnusableHost(hostname: string): boolean {
  return hostname === 'localhost' || /\.(example|invalid|test|localhost)$/.test(hostname);
}

export type ResolvedDsn = {
  /** Le DSN tel quel, à passer à `Sentry.init({ dsn })`. */
  dsn: string;
  /** L'origine à autoriser dans `connect-src` (ex. `https://app.glitchtip.com`). */
  origin: string;
};

/**
 * Renvoie le DSN et son origine s'il est exploitable, `null` sinon (absent, non
 * parsable, hôte réservé, ou clé publique manifestement bouchon).
 */
export function resolveGlitchtipDsn(raw: string | undefined | null): ResolvedDsn | null {
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (isUnusableHost(url.hostname)) return null;

  // Dans un DSN Sentry/GlitchTip, la clé publique est le `username` de l'URL
  // (`https://<clé>@<hôte>/<projet>`). Sans clé, l'ingestion est impossible.
  const key = url.username;
  if (!key || key === 'placeholder' || key === 'stub') return null;

  return { dsn: raw, origin: url.origin };
}
