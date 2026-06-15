import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.GLITCHTIP_DSN,
  tracesSampleRate: process.env.VERCEL_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.VERCEL_ENV || 'development',
});
