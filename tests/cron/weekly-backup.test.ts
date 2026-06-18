// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const invokeMock = vi.fn();
const logMock = vi.fn();
const brevoMock = vi.fn();

vi.mock('@/lib/env', () => ({
  env: {
    server: { CRON_SECRET: 'test-cron-secret', LEGAL_CONTACT_EMAIL: 'ops@test.local' },
    client: {},
  },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    functions: { invoke: (name: string, opts: unknown) => invokeMock(name, opts) },
  }),
}));

vi.mock('@/lib/logger', () => ({ log: (e: unknown) => logMock(e) }));
vi.mock('@/lib/email/client', () => ({
  brevoSendEmail: (opts: unknown) => brevoMock(opts),
}));

import { GET } from '@/app/api/cron/weekly-backup/route';

function req(authHeader?: string) {
  const headers = new Headers();
  if (authHeader) headers.set('authorization', authHeader);
  return new NextRequest('http://localhost/api/cron/weekly-backup', { headers });
}

describe('GET /api/cron/weekly-backup', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    logMock.mockReset();
    brevoMock.mockReset();
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
    brevoMock.mockResolvedValue({ ok: true, messageId: 'test-id' });
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns 401 without a Bearer token', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('returns 401 with the wrong secret', async () => {
    expect((await GET(req('Bearer nope'))).status).toBe(401);
  });

  it('invokes the weekly-backup edge function and logs backup_completed', async () => {
    const res = await GET(req('Bearer test-cron-secret'));
    expect(res.status).toBe(200);
    expect(invokeMock).toHaveBeenCalledWith('weekly-backup', { body: {} });
    const completed = logMock.mock.calls
      .map((c) => c[0] as { event: string })
      .find((e) => e.event === 'cron.backup_completed');
    expect(completed).toBeDefined();
  });

  it('logs backup_skipped (not backup_completed) when R2 is not configured', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, skipped: 'r2_not_configured' }, error: null });
    const res = await GET(req('Bearer test-cron-secret'));
    expect(res.status).toBe(200);
    const events = logMock.mock.calls.map((c) => (c[0] as { event: string }).event);
    expect(events).toContain('cron.backup_skipped');
    expect(events).not.toContain('cron.backup_completed');
  });

  it('returns 500 + logs + sends Brevo alert when the edge function errors', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError' } });
    const res = await GET(req('Bearer test-cron-secret'));
    expect(res.status).toBe(500);
    const failed = logMock.mock.calls
      .map((c) => c[0] as { event: string })
      .find((e) => e.event === 'cron.backup_failed');
    expect(failed).toBeDefined();
  });
});
