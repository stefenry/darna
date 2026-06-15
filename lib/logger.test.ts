import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}));

import * as Sentry from '@sentry/nextjs';
import { log } from './logger';

describe('lib/logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('produces valid JSON with all required fields for info level', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    log({
      level: 'info',
      event: 'admission.validated',
      user_id: 'u-123',
      residence_id: 'r-1',
      request_id: 'req-abc',
    });

    expect(consoleSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(consoleSpy.mock.calls[0]![0] as string);

    expect(output).toMatchObject({
      level: 'info',
      event: 'admission.validated',
      user_id: 'u-123',
      residence_id: 'r-1',
      request_id: 'req-abc',
    });
    expect(output.ts).toBeDefined();
    expect(new Date(output.ts).toISOString()).toBe(output.ts);
  });

  it('invokes Sentry.captureMessage for error level', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    log({
      level: 'error',
      event: 'db.connection_failed',
      user_id: null,
      residence_id: null,
      request_id: 'req-xyz',
      payload: { reason: 'timeout' },
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith('db.connection_failed', {
      level: 'error',
      extra: { reason: 'timeout', request_id: 'req-xyz' },
    });
  });

  it('does not include PII fields (email, phone) in output', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    log({
      level: 'info',
      event: 'user.login',
      user_id: 'u-456',
      residence_id: null,
      request_id: null,
      payload: { method: 'magic-link' },
    });

    const output = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
    expect(output).not.toHaveProperty('email');
    expect(output).not.toHaveProperty('phone');
    expect(output.payload).not.toHaveProperty('email');
    expect(output.payload).not.toHaveProperty('phone');
  });

  it('strips PII keys injected by caller in payload', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    log({
      level: 'error',
      event: 'db.write_failed',
      user_id: 'u-789',
      residence_id: null,
      request_id: 'req-1',
      payload: {
        method: 'insert',
        email: 'leak@example.com',
        phone: '+212612345678',
        access_token: 'super_secret',
        other: 'ok',
      },
    });

    const output = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
    expect(output.payload).toEqual({ method: 'insert', other: 'ok' });
    expect(Sentry.captureMessage).toHaveBeenCalledWith('db.write_failed', {
      level: 'error',
      extra: { method: 'insert', other: 'ok', request_id: 'req-1' },
    });
  });
});
