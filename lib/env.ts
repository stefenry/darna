import { z } from 'zod';

const serverSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
      .string()
      .regex(/^sb_publishable_/, 'expected sb_publishable_* (new Supabase key format, AR3)'),
    SUPABASE_SECRET_KEY: z
      .string()
      .regex(/^sb_secret_/, 'expected sb_secret_* (new Supabase key format, AR3)'),
    BREVO_API_KEY: z.string().min(1),
    BREVO_SENDER_EMAIL: z.email(),
    BREVO_SENDER_NAME: z.string().min(1).default('Darna'),
    // Optional alternative provider : si présent, supplante Brevo pour les
    // transactionnels (lib/email/client.ts). Utilisé en staging tant que le
    // sender domain Brevo n'est pas validé.
    RESEND_API_KEY: z.string().optional(),
    GLITCHTIP_DSN: z.url(),
    UPSTASH_REDIS_REST_URL: z.url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
    CRON_SECRET: z.string().min(32, 'CRON_SECRET must be ≥32 chars (random)'),
    // Story 2.4 — secret HMAC des tokens de consentement artisan (signe le token
    // magic-link SMS ; validé par le webhook 2.5). ≥32 char aléatoires.
    CONSENT_TOKEN_SECRET: z.string().min(32, 'CONSENT_TOKEN_SECRET must be ≥32 chars (random)'),
    // Story 2.6 review D1 — secret HMAC pour le suffixe pseudonyme stable FR16.
    // Empêche un co_mod (avec accès `users.id`) de rétro-calculer offline la map
    // (user, artisan) → suffixe. ≥32 chars aléatoires, distinct de CONSENT_TOKEN_SECRET.
    PSEUDONYM_SECRET: z.string().min(32, 'PSEUDONYM_SECRET must be ≥32 chars (random)'),
    // Story 2.4 — provider SMS. `log` (défaut MVP) = loggue le magic link sans
    // envoi réel (aucun compte requis). `brevo` = Brevo SMS (réutilise BREVO_API_KEY)
    // → nécessite BREVO_SMS_SENDER + couverture Maroc confirmée.
    SMS_PROVIDER: z.enum(['log', 'brevo']).default('log'),
    BREVO_SMS_SENDER: z.string().max(11).optional(),
    LEGAL_CONTACT_EMAIL: z.email(),
    // Optional post-invite : l'app ne crashe pas si purgé (runbook §3). Les
    // notifications co-mod (admission-submit.ts) itèrent sur [] si absent.
    INITIAL_COMOD_EMAILS: z
      .string()
      .optional()
      .transform((s) =>
        (s ?? '')
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.email())),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    // Story 1.10d — Backup hebdo R2 (AR29). Optionnels au MVP : le scaffold ne
    // fail-fast pas l'app tant que le bucket R2 n'est pas provisionné. Requis en
    // prod pour que l'Edge Function weekly-backup uploade le dump (cf. runbook).
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  })
  .superRefine((env, ctx) => {
    // Review 2026-06-18 P13 — si Brevo activé, sender requis.
    if (env.SMS_PROVIDER === 'brevo' && !env.BREVO_SMS_SENDER) {
      ctx.addIssue({
        code: 'custom',
        path: ['BREVO_SMS_SENDER'],
        message: 'BREVO_SMS_SENDER required when SMS_PROVIDER=brevo',
      });
    }
    // Review 2026-06-18 P4 — l'adapter `log` est dev/MVP seulement. Ne JAMAIS
    // déployer en prod (le SMS body contient le raw token magic-link).
    if (env.NODE_ENV === 'production' && env.SMS_PROVIDER === 'log') {
      ctx.addIssue({
        code: 'custom',
        path: ['SMS_PROVIDER'],
        message: 'SMS_PROVIDER=log interdit en production (leak token raw dans logs)',
      });
    }
  });

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .regex(/^sb_publishable_/, 'expected sb_publishable_* (new Supabase key format, AR3)'),
  // Canonical app origin — single source of truth for absolute URLs (magic-link
  // redirectTo, etc.). Required to defeat Host-header injection: never derive
  // the public origin from request headers in prod.
  NEXT_PUBLIC_SITE_URL: z.url(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
}

export function parseServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result = serverSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `[env] Missing or invalid server environment variables:\n${formatIssues(result.error)}`,
    );
  }
  return result.data;
}

export function parseClientEnv(source: NodeJS.ProcessEnv = process.env): ClientEnv {
  const result = clientSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `[env] Missing or invalid client environment variables:\n${formatIssues(result.error)}`,
    );
  }
  return result.data;
}

// Schéma test-only pour la stack Supabase Docker locale (cf. `npx supabase status`).
// Utilisé par tests/rls.test.ts — séparé du serverSchema car ces clés n'existent
// pas en prod et ne doivent pas faire fail-fast l'app. Review 1.3.
const supabaseLocalSchema = z.object({
  SUPABASE_LOCAL_URL: z.url().default('http://127.0.0.1:54321'),
  SUPABASE_LOCAL_SERVICE_KEY: z.string().min(1, 'requis (voir `npx supabase status`)'),
  SUPABASE_LOCAL_PUBLISHABLE_KEY: z.string().min(1, 'requis (voir `npx supabase status`)'),
});

export type SupabaseLocalEnv = z.infer<typeof supabaseLocalSchema>;

export function parseSupabaseLocalEnv(source: NodeJS.ProcessEnv = process.env): SupabaseLocalEnv {
  const result = supabaseLocalSchema.safeParse(source);
  if (!result.success) {
    throw new Error(
      `[env] Missing or invalid Supabase local-stack env vars (test-only):\n${formatIssues(result.error)}`,
    );
  }
  return result.data;
}

// AC5: parse au module-load (fail-fast au démarrage de l'app).
// Côté server : parse les deux schémas. Côté client : seul clientSchema est parsable
// (les variables non-NEXT_PUBLIC_* n'existent pas dans le bundle client).
const isServer = typeof window === 'undefined';
const serverEnv: ServerEnv | null = isServer ? parseServerEnv() : null;
const clientEnv: ClientEnv = parseClientEnv();

export const env = {
  get server(): ServerEnv {
    if (!isServer || serverEnv === null) {
      throw new Error('[env] env.server is not accessible client-side');
    }
    return serverEnv;
  },
  get client(): ClientEnv {
    return clientEnv;
  },
};
