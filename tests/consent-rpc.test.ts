// Story 2.5 — test de la RPC transactionnelle process_artisan_consent contre la
// stack Supabase locale (gated Docker, comme tests/rls.test.ts). Prouve les
// transitions d'état, l'idempotence, l'expiration et le not_found.
// Lancer : pnpm test:rls-style → voir [[project_rls_tests_local_setup]].

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseSupabaseLocalEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/types.generated';

type DarnaClient = SupabaseClient<Database>;
const DARNA_RESIDENCE_ID = '00000000-0000-0000-0000-000000000001';
const RUN = process.env.SUPABASE_LOCAL_TEST === 'true';

describe.skipIf(!RUN)('process_artisan_consent RPC (Story 2.5)', () => {
  let admin: DarnaClient;
  const artisanIds: string[] = [];

  // Phone unique par seed (l'index `artisans_phone_e164_active_unique` interdit 2
  // artisans actifs au même numéro — un phone hardcodé collisionnait dès le 2e seed).
  function uniquePhone(ts: number): string {
    return `+2126${String(ts).slice(-8)}`;
  }

  async function seed(tokenHash: string, expiresAt: string): Promise<string> {
    const ts = Date.now() + Math.floor(Math.random() * 1e6);
    const { data: a, error } = await admin
      .from('artisans')
      .insert({
        slug: `consent-test-${ts}`,
        residence_id: DARNA_RESIDENCE_ID,
        display_name_fr: 'Consent Test',
        phone_e164: uniquePhone(ts),
        state: 'pending_consent',
      })
      .select('id')
      .single();
    if (error || !a) throw error ?? new Error('seed artisan failed');
    artisanIds.push(a.id);
    const { error: tErr } = await admin.from('artisan_consent_tokens').insert({
      artisan_id: a.id,
      residence_id: DARNA_RESIDENCE_ID,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (tErr) throw tErr;
    return a.id;
  }

  // Story 2.7 — artisan PUBLISHED avec un draft PII en attente (re-consent).
  async function seedReconsent(
    tokenHash: string,
    pendingName: string,
    pendingPhone: string,
  ): Promise<string> {
    const ts = Date.now() + Math.floor(Math.random() * 1e6);
    const { data: a, error } = await admin
      .from('artisans')
      .insert({
        slug: `reconsent-test-${ts}`,
        residence_id: DARNA_RESIDENCE_ID,
        display_name_fr: 'Ancien Nom',
        phone_e164: uniquePhone(ts),
        state: 'published',
        published_at: new Date().toISOString(),
        pending_display_name_fr: pendingName,
        pending_phone_e164: pendingPhone,
      })
      .select('id')
      .single();
    if (error || !a) throw error ?? new Error('seed reconsent failed');
    artisanIds.push(a.id);
    const { error: tErr } = await admin.from('artisan_consent_tokens').insert({
      artisan_id: a.id,
      residence_id: DARNA_RESIDENCE_ID,
      token_hash: tokenHash,
      expires_at: future(),
    });
    if (tErr) throw tErr;
    return a.id;
  }

  const future = () => new Date(Date.now() + 7 * 86_400_000).toISOString();
  const past = () => new Date(Date.now() - 86_400_000).toISOString();

  beforeAll(() => {
    const env = parseSupabaseLocalEnv();
    admin = createClient<Database>(env.SUPABASE_LOCAL_URL, env.SUPABASE_LOCAL_SERVICE_KEY);
  });

  afterAll(async () => {
    if (!admin) return;
    for (const id of artisanIds) {
      await admin.from('moderation_log').delete().eq('target_id', id);
      await admin.from('artisan_consent_tokens').delete().eq('artisan_id', id);
      await admin.from('artisans').delete().eq('id', id);
    }
  });

  it('accept → published, published_at posé, + idempotent (re-clic = already_used)', async () => {
    const id = await seed('hash-accept', future());
    const { data, error } = await admin.rpc('process_artisan_consent', {
      p_token_hash: 'hash-accept',
      p_decision: 'accept',
    });
    expect(error).toBeNull();
    expect(data?.[0]?.status).toBe('accepted');

    const { data: art } = await admin
      .from('artisans')
      .select('state, published_at')
      .eq('id', id)
      .single();
    expect(art?.state).toBe('published');
    expect(art?.published_at).not.toBeNull();

    // Idempotence : un 2e appel ne republie pas.
    const { data: again } = await admin.rpc('process_artisan_consent', {
      p_token_hash: 'hash-accept',
      p_decision: 'accept',
    });
    expect(again?.[0]?.status).toBe('already_used');

    // moderation_log enregistré.
    const { data: logs } = await admin.from('moderation_log').select('action').eq('target_id', id);
    expect(logs?.some((l) => l.action === 'artisan_published')).toBe(true);
  });

  it('refuse → refused + soft-deleted', async () => {
    const id = await seed('hash-refuse', future());
    const { data } = await admin.rpc('process_artisan_consent', {
      p_token_hash: 'hash-refuse',
      p_decision: 'refuse',
    });
    expect(data?.[0]?.status).toBe('refused');
    const { data: art } = await admin
      .from('artisans')
      .select('state, deleted_at')
      .eq('id', id)
      .single();
    expect(art?.state).toBe('refused');
    expect(art?.deleted_at).not.toBeNull();
  });

  it('token expiré → expired, artisan reste pending', async () => {
    const id = await seed('hash-expired', past());
    const { data } = await admin.rpc('process_artisan_consent', {
      p_token_hash: 'hash-expired',
      p_decision: 'accept',
    });
    expect(data?.[0]?.status).toBe('expired');
    const { data: art } = await admin.from('artisans').select('state').eq('id', id).single();
    expect(art?.state).toBe('pending_consent');
  });

  it('token inexistant → not_found (AR38)', async () => {
    const { data } = await admin.rpc('process_artisan_consent', {
      p_token_hash: 'does-not-exist',
      p_decision: 'accept',
    });
    expect(data?.[0]?.status).toBe('not_found');
  });

  // ── Story 2.7 — re-consent draft (extension Task 8) ──────────────────────────
  it('re-consent accept → PII du draft promues, fiche reste publiée', async () => {
    const id = await seedReconsent('hash-reconsent-accept', 'Nouveau Nom', '+212699999999');
    const { data } = await admin.rpc('process_artisan_consent', {
      p_token_hash: 'hash-reconsent-accept',
      p_decision: 'accept',
    });
    expect(data?.[0]?.status).toBe('accepted');
    const { data: art } = await admin
      .from('artisans')
      .select('state, display_name_fr, phone_e164, pending_display_name_fr, pending_phone_e164')
      .eq('id', id)
      .single();
    expect(art?.state).toBe('published');
    expect(art?.display_name_fr).toBe('Nouveau Nom');
    expect(art?.phone_e164).toBe('+212699999999');
    expect(art?.pending_display_name_fr).toBeNull();
    expect(art?.pending_phone_e164).toBeNull();
  });

  it('re-consent refuse → draft jeté, fiche reste publiée à l’ancien contenu', async () => {
    const id = await seedReconsent('hash-reconsent-refuse', 'Rejeté', '+212688888888');
    const { data } = await admin.rpc('process_artisan_consent', {
      p_token_hash: 'hash-reconsent-refuse',
      p_decision: 'refuse',
    });
    expect(data?.[0]?.status).toBe('refused');
    const { data: art } = await admin
      .from('artisans')
      .select('state, display_name_fr, deleted_at, pending_display_name_fr')
      .eq('id', id)
      .single();
    expect(art?.state).toBe('published');
    expect(art?.deleted_at).toBeNull();
    expect(art?.display_name_fr).toBe('Ancien Nom');
    expect(art?.pending_display_name_fr).toBeNull();
  });
});
