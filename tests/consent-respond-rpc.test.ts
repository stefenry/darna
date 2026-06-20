// Story 2.8 — RPC `process_artisan_response` + `request_artisan_contact_link`
// contre la stack Supabase locale (gated Docker, comme tests/consent-rpc.test.ts).
// Prouve response/rectification, gate atomique, filtre purpose, AR38 not_found.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseSupabaseLocalEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/types.generated';

type DarnaClient = SupabaseClient<Database>;
const DARNA_RESIDENCE_ID = '00000000-0000-0000-0000-000000000001';
const RUN = process.env.SUPABASE_LOCAL_TEST === 'true';

describe.skipIf(!RUN)('process_artisan_response RPC (Story 2.8)', () => {
  let admin: DarnaClient;
  const artisanIds: string[] = [];

  function uniquePhone(ts: number): string {
    return `+2128${String(ts).slice(-8)}`;
  }

  // Crée un artisan published + un token (purpose paramétrable). Retourne ids.
  async function seed(
    tokenHash: string,
    opts: { purpose?: 'consent' | 'respond'; expiresAt?: string } = {},
  ): Promise<{ artisanId: string }> {
    const ts = Date.now() + Math.floor(Math.random() * 1e6);
    const { data: a, error } = await admin
      .from('artisans')
      .insert({
        slug: `respond-test-${ts}`,
        residence_id: DARNA_RESIDENCE_ID,
        display_name_fr: 'Respond Test',
        phone_e164: uniquePhone(ts),
        state: 'published',
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error || !a) throw error ?? new Error('seed artisan failed');
    artisanIds.push(a.id);
    const { error: tErr } = await admin.from('artisan_consent_tokens').insert({
      artisan_id: a.id,
      residence_id: DARNA_RESIDENCE_ID,
      token_hash: tokenHash,
      expires_at: opts.expiresAt ?? new Date(Date.now() + 86_400_000).toISOString(),
      purpose: opts.purpose ?? 'respond',
    });
    if (tErr) throw tErr;
    return { artisanId: a.id };
  }

  beforeAll(() => {
    const env = parseSupabaseLocalEnv();
    admin = createClient<Database>(env.SUPABASE_LOCAL_URL, env.SUPABASE_LOCAL_SERVICE_KEY);
  });

  afterAll(async () => {
    if (!admin) return;
    for (const id of artisanIds) {
      await admin.from('moderation_log').delete().eq('target_id', id);
      await admin.from('artisan_responses').delete().eq('artisan_id', id);
      await admin.from('artisan_rectification_requests').delete().eq('artisan_id', id);
      await admin.from('artisan_consent_tokens').delete().eq('artisan_id', id);
      await admin.from('artisans').delete().eq('id', id);
    }
  });

  it('response listing → published + artisan_responses + moderation_log', async () => {
    const { artisanId } = await seed('hash-resp-listing');
    const { data } = await admin.rpc('process_artisan_response', {
      p_token_hash: 'hash-resp-listing',
      p_kind: 'response',
      p_payload: {
        response_text: 'Merci pour votre retour, je m’améliore.',
        target_kind: 'listing',
      },
    });
    expect(data?.[0]?.status).toBe('published');
    const { data: resp } = await admin
      .from('artisan_responses')
      .select('target_kind, response_text')
      .eq('artisan_id', artisanId);
    expect(resp?.length).toBe(1);
    expect(resp?.[0]?.target_kind).toBe('listing');
    const { data: logs } = await admin
      .from('moderation_log')
      .select('action')
      .eq('target_id', artisanId);
    expect(logs?.some((l) => l.action === 'artisan_response_published')).toBe(true);
  });

  it('response rating (cible valide) → target_kind=rating', async () => {
    const { artisanId } = await seed('hash-resp-rating');
    const { data: rating } = await admin
      .from('ratings')
      .insert({
        artisan_id: artisanId,
        residence_id: DARNA_RESIDENCE_ID,
        score_depannage: 4,
        comment_text: 'Bien',
      })
      .select('id')
      .single();
    const { data } = await admin.rpc('process_artisan_response', {
      p_token_hash: 'hash-resp-rating',
      p_kind: 'response',
      p_payload: { response_text: 'Réponse ciblée', target_kind: 'rating', target_id: rating!.id },
    });
    expect(data?.[0]?.status).toBe('published');
    const { data: resp } = await admin
      .from('artisan_responses')
      .select('target_kind, target_id')
      .eq('artisan_id', artisanId);
    expect(resp?.[0]?.target_kind).toBe('rating');
    expect(resp?.[0]?.target_id).toBe(rating!.id);
  });

  it('response rating (cible d’un autre artisan) → dégrade en listing', async () => {
    const { artisanId } = await seed('hash-resp-badtarget');
    const { data } = await admin.rpc('process_artisan_response', {
      p_token_hash: 'hash-resp-badtarget',
      p_kind: 'response',
      p_payload: {
        response_text: 'X',
        target_kind: 'rating',
        target_id: '00000000-0000-0000-0000-0000000000ff',
      },
    });
    expect(data?.[0]?.status).toBe('published');
    const { data: resp } = await admin
      .from('artisan_responses')
      .select('target_kind, target_id')
      .eq('artisan_id', artisanId);
    expect(resp?.[0]?.target_kind).toBe('listing');
    expect(resp?.[0]?.target_id).toBeNull();
  });

  it('rectification → pending + artisan_rectification_requests + log', async () => {
    const { artisanId } = await seed('hash-rectif');
    const { data } = await admin.rpc('process_artisan_response', {
      p_token_hash: 'hash-rectif',
      p_kind: 'rectification',
      p_payload: {
        field_target: 'phone_e164',
        requested_value: '+212600000123',
        justification_text: 'Mon numéro a changé',
      },
    });
    expect(data?.[0]?.status).toBe('rectification_pending');
    const { data: rectif } = await admin
      .from('artisan_rectification_requests')
      .select('field_target, state')
      .eq('artisan_id', artisanId);
    expect(rectif?.[0]?.field_target).toBe('phone_e164');
    expect(rectif?.[0]?.state).toBe('pending');
  });

  it('token cross-purpose (consent) sur process_artisan_response → not_found (AR38)', async () => {
    await seed('hash-crosspurpose', { purpose: 'consent' });
    const { data } = await admin.rpc('process_artisan_response', {
      p_token_hash: 'hash-crosspurpose',
      p_kind: 'response',
      p_payload: { response_text: 'X', target_kind: 'listing' },
    });
    expect(data?.[0]?.status).toBe('not_found');
  });

  it('token inexistant → not_found', async () => {
    const { data } = await admin.rpc('process_artisan_response', {
      p_token_hash: 'does-not-exist-2-8',
      p_kind: 'response',
      p_payload: { response_text: 'X', target_kind: 'listing' },
    });
    expect(data?.[0]?.status).toBe('not_found');
  });

  it('token expiré → expired', async () => {
    await seed('hash-resp-expired', { expiresAt: new Date(Date.now() - 86_400_000).toISOString() });
    const { data } = await admin.rpc('process_artisan_response', {
      p_token_hash: 'hash-resp-expired',
      p_kind: 'response',
      p_payload: { response_text: 'X', target_kind: 'listing' },
    });
    expect(data?.[0]?.status).toBe('expired');
  });

  it('idempotence : 2e POST sur token used → already_used', async () => {
    await seed('hash-resp-idem');
    await admin.rpc('process_artisan_response', {
      p_token_hash: 'hash-resp-idem',
      p_kind: 'response',
      p_payload: { response_text: 'Première', target_kind: 'listing' },
    });
    const { data: again } = await admin.rpc('process_artisan_response', {
      p_token_hash: 'hash-resp-idem',
      p_kind: 'response',
      p_payload: { response_text: 'Seconde', target_kind: 'listing' },
    });
    expect(again?.[0]?.status).toBe('already_used');
  });

  it('kind invalide → invalid_decision (token NON consommé)', async () => {
    await seed('hash-resp-badkind');
    const { data } = await admin.rpc('process_artisan_response', {
      p_token_hash: 'hash-resp-badkind',
      p_kind: 'bogus',
      p_payload: {},
    });
    expect(data?.[0]?.status).toBe('invalid_decision');
    // token non consommé → un kind valide passe ensuite
    const { data: retry } = await admin.rpc('process_artisan_response', {
      p_token_hash: 'hash-resp-badkind',
      p_kind: 'response',
      p_payload: { response_text: 'Ok maintenant', target_kind: 'listing' },
    });
    expect(retry?.[0]?.status).toBe('published');
  });

  it('request_artisan_contact_link : phone publié → sent ; inconnu → not_found', async () => {
    const ts = Date.now() + Math.floor(Math.random() * 1e6);
    const phone = uniquePhone(ts);
    const { data: a } = await admin
      .from('artisans')
      .insert({
        slug: `contact-test-${ts}`,
        residence_id: DARNA_RESIDENCE_ID,
        display_name_fr: 'Contact Test',
        phone_e164: phone,
        state: 'published',
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    artisanIds.push(a!.id);
    const { data: sent } = await admin.rpc('request_artisan_contact_link', {
      p_phone_e164: phone,
      p_token_hash: 'hash-contact-1',
      p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(sent?.[0]?.status).toBe('sent');
    const { data: nf } = await admin.rpc('request_artisan_contact_link', {
      p_phone_e164: '+212600000777',
      p_token_hash: 'hash-contact-2',
      p_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(nf?.[0]?.status).toBe('not_found');
  });
});
