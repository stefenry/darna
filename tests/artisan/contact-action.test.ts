// @vitest-environment node
// Story 2.8 — requestArtisanContactLink : AR38 indistinguabilité. La réponse est
// TOUJOURS générique ({ok:true}) — phone trouvé/inexistant, rate-limité, format KO.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const checkLimitMock = vi.fn();
const rpcMock = vi.fn();
const smsMock = vi.fn();
const logMock = vi.fn();

vi.mock('next/headers', () => ({ headers: async () => ({ get: () => '1.2.3.4' }) }));
vi.mock('@/lib/rate-limit', () => ({ checkLimit: () => checkLimitMock() }));
vi.mock('@/lib/consent/token', () => ({
  generateConsentToken: () => ({ raw: 'rawtoken', hash: 'hash123' }),
}));
vi.mock('@/lib/sms/send', () => ({
  sendTransactionalSms: () => smsMock(),
  isSmsDisabled: () => false,
}));
vi.mock('@/lib/env', () => ({
  env: {
    client: { NEXT_PUBLIC_SITE_URL: 'https://darna.test' },
    server: { CONSENT_TOKEN_SECRET: 'secret' },
  },
}));
vi.mock('@/lib/logger', () => ({ log: (e: unknown) => logMock(e) }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: (n: string, a: unknown) => rpcMock(n, a) }),
}));

import { requestArtisanContactLink } from '@/app/artisan/contact/actions';
import { CONTACT_LINK_INITIAL } from '@/app/artisan/contact/state';

function fd(phone: string): FormData {
  const f = new FormData();
  f.set('phone', phone);
  return f;
}

beforeEach(() => {
  checkLimitMock.mockReset().mockResolvedValue({ success: true, reset: 0 });
  rpcMock.mockReset().mockResolvedValue({
    data: [{ status: 'sent', sms_target_phone: '+212600000001', sms_artisan_name: 'Hassan' }],
    error: null,
  });
  smsMock.mockReset().mockResolvedValue({ ok: true });
  logMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('requestArtisanContactLink (AR38)', () => {
  it('phone valide trouvé → générique + SMS envoyé', async () => {
    const res = await requestArtisanContactLink(CONTACT_LINK_INITIAL, fd('+212600000001'));
    expect(res.ok).toBe(true);
    expect(smsMock).toHaveBeenCalledOnce();
  });

  it('phone inexistant → MÊME réponse générique, pas de SMS', async () => {
    rpcMock.mockResolvedValue({
      data: [{ status: 'not_found', sms_target_phone: null, sms_artisan_name: null }],
      error: null,
    });
    const res = await requestArtisanContactLink(CONTACT_LINK_INITIAL, fd('+212600000002'));
    expect(res.ok).toBe(true);
    expect(smsMock).not.toHaveBeenCalled();
  });

  it('rate-limit IP atteint → générique, pas de RPC', async () => {
    checkLimitMock.mockResolvedValueOnce({ success: false, reset: 0 });
    const res = await requestArtisanContactLink(CONTACT_LINK_INITIAL, fd('+212600000001'));
    expect(res.ok).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rate-limit phone atteint → générique, pas de RPC', async () => {
    checkLimitMock
      .mockResolvedValueOnce({ success: true, reset: 0 }) // IP ok
      .mockResolvedValueOnce({ success: false, reset: 0 }); // phone KO
    const res = await requestArtisanContactLink(CONTACT_LINK_INITIAL, fd('+212600000001'));
    expect(res.ok).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('format invalide → générique silencieux (pas de RPC)', async () => {
    const res = await requestArtisanContactLink(CONTACT_LINK_INITIAL, fd('06 12'));
    expect(res.ok).toBe(true);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
