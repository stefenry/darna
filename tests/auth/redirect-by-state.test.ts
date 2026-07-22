import { describe, expect, it, vi } from 'vitest';
import { resolveRedirect } from '@/lib/auth/redirect-by-state';
import type { SupabaseClient, User } from '@supabase/supabase-js';

type State = 'pending' | 'accepted' | 'rejected';
type Role = 'demandeur' | 'resident' | 'co_mod';

// resolveRedirect fait 2 lookups depuis 2026-06 : public.users.role (source de
// vérité) puis, pour les non-résidents, la dernière admission_requests.state.
// Le mock dispatche sur le nom de table pour servir les deux chaînes.
function makeSupabase(opts: {
  role?: Role | null;
  state?: State | null;
  admissionError?: { code: string } | null;
}): SupabaseClient {
  const from = vi.fn((table: string) => {
    if (table === 'users') {
      const maybeSingle = vi.fn(async () => ({
        data: opts.role ? { role: opts.role } : null,
        error: null,
      }));
      const eq = vi.fn(() => ({ maybeSingle }));
      const select = vi.fn(() => ({ eq }));
      return { select };
    }
    const maybeSingle = vi.fn(async () => ({
      data: opts.state && !opts.admissionError ? { state: opts.state } : null,
      error: opts.admissionError ?? null,
    }));
    const limit = vi.fn(() => ({ maybeSingle }));
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    return { select };
  });
  return { from } as unknown as SupabaseClient;
}

const user = { id: 'user-uuid-1' } as User;

describe('resolveRedirect', () => {
  // Mapping rôle/état → route post-login, paramétré : mêmes étapes, seules
  // les données changent. Le cas « resident + latest rejected » documente que
  // users.role reste la source de vérité (un résident accepté puis refusé sur
  // une 2e demande ne doit pas être renvoyé sur /refused).
  it.each([
    { name: 'no record', mock: {}, expected: '/fr/admission' },
    {
      name: 'demandeur with state=pending',
      mock: { role: 'demandeur', state: 'pending' },
      expected: '/fr/admission/pending',
    },
    {
      name: 'demandeur with state=rejected',
      mock: { role: 'demandeur', state: 'rejected' },
      expected: '/fr/admission/refused',
    },
    { name: 'users.role=resident', mock: { role: 'resident' }, expected: '/fr/community/' },
    {
      name: 'users.role=resident with latest admission rejected (role is the source of truth)',
      mock: { role: 'resident', state: 'rejected' },
      expected: '/fr/community/',
    },
  ] as const)('$name → $expected', async ({ mock, expected }) => {
    const supabase = makeSupabase(mock);
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: null,
    });
    expect(result).toBe(expected);
  });

  it('co_mod (app_metadata) → /<locale>/comod, ignoring the default admission nextParam', async () => {
    const supabase = makeSupabase({});
    const comod = { id: 'comod-uuid-1', app_metadata: { role: 'co_mod' } } as unknown as User;
    const result = await resolveRedirect({
      supabase,
      user: comod,
      locale: 'fr',
      nextParam: '/fr/admission',
    });
    expect(result).toBe('/fr/comod');
  });

  it('honors nextParam when it points to a safe admission path under the current locale', async () => {
    const supabase = makeSupabase({});
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: '/fr/admission?from=login',
    });
    expect(result).toBe('/fr/admission?from=login');
  });

  it('honors nextParam pointing to /<locale>/admission/pending (Story 1.7 magic-link callback)', async () => {
    const supabase = makeSupabase({});
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: '/fr/admission/pending',
    });
    expect(result).toBe('/fr/admission/pending');
  });

  it('rejects nextParam that does not start with /<locale>/admission', async () => {
    const supabase = makeSupabase({ role: 'resident' });
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: '/fr/community/secret',
    });
    expect(result).toBe('/fr/community/');
  });

  it('rejects nextParam pointing to another locale to avoid open redirect', async () => {
    const supabase = makeSupabase({});
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: '/ar/admission',
    });
    expect(result).toBe('/fr/admission');
  });

  it('rejects nextParam that looks like a protocol-relative URL', async () => {
    const supabase = makeSupabase({});
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: '//evil.example/fr/admission',
    });
    expect(result).toBe('/fr/admission');
  });

  it('rejects nextParam that prefix-matches but escapes the allowed scope', async () => {
    const supabase = makeSupabase({});
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      // /fr/admissionEVIL passes the old `startsWith('/fr/admission')` check;
      // the tightened boundary now requires a '/' or '?' after the prefix.
      nextParam: '/fr/admissionEVIL/path',
    });
    expect(result).toBe('/fr/admission');
  });

  it('rejects nextParam containing backslash or CRLF', async () => {
    const supabase = makeSupabase({});
    const a = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: '/fr/admission/\\evil.example',
    });
    expect(a).toBe('/fr/admission');
    const b = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: '/fr/admission/foo\r\nLocation: x',
    });
    expect(b).toBe('/fr/admission');
  });

  it('falls back to /<locale>/admission and logs when Supabase returns an error', async () => {
    const supabase = makeSupabase({ admissionError: { code: 'PGRST301' } });
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: null,
    });
    expect(result).toBe('/fr/admission');
  });

  it('Story 6.3 — honors a canonical entity nextParam (deep link post-login)', async () => {
    const supabase = makeSupabase({ role: 'resident' });
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: '/artisan/hassan-plombier',
    });
    expect(result).toBe('/artisan/hassan-plombier');
  });

  it('Story 6.3 — rejects a non-canonical entity path (open-redirect guard)', async () => {
    const supabase = makeSupabase({ role: 'resident' });
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: '/artisan/hassan?x=1',
    });
    expect(result).toBe('/fr/community/');
  });
});
