// @vitest-environment node
// (le boundary SMS lit env.server, inaccessible en jsdom où `window` existe)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { consentSmsTemplate } from './templates/consent.fr';
import { sendTransactionalSms } from './send';

describe('consentSmsTemplate', () => {
  it('contient le nom et le lien', () => {
    const body = consentSmsTemplate({
      artisanName: 'Hassan',
      link: 'https://darna.app/consent/xyz',
    });
    expect(body).toContain('Hassan');
    expect(body).toContain('https://darna.app/consent/xyz');
    expect(body).toContain('Darna');
  });
});

describe('sendTransactionalSms (provider=disabled)', () => {
  it('n’envoie rien, ne loggue pas le body (token) et retourne errorCode=disabled', async () => {
    const { env } = await import('@/lib/env');
    const previous = env.server.SMS_PROVIDER;
    env.server.SMS_PROVIDER = 'disabled';
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const res = await sendTransactionalSms({
        template: 'artisan-consent',
        to: '+212600000001',
        vars: { artisanName: 'Hassan', link: 'https://darna.app/consent/raw-token' },
      });
      expect(res).toEqual({
        ok: false,
        errorCode: 'disabled',
        error: 'SMS sending disabled (SMS_PROVIDER)',
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
    } finally {
      env.server.SMS_PROVIDER = previous;
      vi.restoreAllMocks();
    }
  });
});

describe('sendTransactionalSms (provider=log par défaut en test)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('réussit via l’adapter log et journalise le SMS', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await sendTransactionalSms({
      template: 'artisan-consent',
      to: '+212600000001',
      vars: { artisanName: 'Hassan', link: 'https://darna.app/consent/xyz' },
    });
    expect(res.ok).toBe(true);
    expect(spy).toHaveBeenCalledOnce();
    expect(String(spy.mock.calls[0]?.[0])).toContain('+212600000001');
  });
});
