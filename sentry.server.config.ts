import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.GLITCHTIP_DSN,
  // En prod : 10% des traces pour respecter le quota GlitchTip / le budget infra.
  // En dev / preview : 100% (debug).
  tracesSampleRate: process.env.VERCEL_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.VERCEL_ENV || 'development',
});
