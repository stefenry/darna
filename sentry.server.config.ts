import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from '@/lib/sentry/scrub';

Sentry.init({
  dsn: process.env.GLITCHTIP_DSN,
  // En prod : 10% des traces pour respecter le quota GlitchTip / le budget infra.
  // En dev / preview : 100% (debug).
  tracesSampleRate: process.env.VERCEL_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.VERCEL_ENV || 'development',
  // Story 2.5 review P13 — scrub des URLs `/consent/[token]` (raw token jamais
  // dans les logs Sentry / GlitchTip).
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
});
