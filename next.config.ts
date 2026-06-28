import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const withSerwist = withSerwistInit({
  swSrc: 'sw/index.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  disable: process.env.NODE_ENV === 'development',
  // Story 7.3 — précache la page de repli hors-ligne pour qu'elle soit servie
  // même à la toute première visite sans réseau (référencée par `fallbacks`
  // dans sw/index.ts). Bump le `revision` quand le contenu de la page change.
  additionalPrecacheEntries: [{ url: '/fr/offline', revision: '7-3-offline-v1' }],
});

// AR30 / NFL10 — CSP stricte (story 1.10a). connect-src whitelist : Supabase
// (REST + Realtime wss), Brevo, GlitchTip, Upstash. img-src : Supabase Storage +
// R2. `script-src 'unsafe-inline'` accepté au MVP (bootstrap Next) — CSP
// nonce-based différée post-bêta. ⚠️ valider sur preview Vercel avant prod.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.supabase.co https://*.r2.cloudflarestorage.com",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.brevo.com https://*.glitchtip.app https://*.upstash.io",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  'upgrade-insecure-requests',
].join('; ');

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  // Story 8.2 — la page /transparence lit le texte éditorial via fs.readFile
  // (content/transparence/*.md). Inclut explicitement ces fichiers dans le bundle
  // serverless (le tracing ne les détecte pas via un chemin construit à l'exécution).
  outputFileTracingIncludes: {
    '/[locale]/transparence': ['./content/transparence/**'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          { key: 'Content-Security-Policy', value: CSP },
        ],
      },
      {
        source: '/:locale/install',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      {
        // Story 2.5 review P11 — token raw dans l'URL ; jamais cacher.
        source: '/consent/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        // Story 2.8 — token raw + PII fiche dans /respond/[token].
        source: '/respond/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        // Story 2.8 — formulaire phone (enumeration AR38) ; jamais cacher.
        source: '/artisan/contact',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
    ];
  },
};

export default withSentryConfig(withSerwist(withNextIntl(nextConfig)), {
  silent: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
