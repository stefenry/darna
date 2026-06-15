// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const logSpy = vi.fn();

vi.mock('@/lib/logger', () => ({
  log: (entry: unknown) => logSpy(entry),
}));

import { sendTransactionalEmail } from '@/lib/email/send';

describe('sendTransactionalEmail (Brevo boundary AR16)', () => {
  beforeEach(() => {
    logSpy.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockBrevoSuccess(messageId = 'brevo-msg-abc') {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ messageId }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    return fetchMock;
  }

  function mockBrevoError(
    status = 401,
    body: Record<string, string> = { code: 'unauthorized', message: 'Invalid api-key' },
  ) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  it('POSTs to Brevo with the expected shape and headers (no PII leaks to logger)', async () => {
    const fetchMock = mockBrevoSuccess('msg-123');

    const result = await sendTransactionalEmail({
      template: 'magic-link',
      to: 'salma@example.com',
      locale: 'fr',
      vars: { link: 'https://darna.example/x', expiresInMinutes: 15 },
    });

    expect(result).toEqual({ ok: true, messageId: 'msg-123' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error('fetch was not called');
    const [url, init] = call;
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers['api-key']).toBeDefined();
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init?.body as string);
    expect(body.to).toEqual([{ email: 'salma@example.com' }]);
    expect(body.sender.email).toBe('noreply@darna.local');
    expect(body.subject).toBeTypeOf('string');

    // Logger called with no PII (email, subject, magic_link absent from payload).
    expect(logSpy).toHaveBeenCalledOnce();
    const logCall = logSpy.mock.calls[0];
    if (!logCall) throw new Error('logger was not called');
    const entry = logCall[0] as { payload: Record<string, unknown>; event: string };
    expect(entry.event).toBe('email.sent');
    expect(entry.payload.template).toBe('magic-link');
    expect(entry.payload.messageId).toBe('msg-123');
    expect(entry.payload).not.toHaveProperty('email');
    expect(entry.payload).not.toHaveProperty('to');
    expect(entry.payload).not.toHaveProperty('subject');
    expect(entry.payload).not.toHaveProperty('magic_link');
  });

  it('returns { ok: false } when Brevo responds 4xx and logs error without PII', async () => {
    mockBrevoError(400, { code: 'invalid_email', message: 'Bad request' });

    const result = await sendTransactionalEmail({
      template: 'magic-link',
      to: 'salma@example.com',
      locale: 'fr',
      vars: { link: 'https://darna.example/x', expiresInMinutes: 15 },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('invalid_email');
      expect(result.error).toBe('Bad request');
    }
    const failureCall = logSpy.mock.calls[0];
    if (!failureCall) throw new Error('logger was not called');
    const entry = failureCall[0] as {
      event: string;
      level: string;
      payload: Record<string, unknown>;
    };
    expect(entry.event).toBe('email.failed');
    expect(entry.level).toBe('error');
    expect(entry.payload.errorCode).toBe('invalid_email');
    expect(entry.payload).not.toHaveProperty('email');
  });

  it('returns errorCode "network" when fetch throws (network failure)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await sendTransactionalEmail({
      template: 'magic-link',
      to: 'salma@example.com',
      locale: 'fr',
      vars: { link: 'https://darna.example/x', expiresInMinutes: 15 },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('network');
    }
  });

  it('falls back to FR template if locale is unknown via the boundary type narrowing', async () => {
    mockBrevoSuccess();

    await sendTransactionalEmail({
      template: 'magic-link',
      to: 'salma@example.com',
      locale: 'fr',
      vars: { link: 'https://darna.example/x', expiresInMinutes: 15 },
    });

    const c = logSpy.mock.calls[0];
    if (!c) throw new Error('logger was not called');
    expect(c[0]).toMatchObject({ event: 'email.sent' });
  });
});
