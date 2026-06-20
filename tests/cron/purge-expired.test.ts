// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const queryMock = vi.fn();
const insertMock = vi.fn();
const deleteUserMock = vi.fn();
const tokenDeleteMock = vi.fn();
const alertsExpireMock = vi.fn();
const tipsExpireMock = vi.fn();
const logMock = vi.fn();

vi.mock('@/lib/env', () => ({
  env: { server: { CRON_SECRET: 'test-cron-secret' }, client: {} },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            not: () => ({ lt: () => queryMock() }),
          }),
        };
      }
      if (table === 'artisan_consent_tokens') {
        return {
          delete: () => ({
            is: () => ({ lt: () => tokenDeleteMock() }),
          }),
        };
      }
      // Story 4.5 — soft-delete expiration : update().is().lt().select().
      if (table === 'alerts' || table === 'tips') {
        const m = table === 'alerts' ? alertsExpireMock : tipsExpireMock;
        return {
          update: () => ({
            is: () => ({ lt: () => ({ select: () => m() }) }),
          }),
        };
      }
      return { insert: (payload: unknown) => insertMock(payload) };
    },
    auth: { admin: { deleteUser: (id: string) => deleteUserMock(id) } },
  }),
}));

vi.mock('@/lib/logger', () => ({ log: (e: unknown) => logMock(e) }));

import { GET } from '@/app/api/cron/purge-expired/route';

function req(authHeader?: string) {
  const headers = new Headers();
  if (authHeader) headers.set('authorization', authHeader);
  return new NextRequest('http://localhost/api/cron/purge-expired', { headers });
}

describe('GET /api/cron/purge-expired', () => {
  beforeEach(() => {
    queryMock.mockReset();
    insertMock.mockReset();
    deleteUserMock.mockReset();
    tokenDeleteMock.mockReset();
    tokenDeleteMock.mockResolvedValue({ count: 0, error: null });
    alertsExpireMock.mockReset();
    tipsExpireMock.mockReset();
    alertsExpireMock.mockResolvedValue({ data: [], error: null });
    tipsExpireMock.mockResolvedValue({ data: [], error: null });
    logMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
    deleteUserMock.mockResolvedValue({ error: null });
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns 401 without a Bearer token', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns 401 with the wrong secret', async () => {
    const res = await GET(req('Bearer nope'));
    expect(res.status).toBe(401);
  });

  it('returns 200 + purged 0 when nothing is expired', async () => {
    queryMock.mockResolvedValue({ data: [], error: null });
    const res = await GET(req('Bearer test-cron-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.purged).toBe(0);
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it('logs purge_completed + deletes each expired user', async () => {
    queryMock.mockResolvedValue({
      data: [
        { id: 'u1', residence_id: 'r1' },
        { id: 'u2', residence_id: 'r1' },
      ],
      error: null,
    });
    const res = await GET(req('Bearer test-cron-secret'));
    const body = await res.json();
    expect(body.data.purged).toBe(2);
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(deleteUserMock).toHaveBeenCalledTimes(2);
    // moderation_log insert uses action 'purge_completed'
    const firstInsert = insertMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstInsert.action).toBe('purge_completed');
  });

  it('continues the batch when one deleteUser fails', async () => {
    queryMock.mockResolvedValue({
      data: [
        { id: 'u1', residence_id: 'r1' },
        { id: 'u2', residence_id: 'r1' },
      ],
      error: null,
    });
    deleteUserMock.mockResolvedValueOnce({ error: { code: 'not_found' } });
    deleteUserMock.mockResolvedValueOnce({ error: null });
    const res = await GET(req('Bearer test-cron-secret'));
    const body = await res.json();
    expect(body.data.purged).toBe(1);
    expect(deleteUserMock).toHaveBeenCalledTimes(2);
  });

  // ── Story 4.5 — auto-expiration alertes & bons plans ──────────────────────────
  it('soft-deletes expired alerts + tips and reports counts', async () => {
    queryMock.mockResolvedValue({ data: [], error: null }); // pas de users à purger
    alertsExpireMock.mockResolvedValue({
      data: [
        { id: 'a1', residence_id: 'r1' },
        { id: 'a2', residence_id: 'r1' },
      ],
      error: null,
    });
    tipsExpireMock.mockResolvedValue({ data: [{ id: 't1', residence_id: 'r1' }], error: null });

    const res = await GET(req('Bearer test-cron-secret'));
    const body = await res.json();
    expect(body.data.alertsExpired).toBe(2);
    expect(body.data.tipsExpired).toBe(1);

    // moderation_log content_expired écrit par batch (acteur système : actor_id null).
    const inserted = insertMock.mock.calls.map((c) => c[0]) as unknown[][];
    const alertLog = inserted.find(
      (rows) =>
        Array.isArray(rows) &&
        rows[0] &&
        (rows[0] as Record<string, unknown>).target_kind === 'alert',
    );
    expect(alertLog).toBeDefined();
    expect((alertLog as Record<string, unknown>[])[0]).toMatchObject({
      action: 'content_expired',
      actor_id: null,
      reason_text_anonymized: 'auto_expiration',
    });

    const expiredEvents = logMock.mock.calls
      .map((c) => c[0] as { event?: string })
      .filter((e) => e.event === 'alerts.auto_expired' || e.event === 'tips.auto_expired');
    expect(expiredEvents).toHaveLength(2);
  });

  it('expiration: no moderation_log when nothing expired', async () => {
    queryMock.mockResolvedValue({ data: [], error: null });
    const res = await GET(req('Bearer test-cron-secret'));
    const body = await res.json();
    expect(body.data.alertsExpired).toBe(0);
    expect(body.data.tipsExpired).toBe(0);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
