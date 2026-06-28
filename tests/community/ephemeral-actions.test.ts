// @vitest-environment node
// Story 4.2/4.3 — Server Actions contenu éphémère : createAlert (modèle + durée),
// createTip (catégorie + expiration bornée), retractOwnEphemeral (RPC + mapping).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireResidentMock = vi.fn();
const insertSpy = vi.fn();
const rpcSpy = vi.fn();
let insertError: { code?: string } | null = null;
let rpcError: { message?: string; code?: string } | null = null;
let rlSuccess = true;
let selectData: Record<string, unknown> = {
  users: { residence_id: 'res-1', role: 'resident' },
  alert_templates: { id: 'tpl-1' },
};

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/require-resident', () => ({ requireResident: () => requireResidentMock() }));
vi.mock('@/lib/logger', () => ({ log: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  checkLimit: () => Promise.resolve({ success: rlSuccess, reset: 0 }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: selectData[table] ?? null, error: null }),
        }),
      }),
      insert: (payload: unknown) => {
        insertSpy(table, payload);
        return Promise.resolve({ error: insertError });
      },
    }),
    rpc: (name: string, args: unknown) => {
      rpcSpy(name, args);
      return Promise.resolve({ error: rpcError });
    },
  }),
}));

import { createAlert } from '@/app/[locale]/community/alertes/nouveau/actions';
import { CREATE_ALERT_INITIAL } from '@/app/[locale]/community/alertes/nouveau/state';
import { createTip } from '@/app/[locale]/community/bons-plans/nouveau/actions';
import { CREATE_TIP_INITIAL } from '@/app/[locale]/community/bons-plans/nouveau/state';
import { retractOwnEphemeral } from '@/app/[locale]/community/_actions/ephemeral-retract';

const USER = { id: 'user-1' };

function isoInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function alertForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('template_key', 'coupure_eau');
  fd.set('title_fr', "Coupure d'eau");
  fd.set('body_fr', 'Coupure prévue demain matin.');
  fd.set('duration_hours', '24');
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

function tipForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('category_key', 'pret_objet');
  fd.set('title_fr', 'Perceuse à prêter');
  fd.set('body_fr', 'Disponible le week-end.');
  fd.set('expires_on', isoInDays(5));
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  requireResidentMock.mockReset();
  insertSpy.mockReset();
  rpcSpy.mockReset();
  insertError = null;
  rpcError = null;
  rlSuccess = true;
  selectData = {
    users: { residence_id: 'res-1', role: 'resident' },
    alert_templates: { id: 'tpl-1' },
  };
  requireResidentMock.mockResolvedValue({ ok: true, user: USER });
});
afterEach(() => vi.restoreAllMocks());

describe('createAlert', () => {
  it('publie une alerte (slug, residence du user, template_id, expires_at calculé)', async () => {
    const res = await createAlert(CREATE_ALERT_INITIAL, alertForm());
    expect(res.ok).toBe(true);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const [table, payload] = insertSpy.mock.calls[0]! as [string, Record<string, unknown>];
    expect(table).toBe('alerts');
    expect(payload).toMatchObject({
      residence_id: 'res-1',
      template_id: 'tpl-1',
      title_fr: "Coupure d'eau",
    });
    expect(String(payload.slug)).toMatch(/^[a-z0-9][a-z0-9-]{0,79}$/);
    expect(payload).not.toHaveProperty('created_by');
    // expires_at ≈ now + 24h.
    const delta = new Date(payload.expires_at as string).getTime() - Date.now();
    expect(delta).toBeGreaterThan(23 * 3_600_000);
    expect(delta).toBeLessThan(25 * 3_600_000);
  });

  it('refuse si non authentifié (forbidden)', async () => {
    requireResidentMock.mockResolvedValue({ ok: false });
    const res = await createAlert(CREATE_ALERT_INITIAL, alertForm());
    expect(res).toMatchObject({ ok: false, error: { code: 'forbidden' } });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('durée invalide → validation/duration_invalid', async () => {
    const res = await createAlert(CREATE_ALERT_INITIAL, alertForm({ duration_hours: '999' }));
    expect(res).toMatchObject({
      ok: false,
      error: { code: 'validation', field: 'duration_hours', message_key: 'duration_invalid' },
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('titre vide → validation/fr_required', async () => {
    const res = await createAlert(CREATE_ALERT_INITIAL, alertForm({ title_fr: '   ' }));
    expect(res).toMatchObject({
      ok: false,
      error: { code: 'validation', message_key: 'fr_required' },
    });
  });

  it('rate-limit dépassé → rate_limited', async () => {
    rlSuccess = false;
    const res = await createAlert(CREATE_ALERT_INITIAL, alertForm());
    expect(res).toMatchObject({ ok: false, error: { code: 'rate_limited' } });
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe('createTip', () => {
  it('publie un bon plan (slug, category, expires_at fin de journée)', async () => {
    const res = await createTip(CREATE_TIP_INITIAL, tipForm());
    expect(res.ok).toBe(true);
    const [table, payload] = insertSpy.mock.calls[0]! as [string, Record<string, unknown>];
    expect(table).toBe('tips');
    expect(payload).toMatchObject({ residence_id: 'res-1', category_key: 'pret_objet' });
    expect(new Date(payload.expires_at as string).getTime()).toBeGreaterThan(Date.now());
  });

  it('expiration dans le passé → invalid_expiration', async () => {
    const res = await createTip(CREATE_TIP_INITIAL, tipForm({ expires_on: '2020-01-01' }));
    expect(res).toMatchObject({
      ok: false,
      error: { code: 'validation', field: 'expires_on', message_key: 'invalid_expiration' },
    });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('expiration > 30 jours → invalid_expiration', async () => {
    const res = await createTip(CREATE_TIP_INITIAL, tipForm({ expires_on: isoInDays(40) }));
    expect(res).toMatchObject({ ok: false, error: { message_key: 'invalid_expiration' } });
  });

  it('accepte la date max du picker (J+30, valeur par défaut du form)', async () => {
    // Review #1 : la borne est calculée en fin de journée calendaire J+30, sinon
    // la date max proposée (et pré-remplie) serait rejetée (23:59:59 > now+30j).
    const res = await createTip(CREATE_TIP_INITIAL, tipForm({ expires_on: isoInDays(30) }));
    expect(res.ok).toBe(true);
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });

  it('catégorie invalide → validation/category_invalid', async () => {
    const res = await createTip(CREATE_TIP_INITIAL, tipForm({ category_key: 'spam' }));
    expect(res).toMatchObject({
      ok: false,
      error: { field: 'category_key', message_key: 'category_invalid' },
    });
  });
});

describe('retractOwnEphemeral', () => {
  it('appelle la RPC retract_own_ephemeral avec le kind', async () => {
    const res = await retractOwnEphemeral('tip', 't1', 'plus disponible');
    expect(res.ok).toBe(true);
    expect(rpcSpy).toHaveBeenCalledWith('retract_own_ephemeral', {
      p_kind: 'tip',
      p_id: 't1',
      p_reason: 'plus disponible',
    });
  });

  it('mappe forbidden de la RPC', async () => {
    rpcError = { message: 'forbidden' };
    const res = await retractOwnEphemeral('alert', 'a1', '');
    expect(res).toMatchObject({ ok: false, code: 'forbidden' });
  });

  it('mappe not_found de la RPC', async () => {
    rpcError = { message: 'not_found' };
    const res = await retractOwnEphemeral('alert', 'a1', '');
    expect(res).toMatchObject({ ok: false, code: 'not_found' });
  });
});
