import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from '@/lib/sentry/scrub';
import { resolveGlitchtipDsn } from '@/lib/sentry/dsn';

// Régression prod 2026-08-05 — sans ce garde, un DSN bouchon initialisait le SDK
// et chaque erreur partait vers un hôte injoignable, bloquée par la CSP, en
// noyant la console de violations. Cf. lib/sentry/dsn.ts.
const glitchtip = resolveGlitchtipDsn(process.env.NEXT_PUBLIC_GLITCHTIP_DSN);

if (!glitchtip) {
  console.warn(
    '[observabilité] NEXT_PUBLIC_GLITCHTIP_DSN absent ou non exploitable — remontée des erreurs client DÉSACTIVÉE.',
  );
} else {
  Sentry.init({
    dsn: glitchtip.dsn,
    tracesSampleRate: process.env.VERCEL_ENV === 'production' ? 0.1 : 1.0,
    environment: process.env.VERCEL_ENV || 'development',
    replaysSessionSampleRate: 0,
    // Story 2.5 review P13 — scrub des URLs `/consent/[token]`.
    beforeSend: (event) => scrubSentryEvent(event),
    beforeSendTransaction: (event) => scrubSentryEvent(event),
  });
}
