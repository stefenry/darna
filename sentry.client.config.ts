import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from '@/lib/sentry/scrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_GLITCHTIP_DSN,
  tracesSampleRate: process.env.VERCEL_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.VERCEL_ENV || 'development',
  replaysSessionSampleRate: 0,
  // Story 2.5 review P13 — scrub des URLs `/consent/[token]`.
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
});
