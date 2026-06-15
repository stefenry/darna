// Story 1.3 — Tests RLS minimal + 3 attaques (alice/bob même résidence).
// Tests RLS exhaustifs (alice/bob/eve × 7 tables) = Story 1.10 (Gap #7, ADR 0008).
//
// Skip auto si SUPABASE_LOCAL_TEST != 'true' — la stack Docker locale doit
// tourner (`pnpm supabase start`). CI le skippe (pas de Docker en GitHub Actions
// pour ce job ; la validation prod se fait via `release.yml` → `db push`).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseSupabaseLocalEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/types.generated';

type DarnaClient = SupabaseClient<Database>;

const DARNA_RESIDENCE_ID = '00000000-0000-0000-0000-000000000001';
const RUN_LOCAL_RLS_TESTS = process.env.SUPABASE_LOCAL_TEST === 'true';

describe.skipIf(!RUN_LOCAL_RLS_TESTS)('RLS minimal — admission_requests', () => {
  let aliceId: string;
  let bobId: string;
  let adminClient: DarnaClient;
  let aliceClient: DarnaClient;
  let bobClient: DarnaClient;

  beforeAll(async () => {
    // Validation Zod via lib/env (review 1.3 — AR17, pas de process.env direct).
    const localEnv = parseSupabaseLocalEnv();

    adminClient = createClient<Database>(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_SERVICE_KEY,
    );

    const { data: alice, error: aliceErr } = await adminClient.auth.admin.createUser({
      email: `alice-${Date.now()}@test.darna.local`,
      password: 'test-password-1234',
      email_confirm: true,
    });
    if (aliceErr || !alice.user) throw aliceErr ?? new Error('alice create failed');
    aliceId = alice.user.id;

    const { data: bob, error: bobErr } = await adminClient.auth.admin.createUser({
      email: `bob-${Date.now()}@test.darna.local`,
      password: 'test-password-1234',
      email_confirm: true,
    });
    if (bobErr || !bob.user) throw bobErr ?? new Error('bob create failed');
    bobId = bob.user.id;

    // storageKey distincts pour isoler les sessions alice/bob (sinon le signin
    // de bob écrase celui d'alice et les RLS reçoivent le mauvais JWT).
    aliceClient = createClient<Database>(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      {
        auth: { storageKey: 'rls-test-alice', persistSession: false },
      },
    );
    bobClient = createClient<Database>(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      {
        auth: { storageKey: 'rls-test-bob', persistSession: false },
      },
    );

    const { data: aliceSession } = await aliceClient.auth.signInWithPassword({
      email: alice.user.email!,
      password: 'test-password-1234',
    });
    if (!aliceSession.session) throw new Error('alice signin failed');

    const { data: bobSession } = await bobClient.auth.signInWithPassword({
      email: bob.user.email!,
      password: 'test-password-1234',
    });
    if (!bobSession.session) throw new Error('bob signin failed');

    const { error: insertErr } = await aliceClient.from('admission_requests').insert({
      user_id: aliceId,
      residence_id: DARNA_RESIDENCE_ID,
      villa: 42,
      first_name: 'Alice',
      contact_channel: 'email',
    });
    if (insertErr) throw insertErr;
  });

  afterAll(async () => {
    if (adminClient) {
      if (aliceId) await adminClient.auth.admin.deleteUser(aliceId);
      if (bobId) await adminClient.auth.admin.deleteUser(bobId);
    }
  });

  it('alice lit sa propre demande (admission_requests_demandeur_select)', async () => {
    const { data, error } = await aliceClient.from('admission_requests').select('*');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.user_id).toBe(aliceId);
  });

  it("bob ne peut PAS lire la demande d'alice (RLS bloque cross-user)", async () => {
    const { data, error } = await bobClient.from('admission_requests').select('*');
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  // ── Tests adversariaux ajoutés post-review 1.3 ──────────────────────────────

  it("alice ne peut PAS s'auto-promouvoir co_mod (column-level REVOKE UPDATE)", async () => {
    // Tentative directe : update users set role='co_mod' where id = self.
    // La policy users_resident_update_self autorise le row, mais le REVOKE
    // column-level sur (role, residence_id, ...) bloque la mutation.
    const { error } = await aliceClient.from('users').update({ role: 'co_mod' }).eq('id', aliceId);
    // Postgres renvoie une erreur 42501 (insufficient privilege) sur la colonne.
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it("alice ne peut PAS s'auto-valider en INSERT state='accepted' (column-level GRANT INSERT)", async () => {
    // Tentative d'auto-admission : INSERT direct avec state='accepted'.
    // Le grant column-level INSERT n'autorise pas la colonne state → defaults
    // 'pending' s'applique, OU l'INSERT échoue si state est explicitement set.
    const { error } = await aliceClient.from('admission_requests').insert({
      user_id: aliceId,
      residence_id: DARNA_RESIDENCE_ID,
      villa: 99,
      first_name: 'Alice-malicious',
      contact_channel: 'email',
      state: 'accepted',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it("bob ne peut PAS UPDATE la demande d'alice (RLS bloque + co_mod_update non applicable)", async () => {
    // bob est demandeur (pas co_mod), aucune policy UPDATE sur admission_requests
    // ne le matche → 0 row affected (PostgREST renvoie OK avec data=null).
    const { data, error } = await bobClient
      .from('admission_requests')
      .update({ state: 'rejected', decision_reason: 'duplicate' })
      .eq('user_id', aliceId)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
