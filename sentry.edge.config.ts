import * as Sentry from '@sentry/nextjs';
import { resolveGlitchtipDsn } from '@/lib/sentry/dsn';

// Cf. lib/sentry/dsn.ts (régression prod 2026-08-05).
const glitchtip = resolveGlitchtipDsn(process.env.GLITCHTIP_DSN);

if (glitchtip) {
  Sentry.init({
    dsn: glitchtip.dsn,
    tracesSampleRate: process.env.VERCEL_ENV === 'production' ? 0.1 : 1.0,
    environment: process.env.VERCEL_ENV || 'development',
  });
}
