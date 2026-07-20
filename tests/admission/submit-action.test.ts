// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const generateLinkMock = vi.fn();
const sendTransactionalEmailMock = vi.fn();
const logMock = vi.fn();
const checkLimitMock = vi.fn();

// Chainable Supabase mock for admin.from('admission_requests').select().eq().eq().is().limit()
// and admin.from('admission_requests').insert(...)
const duplicateCheckMock = vi.fn();
const insertMock = vi.fn();

function makeAdminFromChain() {
  const limit = vi.fn(async () => duplicateCheckMock());
  const isFn = vi.fn(() => ({ limit }));
  const eq2 = vi.fn(() => ({ is: isFn }));
  const eq1 = vi.fn(() => ({ eq: eq2 }));
  const select = vi.fn(() => ({ eq: eq1 }));
  const insert = vi.fn(async (...args: unknown[]) => insertMock(...args));
  return { select, insert };
}

let adminFromChain = makeAdminFromChain();

vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({
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
    from: (table: string) => {
      void table;
      return adminFromChain;
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

import { submitAdmissionRequest } from '@/app/actions/admission-submit';

const initial = { ok: false as const };

function makeFormData(overrides: Partial<Record<string, string | null>> = {}) {
  const defaults: Record<string, string> = {
    villa: '87',
    tranche: 'C',
    first_name: 'Salma',
    email: 'salma@example.org',
    cgu_accepted: 'on',
  };
  const merged = { ...defaults, ...overrides };
  const fd = new FormData();
  for (const [k, v] of Object.entries(merged)) {
    if (v !== null) fd.set(k, v as string);
  }
  return fd;
}

describe('submitAdmissionRequest Server Action', () => {
  beforeEach(() => {
    generateLinkMock.mockReset();
    sendTransactionalEmailMock.mockReset();
    logMock.mockReset();
    duplicateCheckMock.mockReset();
    insertMock.mockReset();
    checkLimitMock.mockReset();
    checkLimitMock.mockResolvedValue({ success: true, reset: 0 });
    adminFromChain = makeAdminFromChain();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns fieldErrors when villa is out of range (151)', async () => {
    const result = await submitAdmissionRequest(initial, makeFormData({ villa: '151' }));
    expect(result.ok).toBe(false);
    if ('fieldErrors' in result) {
      expect(result.fieldErrors?.villa).toEqual(['errors.admission.villa_out_of_range']);
    }
    expect(generateLinkMock).not.toHaveBeenCalled();
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it('returns fieldErrors when CGU is not accepted (L4 mitigation)', async () => {
    const result = await submitAdmissionRequest(initial, makeFormData({ cgu_accepted: null }));
    expect(result.ok).toBe(false);
    if ('fieldErrors' in result) {
      expect(result.fieldErrors?.cgu_accepted).toEqual(['errors.admission.cgu_required']);
    }
    expect(generateLinkMock).not.toHaveBeenCalled();
  });

  it('returns errorCode "duplicate_pending" when an active pending row already exists', async () => {
    generateLinkMock.mockResolvedValue({
      data: {
        user: { id: 'user-uuid-1' },
        properties: { hashed_token: 'pkce-hashed-token-x' },
      },
      error: null,
    });
    duplicateCheckMock.mockReturnValue({
      data: [{ id: 'existing-row-1' }],
      error: null,
    });

    const result = await submitAdmissionRequest(initial, makeFormData());
    expect(result.ok).toBe(false);
    if ('errorCode' in result) {
      expect(result.errorCode).toBe('duplicate_pending');
    }
    // Pas de magic-link, pas de notify, pas d'INSERT
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('happy path: creates auth user, inserts admission_request with strict columns, sends magic-link + notifies co-mods, logs without PII', async () => {
    generateLinkMock.mockResolvedValue({
      data: {
        user: { id: 'user-uuid-1' },
        properties: { hashed_token: 'pkce-hashed-token-x' },
      },
      error: null,
    });
    duplicateCheckMock.mockReturnValue({ data: [], error: null });
    insertMock.mockResolvedValue({ data: null, error: null });
    sendTransactionalEmailMock.mockResolvedValue({ ok: true, messageId: 'msg-1' });

    const result = await submitAdmissionRequest(initial, makeFormData());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.locale).toBe('fr');
    }

    // INSERT appelé avec strictement les colonnes autorisées par column-grant
    expect(insertMock).toHaveBeenCalledOnce();
    const insertArg = insertMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(insertArg).sort()).toEqual(
      [
        'user_id',
        'residence_id',
        'villa',
        'tranche',
        'first_name',
        'contact_channel',
        'landing_path',
      ].sort(),
    );
    expect(insertArg.user_id).toBe('user-uuid-1');
    expect(insertArg.residence_id).toBe('00000000-0000-0000-0000-000000000001');
    expect(insertArg.villa).toBe(87);
    expect(insertArg.tranche).toBe('C');
    expect(insertArg.first_name).toBe('Salma');
    expect(insertArg.contact_channel).toBe('email');
    // Story 6.3 — pas de `?next=` dans ce test → landing_path null (pas d'entité).
    expect(insertArg.landing_path).toBeNull();

    // Au moins 1 magic-link + 1+ notify co-mod
    const sendCalls = sendTransactionalEmailMock.mock.calls.map(
      (c) => c[0] as { template: string },
    );
    expect(sendCalls.some((c) => c.template === 'magic-link')).toBe(true);
    expect(sendCalls.some((c) => c.template === 'admission-notify-comod')).toBe(true);

    // Log "admission.requested" sans PII (email, first_name)
    const requestedEntry = logMock.mock.calls
      .map((c) => c[0] as { event: string; payload?: Record<string, unknown> })
      .find((e) => e.event === 'admission.requested');
    expect(requestedEntry).toBeDefined();
    if (requestedEntry) {
      expect(requestedEntry.payload).not.toHaveProperty('email');
      expect(requestedEntry.payload).not.toHaveProperty('first_name');
      expect(requestedEntry.payload?.villa).toBe(87);
      expect(requestedEntry.payload?.tranche).toBe('C');
      expect(requestedEntry.payload?.has_email_verified_at).toBe(false);
    }
  });

  it('co-mod notify failures never block the requester flow (logs admission.comod_notify_failed)', async () => {
    generateLinkMock.mockResolvedValue({
      data: {
        user: { id: 'user-uuid-1' },
        properties: { hashed_token: 'pkce-hashed-token-x' },
      },
      error: null,
    });
    duplicateCheckMock.mockReturnValue({ data: [], error: null });
    insertMock.mockResolvedValue({ data: null, error: null });

    // First send (magic-link to requester) succeeds, subsequent (co-mods) fail.
    let n = 0;
    sendTransactionalEmailMock.mockImplementation(async () => {
      n++;
      if (n === 1) return { ok: true, messageId: 'msg-1' };
      return { ok: false, error: 'Brevo 5xx', errorCode: 'server_error' };
    });

    const result = await submitAdmissionRequest(initial, makeFormData());
    expect(result.ok).toBe(true);

    const failureEntries = logMock.mock.calls
      .map((c) => c[0] as { event: string })
      .filter((e) => e.event === 'admission.comod_notify_failed');
    expect(failureEntries.length).toBeGreaterThan(0);
  });

  it('returns ok (anti-énumération) when generateLink fails — no magic-link sent', async () => {
    generateLinkMock.mockResolvedValue({
      data: null,
      error: { code: 'unexpected_failure', message: 'broken' },
    });

    const result = await submitAdmissionRequest(initial, makeFormData());
    expect(result.ok).toBe(true);
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();

    const entry = logMock.mock.calls
      .map((c) => c[0] as { event: string })
      .find((e) => e.event === 'admission.generate_link_failed');
    expect(entry).toBeDefined();
  });

  it('returns errorCode "rate_limited" when the IP limit is exceeded — no generateLink/insert (story 1.10b)', async () => {
    checkLimitMock.mockResolvedValue({ success: false, reset: Date.now() + 1000 });

    const result = await submitAdmissionRequest(initial, makeFormData());
    expect(result.ok).toBe(false);
    if ('errorCode' in result) {
      expect(result.errorCode).toBe('rate_limited');
    }
    expect(generateLinkMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it('treats a 23505 unique-index conflict as duplicate_pending (story 1.10a race guard)', async () => {
    generateLinkMock.mockResolvedValue({
      data: {
        user: { id: 'user-uuid-1' },
        properties: { hashed_token: 'pkce-hashed-token-x' },
      },
      error: null,
    });
    duplicateCheckMock.mockReturnValue({ data: [], error: null });
    // A concurrent request slipped past the step-4b check; the partial unique
    // index rejects the INSERT with Postgres 23505.
    insertMock.mockResolvedValue({ data: null, error: { code: '23505' } });

    const result = await submitAdmissionRequest(initial, makeFormData());
    expect(result.ok).toBe(false);
    if ('errorCode' in result) {
      expect(result.errorCode).toBe('duplicate_pending');
    }
    // No magic-link sent on the conflict path.
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });
});
