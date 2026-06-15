import { z } from 'zod';

const serverSchema = z.object({
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
  GLITCHTIP_DSN: z.url(),
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  CRON_SECRET: z.string().min(32, 'CRON_SECRET must be ≥32 chars (random)'),
  LEGAL_CONTACT_EMAIL: z.email(),
  INITIAL_COMOD_EMAILS: z
    .string()
    .transform((s) =>
      s
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.email()).min(1, 'INITIAL_COMOD_EMAILS must contain ≥1 valid email')),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
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
