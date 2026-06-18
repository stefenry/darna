import { describe, expect, it, vi } from 'vitest';
import { resolveRedirect } from '@/lib/auth/redirect-by-state';
import type { SupabaseClient, User } from '@supabase/supabase-js';

type State = 'pending' | 'accepted' | 'rejected';

function makeSupabase(
  state: State | null,
  opts?: { error?: { code: string } | null },
): SupabaseClient {
  const maybeSingle = vi.fn(async () => ({
    data: state === null || opts?.error ? null : { state },
    error: opts?.error ?? null,
  }));
  const limit = vi.fn(() => ({ maybeSingle }));
  const order = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from } as unknown as SupabaseClient;
}

const user = { id: 'user-uuid-1' } as User;

describe('resolveRedirect', () => {
  it('no record → /<locale>/admission', async () => {
    const supabase = makeSupabase(null);
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: null,
    });
    expect(result).toBe('/fr/admission');
  });

  it('state=pending → /<locale>/admission/pending', async () => {
    const supabase = makeSupabase('pending');
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: null,
    });
    expect(result).toBe('/fr/admission/pending');
  });

  it('state=accepted → /<locale>/community/', async () => {
    const supabase = makeSupabase('accepted');
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: null,
    });
    expect(result).toBe('/fr/community/');
  });

  it('state=rejected → /<locale>/admission/refused', async () => {
    const supabase = makeSupabase('rejected');
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: null,
    });
    expect(result).toBe('/fr/admission/refused');
  });

  it('honors nextParam when it points to a safe admission path under the current locale', async () => {
    const supabase = makeSupabase(null);
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: '/fr/admission?from=login',
    });
    expect(result).toBe('/fr/admission?from=login');
  });

  it('honors nextParam pointing to /<locale>/admission/pending (Story 1.7 magic-link callback)', async () => {
    const supabase = makeSupabase(null);
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: '/fr/admission/pending',
    });
    expect(result).toBe('/fr/admission/pending');
  });

  it('rejects nextParam that does not start with /<locale>/admission', async () => {
    const supabase = makeSupabase('accepted');
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: '/fr/community/secret',
    });
    expect(result).toBe('/fr/community/');
  });

  it('rejects nextParam pointing to another locale to avoid open redirect', async () => {
    const supabase = makeSupabase(null);
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: '/ar/admission',
    });
    expect(result).toBe('/fr/admission');
  });

  it('rejects nextParam that looks like a protocol-relative URL', async () => {
    const supabase = makeSupabase(null);
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: '//evil.example/fr/admission',
    });
    expect(result).toBe('/fr/admission');
  });

  it('rejects nextParam that prefix-matches but escapes the allowed scope', async () => {
    const supabase = makeSupabase(null);
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
    const supabase = makeSupabase(null);
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
    const supabase = makeSupabase(null, { error: { code: 'PGRST301' } });
    const result = await resolveRedirect({
      supabase,
      user,
      locale: 'fr',
      nextParam: null,
    });
    expect(result).toBe('/fr/admission');
  });
});
