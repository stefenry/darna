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
