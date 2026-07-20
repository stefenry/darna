// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redirectMock = vi.fn((path: string): never => {
  void path;
  throw new Error('NEXT_REDIRECT');
});
const generateLinkMock = vi.fn();
const sendTransactionalEmailMock = vi.fn();
const logMock = vi.fn();
const checkLimitMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (path: string) => redirectMock(path),
}));

const cookieSetMock = vi.fn();

vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({
      host: 'darna.example',
      'x-forwarded-host': 'darna.example',
      'x-forwarded-proto': 'https',
      'accept-language': 'fr-FR,fr;q=0.9',
      cookie: 'NEXT_LOCALE=fr',
    }),
  cookies: async () => ({
    set: (...args: unknown[]) => cookieSetMock(...args),
    get: () => undefined,
  }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        generateLink: (args: unknown) => generateLinkMock(args),
      },
    },
  }),
}));

vi.mock('@/lib/email/send', () => ({
  sendTransactionalEmail: (args: unknown) => sendTransactionalEmailMock(args),
}));

vi.mock('@/lib/logger', () => ({
  log: (entry: unknown) => logMock(entry),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkLimit: (...args: unknown[]) => checkLimitMock(...args),
}));

import { signInMagicLink } from '@/app/actions/auth-signin';

const initial = { ok: false };

function makeFormData(email: unknown) {
  const fd = new FormData();
  if (typeof email === 'string') fd.set('email', email);
  return fd;
}

describe('signInMagicLink Server Action', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    cookieSetMock.mockClear();
    generateLinkMock.mockReset();
    sendTransactionalEmailMock.mockReset();
    logMock.mockReset();
    checkLimitMock.mockReset();
    checkLimitMock.mockResolvedValue({ success: true, reset: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns fieldErrors when email is missing', async () => {
    const result = await signInMagicLink(initial, makeFormData(undefined));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.email).toBeDefined();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(generateLinkMock).not.toHaveBeenCalled();
  });

  it('returns fieldErrors when email is invalid', async () => {
    const result = await signInMagicLink(initial, makeFormData('not-an-email'));
    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.email).toBeDefined();
    expect(generateLinkMock).not.toHaveBeenCalled();
  });

  // Depuis la confirmation in-page (UX bêta 2026-06), signInMagicLink ne
  // redirige plus vers /auth/check-email : elle retourne { ok, sent, emailMasked }
  // et pose le cookie darna_login_email pour le bouton « Renvoyer un code ».
  it('returns sent:true with masked email on success (in-page confirmation, no redirect)', async () => {
    generateLinkMock.mockResolvedValue({
      data: {
        properties: { hashed_token: 'pkce-hashed-token-abc', email_otp: '123456' },
        user: { id: 'user-uuid-1' },
      },
      error: null,
    });
    sendTransactionalEmailMock.mockResolvedValue({ ok: true, messageId: 'msg-1' });

    const result = await signInMagicLink(initial, makeFormData('salma@example.com'));
    expect(result).toEqual({ ok: true, sent: true, emailMasked: 'sa***@example.com' });
    expect(redirectMock).not.toHaveBeenCalled();

    expect(generateLinkMock).toHaveBeenCalledOnce();
    const genCall = generateLinkMock.mock.calls[0];
    if (!genCall) throw new Error('generateLink was not called');
    expect(genCall[0]).toMatchObject({
      type: 'magiclink',
      email: 'salma@example.com',
    });
    expect(sendTransactionalEmailMock).toHaveBeenCalledOnce();
    const sendCall = sendTransactionalEmailMock.mock.calls[0];
    if (!sendCall) throw new Error('sendTransactionalEmail was not called');
    expect(sendCall[0]).toMatchObject({
      template: 'magic-link',
      to: 'salma@example.com',
      locale: 'fr',
    });
    // Le lien envoyé est l'URL PKCE construite depuis hashed_token, avec le code OTP.
    const vars = (sendCall[0] as { vars: { link: string; code?: string } }).vars;
    expect(vars.link).toContain('token_hash=pkce-hashed-token-abc');
    expect(vars.code).toBe('123456');
    // Cookie « Renvoyer un code » posé (httpOnly).
    expect(cookieSetMock).toHaveBeenCalledWith(
      'darna_login_email',
      'salma@example.com',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('returns the SAME sent:true state WITHOUT sending when rate-limited (story 1.10b, anti-enumeration preserved)', async () => {
    checkLimitMock.mockResolvedValue({ success: false, reset: Date.now() + 1000 });

    const result = await signInMagicLink(initial, makeFormData('salma@example.com'));
    expect(result).toEqual({ ok: true, sent: true, emailMasked: 'sa***@example.com' });

    expect(generateLinkMock).not.toHaveBeenCalled();
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
    const limited = logMock.mock.calls
      .map((c) => c[0] as { event: string })
      .find((e) => e.event === 'auth.rate_limited');
    expect(limited).toBeDefined();
  });

  it('still returns sent:true when generateLink fails (anti-enumeration)', async () => {
    generateLinkMock.mockResolvedValue({
      data: null,
      error: { code: 'user_not_found', message: 'No user' },
    });

    const result = await signInMagicLink(initial, makeFormData('unknown@example.com'));
    expect(result).toMatchObject({ ok: true, sent: true });
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it('still returns sent:true on Brevo send failure (no PII leak in logs)', async () => {
    generateLinkMock.mockResolvedValue({
      data: {
        properties: { hashed_token: 'pkce-hashed-token-abc' },
        user: { id: 'user-uuid-1' },
      },
      error: null,
    });
    sendTransactionalEmailMock.mockResolvedValue({
      ok: false,
      errorCode: 'timeout',
      error: 'Brevo timeout',
    });

    const result = await signInMagicLink(initial, makeFormData('salma@example.com'));
    expect(result).toMatchObject({ ok: true, sent: true });
    // Logger called but no `email` field in payload (logger strips PII regardless,
    // but we double-check the entry passed in).
    for (const call of logMock.mock.calls) {
      const entry = call[0] as { payload?: Record<string, unknown> };
      expect(entry.payload ?? {}).not.toHaveProperty('email');
    }
  });
});
