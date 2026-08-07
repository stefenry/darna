// AR30 / NFL10 — CSP stricte (story 1.10a), extraite de next.config.ts pour être
// unit-testable.
//
// Motif de l'extraction (régression observabilité 2026-08-05) : `connect-src`
// whitelistait `https://*.glitchtip.app` alors que GlitchTip Cloud est sur
// `app.glitchtip.com`. Rien ne pouvait attraper cet écart — la CSP n'était
// vérifiée par aucun test. Elle l'est maintenant, et l'origine GlitchTip dérive
// du DSN au lieu d'être recopiée à la main. Cf. lib/sentry/dsn.ts.

// Import relatif volontaire : ce module est chargé depuis next.config.ts, où les
// alias `@/` de tsconfig ne sont pas garantis.
import { resolveGlitchtipDsn } from '../sentry/dsn';

/**
 * Construit l'en-tête Content-Security-Policy.
 *
 * @param glitchtipDsn DSN client GlitchTip. Son origine est ajoutée à
 *   `connect-src` s'il est exploitable ; sinon aucune entrée n'est ajoutée — le
 *   SDK n'est pas initialisé non plus dans ce cas.
 */
export function buildCsp(glitchtipDsn: string | undefined | null): string {
  const glitchtipOrigin = resolveGlitchtipDsn(glitchtipDsn)?.origin;

  return [
    "default-src 'self'",
    // `script-src 'unsafe-inline'` accepté au MVP (bootstrap Next) — CSP
    // nonce-based différée post-bêta.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    // img-src : Supabase Storage + R2.
    "img-src 'self' data: https://*.supabase.co https://*.r2.cloudflarestorage.com",
    "font-src 'self'",
    // connect-src : Supabase (REST + Realtime wss), Brevo, GlitchTip, Upstash.
    [
      "connect-src 'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://api.brevo.com',
      ...(glitchtipOrigin ? [glitchtipOrigin] : []),
      'https://*.upstash.io',
    ].join(' '),
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}
