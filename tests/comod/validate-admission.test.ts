// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireComodMock = vi.fn();
const rpcMock = vi.fn();
const getUserByIdMock = vi.fn();
const updateUserByIdMock = vi.fn();
const generateLinkMock = vi.fn();
const sendTransactionalEmailMock = vi.fn();
const logMock = vi.fn();

vi.mock('@/lib/auth/require-comod', () => ({
  requireComod: () => requireComodMock(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: (name: string, args: unknown) => rpcMock(name, args),
    auth: {
      admin: {
        getUserById: (id: string) => getUserByIdMock(id),
        updateUserById: (id: string, attrs: unknown) => updateUserByIdMock(id, attrs),
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

import { validateAdmission, rejectAdmission } from '@/app/[locale]/comod/admission/actions';

const ADMISSION_ID = '11111111-1111-4111-8111-111111111111';
const REQUESTER_ID = 'requester-uuid-1';
const ACTOR_ID = 'comod-uuid-1';

function comodOk() {
  requireComodMock.mockResolvedValue({ ok: true, user: { id: ACTOR_ID } });
}

function rpcOk() {
  rpcMock.mockResolvedValue({
    data: [{ requester_user_id: REQUESTER_ID, villa: 87, residence_id: 'res-1' }],
    error: null,
  });
}

describe('validateAdmission Server Action', () => {
  beforeEach(() => {
    requireComodMock.mockReset();
    rpcMock.mockReset();
    getUserByIdMock.mockReset();
    updateUserByIdMock.mockReset();
    generateLinkMock.mockReset();
    sendTransactionalEmailMock.mockReset();
    logMock.mockReset();

    getUserByIdMock.mockResolvedValue({
      data: { user: { email: 'salma@example.org', user_metadata: { first_name: 'Salma' } } },
      error: null,
    });
    updateUserByIdMock.mockResolvedValue({ data: {}, error: null });
    // Depuis buildPkceConfirmUrl (2026-06-21), le code construit l'URL PKCE
    // depuis `hashed_token` — plus depuis `action_link` (legacy verify Supabase).
    generateLinkMock.mockResolvedValue({
      data: { properties: { hashed_token: 'pkce-hashed-token-x' } },
      error: null,
    });
    sendTransactionalEmailMock.mockResolvedValue({ ok: true, messageId: 'm-1' });
  });

  afterEach(() => vi.restoreAllMocks());

  it('accept: calls accept_admission RPC, promotes app_metadata to resident, sends welcome email, logs accepted', async () => {
    comodOk();
    rpcOk();

    const res = await validateAdmission({ admission_request_id: ADMISSION_ID });
    expect(res.ok).toBe(true);

    // RPC called with the right function + actor id
    expect(rpcMock).toHaveBeenCalledOnce();
    expect(rpcMock.mock.calls[0]?.[0]).toBe('accept_admission');
    expect((rpcMock.mock.calls[0]?.[1] as { p_actor_id: string }).p_actor_id).toBe(ACTOR_ID);

    // JWT promotion
    expect(updateUserByIdMock).toHaveBeenCalledOnce();
    const attrs = updateUserByIdMock.mock.calls[0]?.[1] as { app_metadata: { role: string } };
    expect(attrs.app_metadata.role).toBe('resident');

    // Welcome email
    const sent = sendTransactionalEmailMock.mock.calls.map((c) => c[0] as { template: string });
    expect(sent.some((s) => s.template === 'admission-validated')).toBe(true);

    // Logged accepted
    const accepted = logMock.mock.calls
      .map((c) => c[0] as { event: string })
      .find((e) => e.event === 'admission.accepted');
    expect(accepted).toBeDefined();
  });

  it('forbidden: returns forbidden and never calls the RPC when caller is not co_mod', async () => {
    requireComodMock.mockResolvedValue({ ok: false });

    const res = await validateAdmission({ admission_request_id: ADMISSION_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('forbidden');
      expect(res.message_key).toBe('errors.comod.forbidden');
    }
    expect(rpcMock).not.toHaveBeenCalled();
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it('already_decided: maps the RPC race error and sends no email', async () => {
    comodOk();
    rpcMock.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'already_decided' } });

    const res = await validateAdmission({ admission_request_id: ADMISSION_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('already_decided');
      expect(res.message_key).toBe('errors.comod.already_decided');
    }
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it('not_found: maps the RPC error to invalid_id', async () => {
    comodOk();
    rpcMock.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'not_found' } });
    const res = await validateAdmission({ admission_request_id: ADMISSION_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('decision_failed');
      expect(res.message_key).toBe('errors.comod.invalid_id');
    }
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it('wrong_residence: maps the RPC error to forbidden + dedicated key', async () => {
    comodOk();
    rpcMock.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'wrong_residence' } });
    const res = await validateAdmission({ admission_request_id: ADMISSION_ID });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('forbidden');
      expect(res.message_key).toBe('errors.comod.wrong_residence');
    }
  });

  it('invalid id: returns invalid_input without hitting the RPC', async () => {
    comodOk();
    const res = await validateAdmission({ admission_request_id: 'not-a-uuid' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('invalid_input');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('Brevo welcome failure keeps the decision ok and logs decision_notify_failed', async () => {
    comodOk();
    rpcOk();
    sendTransactionalEmailMock.mockResolvedValue({
      ok: false,
      error: 'Brevo 5xx',
      errorCode: 'server_error',
    });

    const res = await validateAdmission({ admission_request_id: ADMISSION_ID });
    expect(res.ok).toBe(true);

    const failed = logMock.mock.calls
      .map((c) => c[0] as { event: string })
      .find((e) => e.event === 'admission.decision_notify_failed');
    expect(failed).toBeDefined();
  });

  it('never logs PII (email / first_name) in any payload', async () => {
    comodOk();
    rpcOk();

    await validateAdmission({ admission_request_id: ADMISSION_ID });

    for (const call of logMock.mock.calls) {
      const entry = call[0] as { payload?: Record<string, unknown> };
      if (entry.payload) {
        expect(entry.payload).not.toHaveProperty('email');
        expect(entry.payload).not.toHaveProperty('first_name');
      }
    }
  });
});

describe('rejectAdmission Server Action', () => {
  beforeEach(() => {
    requireComodMock.mockReset();
    rpcMock.mockReset();
    getUserByIdMock.mockReset();
    updateUserByIdMock.mockReset();
    generateLinkMock.mockReset();
    sendTransactionalEmailMock.mockReset();
    logMock.mockReset();

    getUserByIdMock.mockResolvedValue({
      data: { user: { email: 'mehdi@example.org' } },
      error: null,
    });
    sendTransactionalEmailMock.mockResolvedValue({ ok: true, messageId: 'm-2' });
  });

  afterEach(() => vi.restoreAllMocks());

  it('reject: calls reject_admission with the motive, sends the rejection email, no role promotion', async () => {
    comodOk();
    rpcMock.mockResolvedValue({
      data: [{ requester_user_id: REQUESTER_ID, villa: 203, residence_id: 'res-1' }],
      error: null,
    });

    const res = await rejectAdmission({
      admission_request_id: ADMISSION_ID,
      motive: 'villa_out_of_range',
    });
    expect(res.ok).toBe(true);

    expect(rpcMock.mock.calls[0]?.[0]).toBe('reject_admission');
    expect((rpcMock.mock.calls[0]?.[1] as { p_reason: string }).p_reason).toBe(
      'villa_out_of_range',
    );

    const sent = sendTransactionalEmailMock.mock.calls.map((c) => c[0] as { template: string });
    expect(sent.some((s) => s.template === 'admission-rejected')).toBe(true);

    // No magic-link / no role promotion on reject
    expect(updateUserByIdMock).not.toHaveBeenCalled();
    expect(generateLinkMock).not.toHaveBeenCalled();
  });

  it('rejects an out-of-enum motive before the RPC', async () => {
    comodOk();
    const res = await rejectAdmission({ admission_request_id: ADMISSION_ID, motive: 'spam' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('invalid_input');
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
