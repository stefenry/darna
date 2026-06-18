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

vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({
      host: 'darna.example',
      'x-forwarded-host': 'darna.example',
      'x-forwarded-proto': 'https',
      'accept-language': 'fr-FR,fr;q=0.9',
      cookie: 'NEXT_LOCALE=fr',
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

  it('redirects to /fr/auth/check-email on success', async () => {
    generateLinkMock.mockResolvedValue({
      data: {
        properties: { action_link: 'https://darna.example/auth/confirm?token_hash=abc' },
        user: { id: 'user-uuid-1' },
      },
      error: null,
    });
    sendTransactionalEmailMock.mockResolvedValue({ ok: true, messageId: 'msg-1' });

    await expect(signInMagicLink(initial, makeFormData('salma@example.com'))).rejects.toThrow(
      'NEXT_REDIRECT',
    );

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
    expect(redirectMock).toHaveBeenCalledWith('/fr/auth/check-email');
  });

  it('redirects to check-email WITHOUT sending when rate-limited (story 1.10b, anti-enumeration preserved)', async () => {
    checkLimitMock.mockResolvedValue({ success: false, reset: Date.now() + 1000 });

    await expect(signInMagicLink(initial, makeFormData('salma@example.com'))).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(generateLinkMock).not.toHaveBeenCalled();
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith('/fr/auth/check-email');
    const limited = logMock.mock.calls
      .map((c) => c[0] as { event: string })
      .find((e) => e.event === 'auth.rate_limited');
    expect(limited).toBeDefined();
  });

  it('still redirects to /fr/auth/check-email when generateLink fails (anti-enumeration)', async () => {
    generateLinkMock.mockResolvedValue({
      data: null,
      error: { code: 'user_not_found', message: 'No user' },
    });

    await expect(signInMagicLink(initial, makeFormData('unknown@example.com'))).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith('/fr/auth/check-email');
  });

  it('still redirects on Brevo send failure (no PII leak in logs)', async () => {
    generateLinkMock.mockResolvedValue({
      data: {
        properties: { action_link: 'https://darna.example/auth/confirm' },
        user: { id: 'user-uuid-1' },
      },
      error: null,
    });
    sendTransactionalEmailMock.mockResolvedValue({
      ok: false,
      errorCode: 'timeout',
      error: 'Brevo timeout',
    });

    await expect(signInMagicLink(initial, makeFormData('salma@example.com'))).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(redirectMock).toHaveBeenCalledWith('/fr/auth/check-email');
    // Logger called but no `email` field in payload (logger strips PII regardless,
    // but we double-check the entry passed in).
    for (const call of logMock.mock.calls) {
      const entry = call[0] as { payload?: Record<string, unknown> };
      expect(entry.payload ?? {}).not.toHaveProperty('email');
    }
  });
});
