// AC5 : env.ts parse au module-load. On stub process.env AVANT tout import
// pour que `parseServerEnv()` / `parseClientEnv()` réussissent en contexte test.
// Les tests qui veulent valider un env invalide passent leur propre source à
// `parseServerEnv(source)`.
process.env.NEXT_PUBLIC_SITE_URL ??= 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= 'sb_publishable_test_stub';
process.env.SUPABASE_SECRET_KEY ??= 'sb_secret_test_stub';
process.env.BREVO_API_KEY ??= 'xkeysib-test-stub';
process.env.BREVO_SENDER_EMAIL ??= 'noreply@darna.local';
process.env.BREVO_SENDER_NAME ??= 'Darna';
process.env.GLITCHTIP_DSN ??= 'https://stub@glitchtip.local/1';
process.env.UPSTASH_REDIS_REST_URL ??= 'http://localhost:8079';
process.env.UPSTASH_REDIS_REST_TOKEN ??= 'tok_stub';
process.env.CRON_SECRET ??= 'a'.repeat(40);
process.env.CONSENT_TOKEN_SECRET ??= 'c'.repeat(40);
process.env.PSEUDONYM_SECRET ??= 'p'.repeat(40);
process.env.LEGAL_CONTACT_EMAIL ??= 'legal@darna.local';
process.env.INITIAL_COMOD_EMAILS ??= 'co1@darna.local,co2@darna.local';

// jsdom n'implémente pas ResizeObserver (utilisé par Radix UI, ex. Checkbox).
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

import '@testing-library/jest-dom/vitest';
