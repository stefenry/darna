import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';
import withSerwistInit from '@serwist/next';
import { buildCsp } from './lib/security/csp';

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

// AR30 / NFL10 — CSP stricte (story 1.10a), construite dans lib/security/csp.ts
// pour être unit-testable. L'origine GlitchTip de `connect-src` est dérivée du
// DSN client (régression observabilité 2026-08-05 : la liste figeait
// `https://*.glitchtip.app` alors que GlitchTip Cloud est sur
// `app.glitchtip.com`, donc tous les envois restaient bloqués).
const CSP = buildCsp(process.env.NEXT_PUBLIC_GLITCHTIP_DSN);

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
