// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mode contrôlé par les tests : le fake Ratelimit lève / renvoie selon `mode`,
// sans promesse intermédiaire (évite les faux positifs unhandled-rejection).
let mode:
  | { kind: 'ok'; reset: number }
  | { kind: 'blocked'; reset: number }
  | { kind: 'error'; error?: unknown } = {
  kind: 'ok',
  reset: 0,
};

// Options passées au client Redis — vérifiées plus bas (config de reprise).
const redisOpts: Record<string, unknown>[] = [];

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(opts: Record<string, unknown>) {
      redisOpts.push(opts);
    }
  },
}));

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    class {
      constructor(_opts: unknown) {
        void _opts;
      }
      async limit(_key: string) {
        void _key;
        if (mode.kind === 'error') throw mode.error ?? new Error('ECONNREFUSED');
        return { success: mode.kind === 'ok', reset: mode.reset };
      }
    },
    { slidingWindow: () => ({}) },
  ),
}));

const logMock = vi.fn();
vi.mock('@/lib/logger', () => ({ log: (e: unknown) => logMock(e) }));

import { checkLimit, tooManyRequests } from '@/lib/rate-limit';

describe('checkLimit', () => {
  beforeEach(() => {
    mode = { kind: 'ok', reset: 0 };
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns success when under the limit', async () => {
    mode = { kind: 'ok', reset: 1000 };
    expect(await checkLimit('k', 5, 86400)).toEqual({ success: true, reset: 1000 });
  });

  it('returns failure when over the limit', async () => {
    mode = { kind: 'blocked', reset: 2000 };
    expect(await checkLimit('k', 5, 86400)).toEqual({ success: false, reset: 2000 });
  });

  it('fails open when Upstash rejects (never blocks the user)', async () => {
    mode = { kind: 'error' };
    expect(await checkLimit('k', 5, 86400)).toEqual({ success: true, reset: 0 });
  });
});

describe('tooManyRequests', () => {
  it('builds a 429 with a Retry-After header', async () => {
    const res = tooManyRequests(Date.now() + 5000);
    expect(res.status).toBe(429);
    const retryAfter = Number(res.headers.get('Retry-After'));
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    const body = await res.json();
    expect(body.error.code).toBe('rate_limited');
    expect(body.error.message_key).toBe('errors.rate_limit.exceeded');
  });
});

// 2026-07-26 — les logs de prod ne montraient QUE `upstash_timeout` : le client
// réessayait 5 fois (backoff exponentiel ≈ 4,3 s cumulées), donc notre course de
// 2 s gagnait toujours et la vraie erreur n'atteignait jamais les logs. Ce test
// verrouille la configuration de reprise : sans elle, l'aveuglement revient sans
// que personne ne s'en aperçoive.
describe('client Redis — configuration de reprise', () => {
  it('limite les reprises pour que la vraie erreur tienne dans le budget de 2 s', async () => {
    await checkLimit('k', 5, 86400);
    const opts = redisOpts.at(-1);
    expect(opts).toBeDefined();
    const retry = opts?.retry as { retries: number; backoff: () => number } | undefined;
    expect(retry?.retries).toBe(1);
    // Backoff court : 1 reprise × ce délai doit rester loin des 2 s.
    expect(retry?.backoff()).toBeLessThanOrEqual(500);
  });
});

// 2026-07-27 — en production, `rate_limit.degraded` ne disait que
// « TypeError: fetch failed » : l'enveloppe générique d'undici. La cause réelle
// (ENOTFOUND, ECONNREFUSED, et surtout le nom d'hôte) vit dans `error.cause`,
// que le log ne capturait pas. Sans elle, impossible de distinguer une URL
// erronée d'une base éteinte.
describe('rate_limit.degraded — cause réelle', () => {
  beforeEach(() => logMock.mockReset());

  it('capture la cause d’un « fetch failed » (nom, message, code)', async () => {
    const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8079'), {
      code: 'ECONNREFUSED',
    });
    mode = { kind: 'error', error: Object.assign(new TypeError('fetch failed'), { cause }) };

    await checkLimit('k', 5, 86400);

    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'rate_limit.degraded',
        payload: expect.objectContaining({
          errorName: 'TypeError',
          errorMessage: 'fetch failed',
          causeName: 'Error',
          causeMessage: 'connect ECONNREFUSED 127.0.0.1:8079',
          causeCode: 'ECONNREFUSED',
        }),
      }),
    );
  });

  it('sans cause, les champs restent absents plutôt que « undefined »', async () => {
    mode = { kind: 'error', error: new Error('boom') };
    await checkLimit('k', 5, 86400);
    const payload = (logMock.mock.calls[0]?.[0] as { payload: Record<string, unknown> }).payload;
    expect(payload.errorMessage).toBe('boom');
    expect('causeName' in payload).toBe(false);
  });
});
