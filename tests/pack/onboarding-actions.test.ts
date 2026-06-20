// @vitest-environment node
// Story 3.4 (AC3/AC4/AC6) — Server Actions onboarding : pose via client session
// self, idempotence (garde `is null`), non-blocage (échec DB → warn, jamais throw).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireResidentMock = vi.fn();
const updateSpy = vi.fn();
const eqSpy = vi.fn();
const isMock = vi.fn();
const logMock = vi.fn();

vi.mock('@/lib/auth/require-resident', () => ({
  requireResident: () => requireResidentMock(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      void table;
      return {
        update: (payload: unknown) => {
          updateSpy(payload);
          return {
            eq: (col: string, val: string) => {
              eqSpy(col, val);
              return {
                is: (isCol: string, isVal: unknown) => isMock(isCol, isVal),
              };
            },
          };
        },
      };
    },
  }),
}));

vi.mock('@/lib/logger', () => ({ log: (entry: unknown) => logMock(entry) }));

import {
  dismissPackBanner,
  completeOnboarding,
} from '@/app/[locale]/community/_actions/onboarding';

const USER = { id: 'user-uuid-1' };

beforeEach(() => {
  requireResidentMock.mockReset();
  updateSpy.mockReset();
  eqSpy.mockReset();
  isMock.mockReset();
  logMock.mockReset();
  requireResidentMock.mockResolvedValue({ ok: true, user: USER });
  isMock.mockResolvedValue({ error: null });
});
afterEach(() => vi.restoreAllMocks());

describe('dismissPackBanner', () => {
  it('pose pack_accueil_dismissed_at sur sa ligne, gardé par is null (idempotence)', async () => {
    await dismissPackBanner();
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0]![0]).toHaveProperty('pack_accueil_dismissed_at');
    expect(eqSpy).toHaveBeenCalledWith('id', USER.id);
    expect(isMock).toHaveBeenCalledWith('pack_accueil_dismissed_at', null);
  });

  it('ne fait rien si pas résident (non bloquant)', async () => {
    requireResidentMock.mockResolvedValue({ ok: false });
    await expect(dismissPackBanner()).resolves.toBeUndefined();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('échec DB → warn sans throw', async () => {
    isMock.mockResolvedValue({ error: { code: '42501' } });
    await expect(dismissPackBanner()).resolves.toBeUndefined();
    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock.mock.calls[0]![0]).toMatchObject({ level: 'warn' });
  });
});

describe('completeOnboarding', () => {
  it('pose first_login_at + dismissed_at, gardé par first_login_at is null', async () => {
    await completeOnboarding();
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const payload = updateSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).toHaveProperty('first_login_at');
    expect(payload).toHaveProperty('pack_accueil_dismissed_at');
    expect(eqSpy).toHaveBeenCalledWith('id', USER.id);
    expect(isMock).toHaveBeenCalledWith('first_login_at', null);
  });

  it('échec DB → warn sans throw', async () => {
    isMock.mockResolvedValue({ error: { code: 'XX' } });
    await expect(completeOnboarding()).resolves.toBeUndefined();
    expect(logMock.mock.calls[0]![0]).toMatchObject({ level: 'warn' });
  });
});
