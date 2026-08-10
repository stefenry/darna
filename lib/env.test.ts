import { describe, it, expect } from 'vitest';
import { parseServerEnv } from './env';

const VALID = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc123',
  SUPABASE_SECRET_KEY: 'sb_secret_xyz789',
  BREVO_API_KEY: 'xkeysib-abc',
  BREVO_SENDER_EMAIL: 'noreply@darna.org',
  BREVO_SENDER_NAME: 'Darna',
  GLITCHTIP_DSN: 'https://abc@glitchtip.example/1',
  UPSTASH_REDIS_REST_URL: 'https://eu1-upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'tok_abc',
  CRON_SECRET: 'a'.repeat(40),
  CONSENT_TOKEN_SECRET: 'c'.repeat(40),
  PSEUDONYM_SECRET: 'p'.repeat(40),
  LEGAL_CONTACT_EMAIL: 'legal@darna.org',
  INITIAL_COMOD_EMAILS: 'co1@darna.org,co2@darna.org',
} as const;

describe('parseServerEnv', () => {
  it('accepte un set complet et valide', () => {
    expect(() => parseServerEnv(VALID as unknown as NodeJS.ProcessEnv)).not.toThrow();
  });

  it('rejette une cle Supabase ancienne (anon)', () => {
    const broken = {
      ...VALID,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_anon_xyz',
    };
    expect(() => parseServerEnv(broken as unknown as NodeJS.ProcessEnv)).toThrow(/sb_publishable_/);
  });

  it('rejette un CRON_SECRET trop court', () => {
    const broken = { ...VALID, CRON_SECRET: 'short' };
    expect(() => parseServerEnv(broken as unknown as NodeJS.ProcessEnv)).toThrow(/CRON_SECRET/);
  });

  it('rejette un BREVO_API_KEY manquant', () => {
    const broken = { ...VALID } as Record<string, string>;
    delete broken.BREVO_API_KEY;
    expect(() => parseServerEnv(broken as unknown as NodeJS.ProcessEnv)).toThrow(/BREVO_API_KEY/);
  });

  it('transforme INITIAL_COMOD_EMAILS CSV en array de emails', () => {
    const parsed = parseServerEnv(VALID as unknown as NodeJS.ProcessEnv);
    expect(parsed.INITIAL_COMOD_EMAILS).toEqual(['co1@darna.org', 'co2@darna.org']);
  });

  it('rejette INITIAL_COMOD_EMAILS contenant un email invalide', () => {
    const broken = { ...VALID, INITIAL_COMOD_EMAILS: 'co1@darna.org,not-an-email' };
    expect(() => parseServerEnv(broken as unknown as NodeJS.ProcessEnv)).toThrow(
      /INITIAL_COMOD_EMAILS/,
    );
  });

  it('rejette BREVO_SENDER_EMAIL si format e-mail invalide', () => {
    const broken = { ...VALID, BREVO_SENDER_EMAIL: 'not-an-email' };
    expect(() => parseServerEnv(broken as unknown as NodeJS.ProcessEnv)).toThrow(
      /BREVO_SENDER_EMAIL/,
    );
  });

  it('applique le default Darna sur BREVO_SENDER_NAME si absent', () => {
    const partial = { ...VALID } as Record<string, string>;
    delete partial.BREVO_SENDER_NAME;
    const parsed = parseServerEnv(partial as unknown as NodeJS.ProcessEnv);
    expect(parsed.BREVO_SENDER_NAME).toBe('Darna');
  });
});

// Régression 2026-08-05 — la prod tournait avec
// NEXT_PUBLIC_GLITCHTIP_DSN=https://placeholder@glitchtip.example/0 : le SDK
// s'initialisait, la CSP bloquait tout, aucune erreur ne remontait. Rien
// n'empêchait ce déploiement. Ces gardes le rendent impossible.
describe('parseServerEnv — DSN GlitchTip en production (VERCEL_ENV=production)', () => {
  const PROD = {
    ...VALID,
    VERCEL_ENV: 'production',
    SMS_PROVIDER: 'disabled',
    GLITCHTIP_DSN: 'https://key@app.glitchtip.com/1',
    NEXT_PUBLIC_GLITCHTIP_DSN: 'https://key@app.glitchtip.com/1',
  } as const;

  function parse(overrides: Record<string, string | undefined>) {
    const source = { ...PROD, ...overrides } as Record<string, string | undefined>;
    for (const [k, v] of Object.entries(overrides)) if (v === undefined) delete source[k];
    return () => parseServerEnv(source as unknown as NodeJS.ProcessEnv);
  }

  it('accepte deux DSN réels', () => {
    expect(parse({})).not.toThrow();
  });

  it('rejette le DSN bouchon réellement déployé', () => {
    expect(parse({ NEXT_PUBLIC_GLITCHTIP_DSN: 'https://placeholder@glitchtip.example/0' })).toThrow(
      /NEXT_PUBLIC_GLITCHTIP_DSN/,
    );
    expect(parse({ GLITCHTIP_DSN: 'https://placeholder@glitchtip.example/0' })).toThrow(
      /GLITCHTIP_DSN/,
    );
  });

  it('rejette le DSN client absent — le cas qui a cassé la prod côté navigateur', () => {
    expect(parse({ NEXT_PUBLIC_GLITCHTIP_DSN: undefined })).toThrow(/NEXT_PUBLIC_GLITCHTIP_DSN/);
  });

  it('rejette un DSN sans clé publique', () => {
    expect(parse({ GLITCHTIP_DSN: 'https://app.glitchtip.com/1' })).toThrow(/GLITCHTIP_DSN/);
  });

  it('accepte un GlitchTip auto-hébergé', () => {
    expect(
      parse({
        GLITCHTIP_DSN: 'https://k@errors.darnatips.app/3',
        NEXT_PUBLIC_GLITCHTIP_DSN: 'https://k@errors.darnatips.app/3',
      }),
    ).not.toThrow();
  });
});

describe('parseServerEnv — hors production, un DSN bouchon reste toléré', () => {
  // Un `pnpm build` local avec un stub doit rester possible : c'est le seul
  // moyen de tester le Service Worker, désactivé en dev.
  it.each([
    ['preview', 'preview'],
    ['development', 'development'],
    ['VERCEL_ENV absente (build local / CI)', undefined],
  ])('%s', (_label, vercelEnv) => {
    const source = {
      ...VALID,
      GLITCHTIP_DSN: 'https://stub@glitchtip.example/0',
      NEXT_PUBLIC_GLITCHTIP_DSN: 'https://stub@glitchtip.example/0',
    } as Record<string, string | undefined>;
    if (vercelEnv) source.VERCEL_ENV = vercelEnv;
    expect(() => parseServerEnv(source as unknown as NodeJS.ProcessEnv)).not.toThrow();
  });
});
