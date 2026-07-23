// @vitest-environment node
// Pivot SMS Twilio (2026-07-22) — l'accès WhatsApp Cloud API est bloqué par la
// restriction Meta du compte ; Twilio devient le provider SMS de prod (aucune
// dépendance Meta, enregistrement sender ID Maroc géré via la console Twilio).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendSmsViaTwilio } from './client';
import { env } from '@/lib/env';
import { parseServerEnv } from '@/lib/env';

const okJson = (body: unknown, status = 201) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('sendSmsViaTwilio', () => {
  afterEach(() => vi.restoreAllMocks());

  it('POST form-encodé vers Messages.json avec Basic auth et MessagingServiceSid', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(okJson({ sid: 'SM123', status: 'queued' }));

    const res = await sendSmsViaTwilio('+212600000001', 'Darna : test');

    expect(res).toEqual({ ok: true, messageId: 'SM123' });
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe(
      `https://api.twilio.com/2010-04-01/Accounts/${env.server.TWILIO_ACCOUNT_SID}/Messages.json`,
    );
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^Basic /);
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    const params = new URLSearchParams(String(init?.body));
    expect(params.get('To')).toBe('+212600000001');
    expect(params.get('Body')).toBe('Darna : test');
    expect(params.get('MessagingServiceSid')).toBe(env.server.TWILIO_MESSAGING_SERVICE_SID);
    expect(params.get('From')).toBeNull();
  });

  it('mappe une erreur API Twilio (code + message) sans throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson({ code: 21211, message: "The 'To' number is not a valid phone number." }, 400),
    );
    const res = await sendSmsViaTwilio('+212600000001', 'x');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorCode).toBe('21211');
      expect(res.error).toContain('not a valid phone number');
    }
  });

  it('mappe un timeout (AbortError) en errorCode=timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    );
    const res = await sendSmsViaTwilio('+212600000001', 'x');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('timeout');
  });

  it('mappe un échec réseau en errorCode=network', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNRESET'));
    const res = await sendSmsViaTwilio('+212600000001', 'x');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errorCode).toBe('network');
  });
});

describe('env — SMS_PROVIDER=twilio', () => {
  const base: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
    SUPABASE_SECRET_KEY: 'sb_secret_x',
    BREVO_API_KEY: 'k',
    BREVO_SENDER_EMAIL: 'a@b.co',
    GLITCHTIP_DSN: 'https://x@glitchtip.local/1',
    UPSTASH_REDIS_REST_URL: 'http://localhost:8079',
    UPSTASH_REDIS_REST_TOKEN: 't',
    CRON_SECRET: 'a'.repeat(40),
    CONSENT_TOKEN_SECRET: 'c'.repeat(40),
    PSEUDONYM_SECRET: 'p'.repeat(40),
    LEGAL_CONTACT_EMAIL: 'legal@darna.local',
  };

  it('exige ACCOUNT_SID + AUTH_TOKEN + (MessagingServiceSid OU From)', () => {
    expect(() => parseServerEnv({ ...base, SMS_PROVIDER: 'twilio' })).toThrow(/TWILIO/);
    expect(() =>
      parseServerEnv({
        ...base,
        SMS_PROVIDER: 'twilio',
        TWILIO_ACCOUNT_SID: 'ACxxxxxxxx',
        TWILIO_AUTH_TOKEN: 'tok',
      }),
    ).toThrow(/TWILIO_MESSAGING_SERVICE_SID|TWILIO_FROM/);
    expect(() =>
      parseServerEnv({
        ...base,
        SMS_PROVIDER: 'twilio',
        TWILIO_ACCOUNT_SID: 'ACxxxxxxxx',
        TWILIO_AUTH_TOKEN: 'tok',
        TWILIO_FROM: 'Darna',
      }),
    ).not.toThrow();
  });

  it('reste permissif quand le provider est log/brevo (variables Twilio absentes)', () => {
    expect(() => parseServerEnv({ ...base, SMS_PROVIDER: 'log' })).not.toThrow();
  });
});
