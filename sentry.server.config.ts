import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from '@/lib/sentry/scrub';
import { resolveGlitchtipDsn } from '@/lib/sentry/dsn';

// Cf. lib/sentry/dsn.ts (régression prod 2026-08-05). Côté serveur la CSP ne
// s'applique pas : un DSN bouchon ne produit pas des violations mais des
// tentatives réseau vers un hôte inexistant à chaque erreur capturée. On préfère
// un avertissement explicite au démarrage.
const glitchtip = resolveGlitchtipDsn(process.env.GLITCHTIP_DSN);

if (!glitchtip) {
  console.warn(
    '[observabilité] GLITCHTIP_DSN absent ou non exploitable — remontée des erreurs serveur DÉSACTIVÉE.',
  );
} else {
  Sentry.init({
    dsn: glitchtip.dsn,
    // En prod : 10% des traces pour respecter le quota GlitchTip / le budget infra.
    // En dev / preview : 100% (debug).
    tracesSampleRate: process.env.VERCEL_ENV === 'production' ? 0.1 : 1.0,
    environment: process.env.VERCEL_ENV || 'development',
    // Story 2.5 review P13 — scrub des URLs `/consent/[token]` (raw token jamais
    // dans les logs Sentry / GlitchTip).
    beforeSend: (event) => scrubSentryEvent(event),
    beforeSendTransaction: (event) => scrubSentryEvent(event),
  });
}
