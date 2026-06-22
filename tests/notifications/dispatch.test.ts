// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory fixtures driving the admin-client mock.
const prefsByUser = new Map<string, Record<string, boolean> | null>();
const profileByUser = new Map<string, { language: string } | null>();
const emailByUser = new Map<string, string | null>();
let fanoutRows: { user_id: string }[] = [];

const sendMock = vi.fn();
const logMock = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from(table: string) {
      if (table === 'notifications_prefs') {
        return {
          select() {
            return {
              eq(col: string, val: string) {
                if (col === 'user_id') {
                  return {
                    maybeSingle: async () => ({ data: prefsByUser.get(val) ?? null, error: null }),
                  };
                }
                // Fan-out chain: .eq('residence_id', x).eq(column, true) → thenable
                return {
                  eq: () => Promise.resolve({ data: fanoutRows, error: null }),
                };
              },
            };
          },
        };
      }
      if (table === 'profiles') {
        return {
          select() {
            return {
              eq(_col: string, val: string) {
                return {
                  maybeSingle: async () => ({ data: profileByUser.get(val) ?? null, error: null }),
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: { user: { email: emailByUser.get(id) ?? null } },
        }),
      },
    },
  }),
}));

vi.mock('@/lib/email/send', () => ({
  sendTransactionalEmail: (args: unknown) => sendMock(args),
}));

vi.mock('@/lib/logger', () => ({
  log: (entry: unknown) => logMock(entry),
}));

import { notifyResident, notifyResidentsByCategory } from '@/lib/notifications/dispatch';

const contentRemovedBuild = ({ to, locale }: { to: string; locale: 'fr' | 'ar' }) => ({
  template: 'content-removed-author' as const,
  to,
  locale,
  vars: { content_label: 'commentaire', motive_label: 'hors-sujet' },
});

describe('notifyResident (Story 7.2)', () => {
  beforeEach(() => {
    prefsByUser.clear();
    profileByUser.clear();
    emailByUser.clear();
    fanoutRows = [];
    sendMock.mockReset();
    logMock.mockReset();
    sendMock.mockResolvedValue({ ok: true, messageId: 'm-1' });
  });
  afterEach(() => vi.restoreAllMocks());

  it('skips and logs when the recipient opted out of the category', async () => {
    prefsByUser.set('u1', { activite_contributions_enabled: false });
    emailByUser.set('u1', 'u1@example.com');
    const res = await notifyResident({
      userId: 'u1',
      category: 'activite_contributions',
      build: contentRemovedBuild,
    });
    expect(res).toEqual({ status: 'skipped_opt_out' });
    expect(sendMock).not.toHaveBeenCalled();
    const skip = logMock.mock.calls.find(
      (c) => (c[0] as { event: string }).event === 'notification.skipped_opt_out',
    );
    expect(skip).toBeDefined();
    // No PII in the skip log.
    const entry = skip?.[0] as { payload: Record<string, unknown> };
    expect(entry.payload).not.toHaveProperty('email');
    expect(entry.payload.category).toBe('activite_contributions');
  });

  it('sends in the recipient profile locale when opted in', async () => {
    prefsByUser.set('u2', { activite_contributions_enabled: true });
    emailByUser.set('u2', 'u2@example.com');
    profileByUser.set('u2', { language: 'ar' });
    const res = await notifyResident({
      userId: 'u2',
      category: 'activite_contributions',
      build: contentRemovedBuild,
    });
    expect(res).toEqual({ status: 'sent', messageId: 'm-1' });
    const args = sendMock.mock.calls[0]?.[0] as { to: string; locale: string; template: string };
    expect(args.to).toBe('u2@example.com');
    expect(args.locale).toBe('ar');
    expect(args.template).toBe('content-removed-author');
  });

  it('falls back to FR locale when the profile has no AR preference', async () => {
    prefsByUser.set('u3', { activite_contributions_enabled: true });
    emailByUser.set('u3', 'u3@example.com');
    // no profile row → default fr
    await notifyResident({
      userId: 'u3',
      category: 'activite_contributions',
      build: contentRemovedBuild,
    });
    const args = sendMock.mock.calls[0]?.[0] as { locale: string };
    expect(args.locale).toBe('fr');
  });

  it('skips when there is no recipient email', async () => {
    prefsByUser.set('u4', { activite_contributions_enabled: true });
    emailByUser.set('u4', null);
    const res = await notifyResident({
      userId: 'u4',
      category: 'activite_contributions',
      build: contentRemovedBuild,
    });
    expect(res).toEqual({ status: 'skipped_no_recipient' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns skipped_no_recipient for a null userId without any DB call', async () => {
    const res = await notifyResident({
      userId: null,
      category: 'activite_contributions',
      build: contentRemovedBuild,
    });
    expect(res).toEqual({ status: 'skipped_no_recipient' });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('reports failure when the email send fails (no retry at MVP)', async () => {
    prefsByUser.set('u5', { activite_contributions_enabled: true });
    emailByUser.set('u5', 'u5@example.com');
    sendMock.mockResolvedValue({ ok: false, error: 'boom', errorCode: 'unauthorized' });
    const res = await notifyResident({
      userId: 'u5',
      category: 'activite_contributions',
      build: contentRemovedBuild,
    });
    expect(res).toEqual({ status: 'failed', errorCode: 'unauthorized' });
  });

  it('applies FR40 defaults when the prefs row is missing (annuaire OFF by default)', async () => {
    emailByUser.set('u6', 'u6@example.com');
    // No prefs row → nouvelles_entrees default false → skip
    const res = await notifyResident({
      userId: 'u6',
      category: 'nouvelles_entrees_annuaire',
      build: ({ to, locale }) => ({
        template: 'content-removed-author',
        to,
        locale,
        vars: { content_label: 'x', motive_label: 'y' },
      }),
    });
    expect(res).toEqual({ status: 'skipped_opt_out' });
  });
});

describe('notifyResidentsByCategory (fan-out)', () => {
  beforeEach(() => {
    prefsByUser.clear();
    profileByUser.clear();
    emailByUser.clear();
    sendMock.mockReset();
    logMock.mockReset();
    sendMock.mockResolvedValue({ ok: true, messageId: 'm-1' });
  });
  afterEach(() => vi.restoreAllMocks());

  it('dispatches to each opted-in resident, excluding the author', async () => {
    fanoutRows = [{ user_id: 'a' }, { user_id: 'b' }, { user_id: 'author' }];
    for (const id of ['a', 'b', 'author']) {
      prefsByUser.set(id, { alerts_urgentes_enabled: true });
      emailByUser.set(id, `${id}@example.com`);
    }
    const counts = await notifyResidentsByCategory({
      residenceId: 'res-1',
      category: 'alerts_urgentes',
      excludeUserId: 'author',
      build: ({ to, locale }) => ({
        template: 'content-removed-author',
        to,
        locale,
        vars: { content_label: 'alerte', motive_label: '' },
      }),
    });
    expect(counts.sent).toBe(2);
    expect(counts.failed).toBe(0);
    expect(sendMock).toHaveBeenCalledTimes(2);
    const recipients = sendMock.mock.calls.map((c) => (c[0] as { to: string }).to);
    expect(recipients).not.toContain('author@example.com');
  });
});
