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

// Le projet est magic-link only (password login désactivé : `enable_signup=false`
// → `signInWithPassword` renvoie `email_provider_disabled`). On établit donc les
// sessions de test via le flux OTP admin (generateLink magic-link → verifyOtp),
// fidèle au modèle d'auth réel de l'app.
async function establishSession(
  admin: DarnaClient,
  client: DarnaClient,
  email: string,
  label = email,
): Promise<void> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    throw new Error(`${label} generateLink failed: ${error?.message ?? 'no token'}`);
  }
  const { data: session, error: verifyErr } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (verifyErr || !session.session) {
    throw new Error(`${label} magic-link signin failed: ${verifyErr?.message ?? 'no session'}`);
  }
}

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

    await establishSession(adminClient, aliceClient, alice.user.email!, 'alice');
    await establishSession(adminClient, bobClient, bob.user.email!, 'bob');

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

// Story 1.10c (AR32) — Isolation cross-résidence : karim (co_mod résidence 1) vs
// eve (co_mod résidence 2). Scope corrigé (D2) : seules les tables EXISTANTES
// sont testées (admission_requests, profiles, moderation_log) ; artisans/ratings/
// alerts/alert_comments/guide_entries rejoindront ce test en epic 2.1+ (ADR 0008).
const RESIDENCE_2_ID = '000000e2-0000-0000-0000-000000000002';

describe.skipIf(!RUN_LOCAL_RLS_TESTS)('RLS cross-résidence (AR32)', () => {
  let admin: DarnaClient;
  let karimId: string; // co_mod résidence 1 (Darna)
  let eveId: string; // co_mod résidence 2
  let salmaId: string; // demandeur résidence 1 (cible)
  let karimClient: DarnaClient; // JWT app_metadata role=co_mod, residence_id=res1
  let eveClient: DarnaClient; // JWT app_metadata role=co_mod, residence_id=res2
  let salmaClient: DarnaClient; // JWT role=demandeur, résidence 1

  // Crée un user, lui pose app_metadata + users.role/residence_id (service-role),
  // puis le re-signe pour que le JWT porte le rôle/résidence (auth_role/auth_residence_id).
  async function makeCoMod(
    localUrl: string,
    publishableKey: string,
    label: string,
    residenceId: string,
  ): Promise<{ id: string; client: DarnaClient }> {
    const email = `${label}-${Date.now()}@test.darna.local`;
    const password = 'test-password-1234';
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !created.user) throw error ?? new Error(`${label} create failed`);
    const id = created.user.id;

    await admin.auth.admin.updateUserById(id, {
      app_metadata: { role: 'co_mod', residence_id: residenceId },
    });
    // Cohérence DB (residence_id du trigger = Darna par défaut → corriger pour eve).
    const { error: updateErr } = await admin
      .from('users')
      .update({ role: 'co_mod', residence_id: residenceId })
      .eq('id', id);
    if (updateErr) throw new Error(`${label} users update failed: ${updateErr.message}`);

    const client = createClient<Database>(localUrl, publishableKey, {
      auth: { storageKey: `rls-${label}`, persistSession: false },
    });
    await establishSession(admin, client, email, label);
    return { id, client };
  }

  beforeAll(async () => {
    const localEnv = parseSupabaseLocalEnv();
    admin = createClient<Database>(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_SERVICE_KEY,
    );

    // 2e résidence (le seed n'en fournit qu'une).
    await admin.from('residences').upsert({
      id: RESIDENCE_2_ID,
      name: 'Test Residence 2',
      slug: `test2-${Date.now()}`,
      villa_count: 150,
    });

    const karim = await makeCoMod(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'karim',
      DARNA_RESIDENCE_ID,
    );
    karimId = karim.id;
    karimClient = karim.client;

    const eve = await makeCoMod(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'eve',
      RESIDENCE_2_ID,
    );
    eveId = eve.id;
    eveClient = eve.client;

    // Cible : salma, demandeur résidence 1, avec une demande pending + un profil
    // (insérés via service-role pour bypass RLS au seeding).
    const salmaEmail = `salma-${Date.now()}@test.darna.local`;
    const salmaPassword = 'test-password-1234';
    const { data: salma, error: salmaErr } = await admin.auth.admin.createUser({
      email: salmaEmail,
      password: salmaPassword,
      email_confirm: true,
    });
    if (salmaErr || !salma.user) throw salmaErr ?? new Error('salma create failed');
    salmaId = salma.user.id;

    salmaClient = createClient<Database>(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      {
        auth: { storageKey: 'rls-salma', persistSession: false },
      },
    );
    await establishSession(admin, salmaClient, salmaEmail, 'salma');

    await admin.from('admission_requests').insert({
      user_id: salmaId,
      residence_id: DARNA_RESIDENCE_ID,
      villa: 12,
      first_name: 'Salma',
      contact_channel: 'email',
    });
    await admin.from('profiles').insert({
      user_id: salmaId,
      residence_id: DARNA_RESIDENCE_ID,
      villa: 12,
    });
    await admin.from('moderation_log').insert({
      residence_id: DARNA_RESIDENCE_ID,
      actor_id: karimId,
      action: 'admission_accepted',
      target_kind: 'admission_request',
      target_id: salmaId,
    });
  });

  afterAll(async () => {
    if (!admin) return;
    // Nettoyer les rows moderation_log de RESIDENCE_2 avant de supprimer la résidence
    // (FK RESTRICT bloquerait le delete si un INSERT test avait réussi).
    await admin.from('moderation_log').delete().eq('residence_id', RESIDENCE_2_ID);
    for (const id of [karimId, eveId, salmaId]) {
      if (id) await admin.auth.admin.deleteUser(id);
    }
    await admin.from('residences').delete().eq('id', RESIDENCE_2_ID);
  });

  it('karim (co_mod résidence 1) voit la demande de salma', async () => {
    const { data, error } = await karimClient
      .from('admission_requests')
      .select('*')
      .eq('user_id', salmaId);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it('eve (co_mod résidence 2) ne voit PAS la demande de salma (isolation cross-résidence)', async () => {
    const { data, error } = await eveClient
      .from('admission_requests')
      .select('*')
      .eq('user_id', salmaId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('karim voit le profil de salma (même résidence)', async () => {
    const { data, error } = await karimClient.from('profiles').select('*').eq('user_id', salmaId);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it('eve ne voit PAS le profil de salma (isolation cross-résidence)', async () => {
    const { data, error } = await eveClient.from('profiles').select('*').eq('user_id', salmaId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('moderation_log est lisible publiquement (transparence FR33) — eve y accède', async () => {
    const { data, error } = await eveClient.from('moderation_log').select('*');
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it("salma (demandeur rés.1) ne peut PAS s'auto-promouvoir co_mod (AC1.3 — REVOKE UPDATE role → 42501)", async () => {
    const { error } = await salmaClient.from('users').update({ role: 'co_mod' }).eq('id', salmaId);
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('eve ne peut PAS écrire dans moderation_log (écriture system-only)', async () => {
    const { error } = await eveClient.from('moderation_log').insert({
      residence_id: RESIDENCE_2_ID,
      actor_id: eveId,
      action: 'admission_rejected',
      target_kind: 'admission_request',
      target_id: salmaId,
    });
    // Aucune policy INSERT côté client → RLS refuse. Asserter le code précis
    // (sinon le test passerait sur une erreur sans rapport — code review P3).
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });
});

// Story 2.1 (AC8, ADR 0008) — Isolation artisans/ratings : cross-résidence,
// cross-user, masquage des pending_consent d'autrui, column-level GRANT.
// alice = resident résidence 1 (Darna) ; bob = resident résidence 1 ;
// eve = resident résidence 2. Réutilise le pattern makeResident (variante de
// makeCoMod : role='resident'), storageKey distincts + re-sign.
describe.skipIf(!RUN_LOCAL_RLS_TESTS)('RLS artisans / ratings (AC8)', () => {
  let admin: DarnaClient;
  let aliceId: string;
  let bobId: string;
  let eveId: string;
  let aliceClient: DarnaClient;
  let bobClient: DarnaClient;
  let eveClient: DarnaClient;
  let publishedArtisanId: string; // artisan published d'alice (résidence 1)
  let pendingArtisanId: string; // artisan pending_consent d'alice (résidence 1)

  // Crée un resident : app_metadata {role, residence_id} + DB users.role/residence_id,
  // puis re-signe pour que le JWT porte le claim (auth_role/auth_residence_id).
  async function makeResident(
    localUrl: string,
    publishableKey: string,
    label: string,
    residenceId: string,
  ): Promise<{ id: string; client: DarnaClient }> {
    const email = `${label}-${Date.now()}@test.darna.local`;
    const password = 'test-password-1234';
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !created.user) throw error ?? new Error(`${label} create failed`);
    const id = created.user.id;

    await admin.auth.admin.updateUserById(id, {
      app_metadata: { role: 'resident', residence_id: residenceId },
    });
    const { error: updateErr } = await admin
      .from('users')
      .update({ role: 'resident', residence_id: residenceId })
      .eq('id', id);
    if (updateErr) throw new Error(`${label} users update failed: ${updateErr.message}`);

    const client = createClient<Database>(localUrl, publishableKey, {
      auth: { storageKey: `rls-art-${label}`, persistSession: false },
    });
    await establishSession(admin, client, email, label);
    return { id, client };
  }

  beforeAll(async () => {
    const localEnv = parseSupabaseLocalEnv();
    admin = createClient<Database>(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_SERVICE_KEY,
    );

    await admin.from('residences').upsert({
      id: RESIDENCE_2_ID,
      name: 'Test Residence 2',
      slug: `test2-art-${Date.now()}`,
      villa_count: 150,
    });

    const alice = await makeResident(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'alice',
      DARNA_RESIDENCE_ID,
    );
    aliceId = alice.id;
    aliceClient = alice.client;
    const bob = await makeResident(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'bob',
      DARNA_RESIDENCE_ID,
    );
    bobId = bob.id;
    bobClient = bob.client;
    const eve = await makeResident(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'eve',
      RESIDENCE_2_ID,
    );
    eveId = eve.id;
    eveClient = eve.client;

    // Artisan PUBLISHED d'alice (service-role pour poser state='published' que le
    // grant client interdit) + artisan PENDING_CONSENT d'alice.
    const ts = Date.now();
    const { data: pub, error: pubErr } = await admin
      .from('artisans')
      .insert({
        slug: `hassan-plombier-${ts}`,
        residence_id: DARNA_RESIDENCE_ID,
        display_name_fr: 'Hassan Plombier',
        phone_e164: '+212600000001',
        state: 'published',
        created_by: aliceId,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (pubErr || !pub) throw pubErr ?? new Error('published artisan insert failed');
    publishedArtisanId = pub.id;

    const { data: pend, error: pendErr } = await admin
      .from('artisans')
      .insert({
        slug: `karim-elec-${ts}`,
        residence_id: DARNA_RESIDENCE_ID,
        display_name_fr: 'Karim Électricien',
        phone_e164: '+212600000002',
        state: 'pending_consent',
        created_by: aliceId,
      })
      .select()
      .single();
    if (pendErr || !pend) throw pendErr ?? new Error('pending artisan insert failed');
    pendingArtisanId = pend.id;

    // Review F39 — agrégat de notation pré-existant via rating anonymisé
    // (user_id IS NULL, ADR 0006). Garantit l'existence de la vue agrégat
    // pour les tests « voit l'agrégat / ne voit pas l'agrégat » sans
    // dépendre de l'ordre des tests (« bob peut noter » plus loin pouvait
    // ne pas avoir tourné encore avec `--shuffle`). Admin bypass RLS donc
    // OK pour le seed.
    const { error: seedRatingErr } = await admin.from('ratings').insert({
      artisan_id: publishedArtisanId,
      user_id: null,
      residence_id: DARNA_RESIDENCE_ID,
      score_depannage: 4,
    });
    if (seedRatingErr) throw new Error(`seed rating failed: ${seedRatingErr.message}`);
  });

  afterAll(async () => {
    if (!admin) return;
    // Enfants (ratings/artisan FK cascade depuis artisans), puis artisans, users, résidence.
    await admin.from('ratings').delete().in('artisan_id', [publishedArtisanId, pendingArtisanId]);
    await admin.from('artisans').delete().in('id', [publishedArtisanId, pendingArtisanId]);
    for (const id of [aliceId, bobId, eveId]) {
      if (id) await admin.auth.admin.deleteUser(id);
    }
    await admin.from('residences').delete().eq('id', RESIDENCE_2_ID);
  });

  it("bob (même résidence) voit l'artisan published d'alice", async () => {
    const { data, error } = await bobClient
      .from('artisans')
      .select('*')
      .eq('id', publishedArtisanId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("eve (résidence 2) ne voit PAS l'artisan published d'alice (isolation cross-résidence)", async () => {
    const { data, error } = await eveClient
      .from('artisans')
      .select('*')
      .eq('id', publishedArtisanId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("le pending_consent d'alice est invisible à bob (AC3)", async () => {
    const { data, error } = await bobClient.from('artisans').select('*').eq('id', pendingArtisanId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('alice voit son propre pending_consent (AC3)', async () => {
    const { data, error } = await aliceClient
      .from('artisans')
      .select('*')
      .eq('id', pendingArtisanId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("bob ne peut PAS UPDATE l'artisan d'alice (RLS update_own → 0 ligne)", async () => {
    const { data, error } = await bobClient
      .from('artisans')
      .update({ display_name_fr: 'Détourné' })
      .eq('id', publishedArtisanId)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("alice ne peut PAS forger state='published' à l'INSERT (column-level GRANT → 42501)", async () => {
    const { error } = await aliceClient.from('artisans').insert({
      slug: `forge-${Date.now()}`,
      residence_id: DARNA_RESIDENCE_ID,
      display_name_fr: 'Forge State',
      phone_e164: '+212600000003',
      state: 'published',
      created_by: aliceId,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('bob peut noter (INSERT rating) un artisan published de sa résidence', async () => {
    const { error } = await bobClient.from('ratings').insert({
      artisan_id: publishedArtisanId,
      user_id: bobId,
      residence_id: DARNA_RESIDENCE_ID,
      score_depannage: 5,
      comment_text: 'Rapide et propre',
    });
    expect(error).toBeNull();
  });

  it('bob ne peut PAS INSERT un rating avec user_id ≠ auth.uid() (RLS with check → 42501)', async () => {
    const { error } = await bobClient.from('ratings').insert({
      artisan_id: publishedArtisanId,
      user_id: aliceId, // usurpation
      residence_id: DARNA_RESIDENCE_ID,
      score_depannage: 1, // score présent → l'échec vient bien de la RLS, pas du CHECK
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  // AC8 « ne peut pas écrire » côté write cross-résidence (lecture déjà couverte
  // plus haut). Ajout code review 2026-06-17, P3.
  it('eve (résidence 2) ne peut PAS créer un artisan dans la résidence 1 (AC8 — write cross-résidence → 42501)', async () => {
    const { error } = await eveClient.from('artisans').insert({
      slug: `eve-cross-${Date.now()}`,
      residence_id: DARNA_RESIDENCE_ID, // résidence d'alice, pas celle d'eve
      display_name_fr: 'Eve Cross Residence',
      phone_e164: '+212600000004',
      created_by: eveId,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('eve ne peut PAS noter un artisan de la résidence 1 (AC8 + P1 — cohérence artisan/résidence → 42501)', async () => {
    const { error } = await eveClient.from('ratings').insert({
      artisan_id: publishedArtisanId, // artisan d'alice, résidence 1
      user_id: eveId,
      residence_id: RESIDENCE_2_ID, // résidence d'eve → l'exists artisan/résidence échoue
      score_depannage: 3,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('tags est lisible publiquement (référentiel) mais pas inscriptible côté client', async () => {
    const { data, error } = await bobClient.from('tags').select('*');
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0); // seed de la migration
  });

  // Story 2.2 — vue artisan_rating_aggregates (security_invoker) : la RLS de
  // ratings s'applique au lecteur. L'agrégat existe grâce au rating anonymisé
  // seedé en beforeAll (review F39 — ne dépend plus de l'ordre des tests).
  it('bob (résidence 1) voit l’agrégat de notation de l’artisan publié', async () => {
    const { data, error } = await bobClient
      .from('artisan_rating_aggregates')
      .select('*')
      .eq('artisan_id', publishedArtisanId);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
    expect((data?.[0]?.n_total ?? 0) as number).toBeGreaterThan(0);
  });

  it('eve (résidence 2) ne voit PAS l’agrégat (security_invoker → RLS ratings cross-résidence)', async () => {
    const { data, error } = await eveClient
      .from('artisan_rating_aggregates')
      .select('*')
      .eq('artisan_id', publishedArtisanId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  // Story 2.6 — chemin d'écriture notation. Seed via admin (bypass RLS) pour être
  // robuste au `--shuffle` (ne dépend pas de l'ordre des tests).
  it('bob peut METTRE À JOUR sa propre note (ratings_resident_update_own)', async () => {
    await admin.from('ratings').upsert(
      {
        artisan_id: publishedArtisanId,
        user_id: bobId,
        residence_id: DARNA_RESIDENCE_ID,
        score_depannage: 3,
      },
      { onConflict: 'artisan_id,user_id' },
    );
    const { data, error } = await bobClient
      .from('ratings')
      .update({ score_depannage: 5 })
      .eq('artisan_id', publishedArtisanId)
      .eq('user_id', bobId)
      .select();
    expect(error).toBeNull();
    expect(data?.[0]?.score_depannage).toBe(5);
  });

  it('alice ne peut PAS modifier la note de bob (update-own → 0 ligne, note inchangée)', async () => {
    const { data: bobRating } = await admin
      .from('ratings')
      .upsert(
        {
          artisan_id: publishedArtisanId,
          user_id: bobId,
          residence_id: DARNA_RESIDENCE_ID,
          score_depannage: 4,
        },
        { onConflict: 'artisan_id,user_id' },
      )
      .select()
      .single();
    const { data, error } = await aliceClient
      .from('ratings')
      .update({ score_depannage: 1 })
      .eq('id', bobRating!.id)
      .select();
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0); // RLS filtre la ligne d'autrui
    const { data: after } = await admin
      .from('ratings')
      .select('score_depannage')
      .eq('id', bobRating!.id)
      .single();
    expect(after?.score_depannage).toBe(4);
  });

  it('une 2e note (artisan, user) viole unique → 23505 (justifie le select-then-branch)', async () => {
    await admin.from('ratings').upsert(
      {
        artisan_id: publishedArtisanId,
        user_id: bobId,
        residence_id: DARNA_RESIDENCE_ID,
        score_depannage: 3,
      },
      { onConflict: 'artisan_id,user_id' },
    );
    const { error } = await bobClient.from('ratings').insert({
      artisan_id: publishedArtisanId,
      user_id: bobId,
      residence_id: DARNA_RESIDENCE_ID,
      score_urgences: 2,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505');
  });

  it('INSERT sans aucun axe noté viole ratings_at_least_one_score_check (23514)', async () => {
    const ts = Date.now();
    const { data: fresh, error: freshErr } = await admin
      .from('artisans')
      .insert({
        slug: `noaxis-${ts}`,
        residence_id: DARNA_RESIDENCE_ID,
        display_name_fr: 'No Axis',
        phone_e164: `+2126${String(ts).slice(-8)}`,
        state: 'published',
        created_by: aliceId,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (freshErr || !fresh) throw freshErr ?? new Error('fresh artisan insert failed');
    const { error } = await bobClient.from('ratings').insert({
      artisan_id: fresh.id,
      user_id: bobId,
      residence_id: DARNA_RESIDENCE_ID,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });

  // ── Story 2.7 — édition & retrait (AC11) ──────────────────────────────────
  // Artisans frais seedés via admin (bypass RLS) pour ne pas perturber les autres
  // tests sous --shuffle. `seq` garantit slug/phone uniques.
  let seq = 0;
  async function freshPublishedArtisan(ownerId: string): Promise<string> {
    seq += 1;
    const uniq = `${Date.now()}${seq}`;
    const { data, error } = await admin
      .from('artisans')
      .insert({
        slug: `retract-${uniq}`,
        residence_id: DARNA_RESIDENCE_ID,
        display_name_fr: 'Retract Test',
        phone_e164: `+2127${uniq.slice(-8)}`,
        state: 'published',
        created_by: ownerId,
        published_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error || !data) throw error ?? new Error('fresh published artisan insert failed');
    return data.id;
  }

  it('alice (créatrice) peut éditer le non-PII de sa fiche (artisans_resident_update_own)', async () => {
    const id = await freshPublishedArtisan(aliceId);
    const { data, error } = await aliceClient
      .from('artisans')
      .update({ price_relative: '$$' })
      .eq('id', id)
      .select();
    expect(error).toBeNull();
    expect(data?.[0]?.price_relative).toBe('$$');
  });

  it('bob ne peut PAS éditer la fiche d’alice (RLS update-own → 0 ligne)', async () => {
    const id = await freshPublishedArtisan(aliceId);
    const { data, error } = await bobClient
      .from('artisans')
      .update({ price_relative: '$$$' })
      .eq('id', id)
      .select();
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it('retract_artisan par un non-contributeur → exception forbidden', async () => {
    const id = await freshPublishedArtisan(aliceId);
    const { error } = await bobClient.rpc('retract_artisan', { p_artisan_id: id });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/forbidden/);
  });

  it('retract_artisan par le contributeur → cascade soft-delete (0 rating actif)', async () => {
    const id = await freshPublishedArtisan(aliceId);
    await admin.from('ratings').insert({
      artisan_id: id,
      user_id: bobId,
      residence_id: DARNA_RESIDENCE_ID,
      score_depannage: 4,
    });
    const { error } = await aliceClient.rpc('retract_artisan', { p_artisan_id: id });
    expect(error).toBeNull();
    const { count } = await admin
      .from('ratings')
      .select('*', { count: 'exact', head: true })
      .eq('artisan_id', id)
      .is('deleted_at', null);
    expect(count).toBe(0);
    const { data: art } = await admin
      .from('artisans')
      .select('deleted_at, deletion_reason')
      .eq('id', id)
      .single();
    expect(art?.deleted_at).not.toBeNull();
    expect(art?.deletion_reason).toBe('author_retract');
  });

  it('retract_own_rating par l’auteur → soft-delete + user_id NULL', async () => {
    const id = await freshPublishedArtisan(aliceId);
    const { data: rating } = await admin
      .from('ratings')
      .insert({
        artisan_id: id,
        user_id: bobId,
        residence_id: DARNA_RESIDENCE_ID,
        score_depannage: 5,
      })
      .select()
      .single();
    const { error } = await bobClient.rpc('retract_own_rating', { p_rating_id: rating!.id });
    expect(error).toBeNull();
    const { data: after } = await admin
      .from('ratings')
      .select('deleted_at, user_id, deletion_reason')
      .eq('id', rating!.id)
      .single();
    expect(after?.deleted_at).not.toBeNull();
    expect(after?.user_id).toBeNull();
    expect(after?.deletion_reason).toBe('author_retract');
  });

  it('retract_own_rating sur la note d’autrui → exception forbidden', async () => {
    const id = await freshPublishedArtisan(aliceId);
    const { data: rating } = await admin
      .from('ratings')
      .insert({
        artisan_id: id,
        user_id: bobId,
        residence_id: DARNA_RESIDENCE_ID,
        score_depannage: 3,
      })
      .select()
      .single();
    const { error } = await aliceClient.rpc('retract_own_rating', { p_rating_id: rating!.id });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/forbidden/);
  });

  // ── Story 2.8 — artisan_responses & rectification_requests (AC11) ──────────
  async function makeComod(label: string): Promise<{ id: string; client: DarnaClient }> {
    const localEnv = parseSupabaseLocalEnv();
    const email = `${label}-${Date.now()}@test.darna.local`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: 'test-password-1234',
      email_confirm: true,
    });
    if (error || !created.user) throw error ?? new Error(`${label} create failed`);
    const id = created.user.id;
    await admin.auth.admin.updateUserById(id, {
      app_metadata: { role: 'co_mod', residence_id: DARNA_RESIDENCE_ID },
    });
    await admin
      .from('users')
      .update({ role: 'co_mod', residence_id: DARNA_RESIDENCE_ID })
      .eq('id', id);
    const client = createClient<Database>(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      { auth: { storageKey: `rls-resp-${label}`, persistSession: false } },
    );
    await establishSession(admin, client, email, label);
    return { id, client };
  }

  it('artisan_responses : alice (résidence) voit la réponse seedée ; eve (résidence 2) → 0', async () => {
    await admin.from('artisan_responses').insert({
      artisan_id: publishedArtisanId,
      residence_id: DARNA_RESIDENCE_ID,
      target_kind: 'listing',
      response_text: 'Merci pour vos retours.',
    });
    const { data: seen } = await aliceClient
      .from('artisan_responses')
      .select('id')
      .eq('artisan_id', publishedArtisanId);
    expect(seen?.length ?? 0).toBeGreaterThan(0);
    const { data: eveSeen } = await eveClient
      .from('artisan_responses')
      .select('id')
      .eq('artisan_id', publishedArtisanId);
    expect(eveSeen ?? []).toHaveLength(0);
  });

  it('artisan_responses : INSERT direct client → 42501 (écriture RPC-only)', async () => {
    const { error } = await aliceClient.from('artisan_responses').insert({
      artisan_id: publishedArtisanId,
      residence_id: DARNA_RESIDENCE_ID,
      target_kind: 'listing',
      response_text: 'Tentative directe',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('artisan_rectification_requests : résident → 0 ; co-mod résidence → visible', async () => {
    await admin.from('artisan_rectification_requests').insert({
      artisan_id: publishedArtisanId,
      residence_id: DARNA_RESIDENCE_ID,
      field_target: 'phone_e164',
      requested_value: '+212600000123',
      justification_text: 'Numéro changé',
    });
    const { data: aliceSees } = await aliceClient
      .from('artisan_rectification_requests')
      .select('id');
    expect(aliceSees ?? []).toHaveLength(0);

    const comod = await makeComod('carla');
    const { data: comodSees } = await comod.client
      .from('artisan_rectification_requests')
      .select('id')
      .eq('artisan_id', publishedArtisanId);
    expect(comodSees?.length ?? 0).toBeGreaterThan(0);
  });

  it('RPC process_artisan_response / request_artisan_contact_link non grantées à authenticated', async () => {
    const r1 = await aliceClient.rpc('process_artisan_response', {
      p_token_hash: 'x',
      p_kind: 'response',
      p_payload: { response_text: 'x', target_kind: 'listing' },
    });
    expect(r1.error).not.toBeNull();
    const r2 = await aliceClient.rpc('request_artisan_contact_link', {
      p_phone_e164: '+212600000001',
      p_token_hash: 'x',
      p_expires_at: new Date().toISOString(),
    });
    expect(r2.error).not.toBeNull();
  });

  it('moderation_log : action artisan_response_published lisible cross-résidence (FR33 transparence)', async () => {
    // Le review 2.7 hardening (20260626090000) a retiré artisan_response_published
    // de la liste restreinte de moderation_log_public_select : c'est une action
    // de modération publique (FR33 transparence radicale), comme l'admission.
    // Le test 2.8 initial l'avait classée privée par erreur — corrigé ici.
    await admin.from('moderation_log').insert({
      residence_id: DARNA_RESIDENCE_ID,
      actor_id: null,
      action: 'artisan_response_published',
      target_kind: 'artisan',
      target_id: publishedArtisanId,
    });
    const { data: eveSees, error } = await eveClient
      .from('moderation_log')
      .select('id')
      .eq('target_id', publishedArtisanId)
      .eq('action', 'artisan_response_published');
    expect(error).toBeNull();
    expect(eveSees?.length ?? 0).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 3.1 — RLS contenu durable (Epic 3) : guide_entries / useful_numbers /
// pack_entries. RLS asymétrique : résident LECTURE SEULE, co_mod CRUD résidence.
// Seeds : 1 résident + 1 co_mod (même résidence Darna), 1 co_mod (résidence 2),
// 1 guide_entry seedée. Cas : résident read-only KO en écriture, co_mod CRUD OK,
// cross-résidence KO, soft-delete masque la lecture résident.
// ─────────────────────────────────────────────────────────────────────────────
describe.skipIf(!RUN_LOCAL_RLS_TESTS)('RLS contenu durable (Epic 3)', () => {
  let admin: DarnaClient;
  let residentId: string;
  let comodId: string;
  let comodOtherId: string;
  let residentClient: DarnaClient;
  let comodClient: DarnaClient; // co_mod résidence Darna
  let comodOtherClient: DarnaClient; // co_mod résidence 2
  let seededEntryId: string;
  let seededNumberId: string;
  let seededPackEntryId: string;

  async function makeUser(
    localUrl: string,
    publishableKey: string,
    role: 'resident' | 'co_mod',
    label: string,
    residenceId: string,
  ): Promise<{ id: string; client: DarnaClient }> {
    const email = `${label}-${Date.now()}@test.darna.local`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: 'test-password-1234',
      email_confirm: true,
    });
    if (error || !created.user) throw error ?? new Error(`${label} create failed`);
    const id = created.user.id;

    await admin.auth.admin.updateUserById(id, {
      app_metadata: { role, residence_id: residenceId },
    });
    const { error: updateErr } = await admin
      .from('users')
      .update({ role, residence_id: residenceId })
      .eq('id', id);
    if (updateErr) throw new Error(`${label} users update failed: ${updateErr.message}`);

    const client = createClient<Database>(localUrl, publishableKey, {
      auth: { storageKey: `rls-durable-${label}`, persistSession: false },
    });
    await establishSession(admin, client, email, label);
    return { id, client };
  }

  beforeAll(async () => {
    const localEnv = parseSupabaseLocalEnv();
    admin = createClient<Database>(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_SERVICE_KEY,
    );

    await admin.from('residences').upsert({
      id: RESIDENCE_2_ID,
      name: 'Test Residence 2',
      slug: `test2-durable-${Date.now()}`,
      villa_count: 150,
    });

    const resident = await makeUser(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'resident',
      'dres',
      DARNA_RESIDENCE_ID,
    );
    residentId = resident.id;
    residentClient = resident.client;

    const comod = await makeUser(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'co_mod',
      'dcomod',
      DARNA_RESIDENCE_ID,
    );
    comodId = comod.id;
    comodClient = comod.client;

    const comodOther = await makeUser(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'co_mod',
      'dcomod2',
      RESIDENCE_2_ID,
    );
    comodOtherId = comodOther.id;
    comodOtherClient = comodOther.client;

    // Entrée Guide seedée (admin bypass RLS) dans la résidence Darna.
    const ts = Date.now();
    const { data: seeded, error: seedErr } = await admin
      .from('guide_entries')
      .insert({
        slug: `codes-portails-${ts}`,
        residence_id: DARNA_RESIDENCE_ID,
        theme_key: 'codes_portails',
        title_fr: 'Codes des portails',
        body_fr_markdown: 'Portail principal : **1234**.',
        order_in_theme: 0,
        created_by: comodId,
      })
      .select()
      .single();
    if (seedErr || !seeded) throw seedErr ?? new Error('seed guide_entry failed');
    seededEntryId = seeded.id;

    // Numéro utile seedé (Story 3.3) dans la résidence Darna.
    const { data: num, error: numErr } = await admin
      .from('useful_numbers')
      .insert({
        residence_id: DARNA_RESIDENCE_ID,
        category_key: 'securite',
        label_fr: 'Poste de garde',
        phone_e164: '+212600000010',
        order_in_category: 0,
        created_by: comodId,
      })
      .select()
      .single();
    if (numErr || !num) throw numErr ?? new Error('seed useful_number failed');
    seededNumberId = num.id;

    // Entrée Pack accueil seedée (Story 3.4) dans la résidence Darna.
    const { data: pack, error: packErr } = await admin
      .from('pack_entries')
      .insert({
        residence_id: DARNA_RESIDENCE_ID,
        section_key: 'cles_telecommandes',
        title_fr: 'Clés & télécommandes',
        body_fr_markdown: 'Retirez vos clés au poste de garde.',
        order_in_section: 0,
        created_by: comodId,
      })
      .select()
      .single();
    if (packErr || !pack) throw packErr ?? new Error('seed pack_entry failed');
    seededPackEntryId = pack.id;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin
      .from('guide_entries')
      .delete()
      .eq('residence_id', DARNA_RESIDENCE_ID)
      .eq('theme_key', 'codes_portails');
    await admin
      .from('guide_entries')
      .delete()
      .eq('residence_id', DARNA_RESIDENCE_ID)
      .eq('theme_key', 'horaires_gardien');
    await admin.from('guide_entries').delete().eq('residence_id', RESIDENCE_2_ID);
    await admin.from('useful_numbers').delete().eq('residence_id', DARNA_RESIDENCE_ID);
    await admin.from('useful_numbers').delete().eq('residence_id', RESIDENCE_2_ID);
    await admin.from('pack_entries').delete().eq('residence_id', DARNA_RESIDENCE_ID);
    await admin.from('pack_entries').delete().eq('residence_id', RESIDENCE_2_ID);
    for (const id of [residentId, comodId, comodOtherId]) {
      if (id) await admin.auth.admin.deleteUser(id);
    }
    await admin.from('residences').delete().eq('id', RESIDENCE_2_ID);
  });

  it("(a) résident SELECT voit l'entrée non supprimée de sa résidence", async () => {
    const { data, error } = await residentClient
      .from('guide_entries')
      .select('*')
      .eq('id', seededEntryId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('(b) résident INSERT guide_entries → 42501 (lecture seule, aucune policy écriture)', async () => {
    const { error } = await residentClient.from('guide_entries').insert({
      slug: `hack-${Date.now()}`,
      residence_id: DARNA_RESIDENCE_ID,
      theme_key: 'autre',
      title_fr: 'Hack',
      body_fr_markdown: 'x',
      created_by: residentId,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('(c) résident UPDATE deleted_at → no-op (aucune policy UPDATE résident, entrée intacte)', async () => {
    const { data } = await residentClient
      .from('guide_entries')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', seededEntryId)
      .select();
    // Aucune policy UPDATE pour le résident → 0 ligne mutée.
    expect(data ?? []).toHaveLength(0);
    // L'entrée reste visible (non soft-deletée).
    const { data: still } = await residentClient
      .from('guide_entries')
      .select('id')
      .eq('id', seededEntryId);
    expect(still).toHaveLength(1);
  });

  it('(d) co_mod même résidence INSERT puis UPDATE OK', async () => {
    const slug = `horaires-gardien-${Date.now()}`;
    // P10 (review 3.1) : `created_by` non grantable côté client, posé via DEFAULT
    // auth.uid(). On ne le passe plus à l'INSERT.
    const { data: inserted, error: insErr } = await comodClient
      .from('guide_entries')
      .insert({
        slug,
        residence_id: DARNA_RESIDENCE_ID,
        theme_key: 'horaires_gardien',
        title_fr: 'Horaires du gardien',
        body_fr_markdown: 'Présent 8h-20h.',
      })
      .select()
      .single();
    expect(insErr).toBeNull();
    expect(inserted?.id).toBeTruthy();
    expect(inserted?.created_by).toBe(comodId);

    const { data: updated, error: updErr } = await comodClient
      .from('guide_entries')
      .update({ title_fr: 'Horaires du gardien (MAJ)' })
      .eq('id', inserted!.id)
      .select()
      .single();
    expect(updErr).toBeNull();
    expect(updated?.title_fr).toBe('Horaires du gardien (MAJ)');
  });

  it('(e) co_mod autre résidence ne peut PAS UPDATE une entrée de Darna (cross-résidence → 0 ligne)', async () => {
    const { data } = await comodOtherClient
      .from('guide_entries')
      .update({ title_fr: 'pirate' })
      .eq('id', seededEntryId)
      .select();
    expect(data ?? []).toHaveLength(0);
  });

  it("(g) RPC search_guide_entries (résident) trouve l'entrée de sa résidence", async () => {
    const { data, error } = await residentClient.rpc('search_guide_entries', {
      p_query: 'portail',
      p_locale: 'fr',
    });
    expect(error).toBeNull();
    expect((data ?? []).some((r) => r.slug.startsWith('codes-portails-'))).toBe(true);
  });

  it("(h) RPC search_guide_entries (autre résidence) ne fuit PAS l'entrée (security invoker)", async () => {
    const { data, error } = await comodOtherClient.rpc('search_guide_entries', {
      p_query: 'portail',
      p_locale: 'fr',
    });
    expect(error).toBeNull();
    expect((data ?? []).some((r) => r.slug.startsWith('codes-portails-'))).toBe(false);
  });

  it("(f) co_mod soft-delete → l'entrée disparaît de la lecture résident", async () => {
    const { error: delErr } = await comodClient
      .from('guide_entries')
      .update({ deleted_at: new Date().toISOString(), deleted_by: comodId })
      .eq('id', seededEntryId);
    expect(delErr).toBeNull();

    const { data: residentSees } = await residentClient
      .from('guide_entries')
      .select('id')
      .eq('id', seededEntryId);
    expect(residentSees ?? []).toHaveLength(0);

    // Le co_mod, lui, voit toujours la ligne soft-deletée (restauration 3.5).
    const { data: comodSees } = await comodClient
      .from('guide_entries')
      .select('id, deleted_at')
      .eq('id', seededEntryId);
    expect(comodSees).toHaveLength(1);
    expect(comodSees?.[0]?.deleted_at).not.toBeNull();
  });

  it('(i) useful_numbers : résident voit sa résidence, autre résidence ne fuit pas (3.3)', async () => {
    const { data: residentSees, error } = await residentClient
      .from('useful_numbers')
      .select('id, phone_e164')
      .eq('id', seededNumberId);
    expect(error).toBeNull();
    expect(residentSees).toHaveLength(1);

    const { data: otherSees } = await comodOtherClient
      .from('useful_numbers')
      .select('id')
      .eq('id', seededNumberId);
    expect(otherSees ?? []).toHaveLength(0);
  });

  it('(j) onboarding : résident pose first_login_at sur SA ligne, pas sur autrui (3.4)', async () => {
    const now = new Date().toISOString();
    // Sur sa propre ligne : OK (grant self + users_resident_update_self).
    const { data: self, error: selfErr } = await residentClient
      .from('users')
      .update({ first_login_at: now })
      .eq('id', residentId)
      .select('id');
    expect(selfErr).toBeNull();
    expect(self).toHaveLength(1);

    // Sur la ligne d'autrui (le co_mod) : 0 ligne (RLS id=auth.uid()).
    const { data: other } = await residentClient
      .from('users')
      .update({ first_login_at: now })
      .eq('id', comodId)
      .select('id');
    expect(other ?? []).toHaveLength(0);
  });

  // ── Story 3.1 review (P6) — pack_entries : symétrie guide_entries ────────────
  it('(k) pack_entries : résident voit sa résidence ; co_mod autre résidence ne voit pas', async () => {
    const { data: residentSees, error } = await residentClient
      .from('pack_entries')
      .select('id')
      .eq('id', seededPackEntryId);
    expect(error).toBeNull();
    expect(residentSees).toHaveLength(1);

    const { data: otherSees } = await comodOtherClient
      .from('pack_entries')
      .select('id')
      .eq('id', seededPackEntryId);
    expect(otherSees ?? []).toHaveLength(0);
  });

  it('(l) résident INSERT pack_entries → 42501 (aucune policy écriture)', async () => {
    const { error } = await residentClient.from('pack_entries').insert({
      residence_id: DARNA_RESIDENCE_ID,
      section_key: 'hack',
      title_fr: 'Hack',
      body_fr_markdown: 'x',
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  it('(m) co_mod même résidence INSERT puis UPDATE pack_entries OK (P10 created_by default)', async () => {
    const ts = Date.now();
    const { data: inserted, error: insErr } = await comodClient
      .from('pack_entries')
      .insert({
        residence_id: DARNA_RESIDENCE_ID,
        section_key: `wifi-${ts}`,
        title_fr: 'Wifi',
        body_fr_markdown: 'SSID : Darna',
        order_in_section: 1,
      })
      .select('id, created_by')
      .single();
    expect(insErr).toBeNull();
    // P10 : `created_by` posé automatiquement par le DEFAULT auth.uid().
    expect(inserted?.created_by).toBe(comodId);

    const { data: updated, error: updErr } = await comodClient
      .from('pack_entries')
      .update({ title_fr: 'Wifi (MAJ)' })
      .eq('id', inserted!.id)
      .select('title_fr')
      .single();
    expect(updErr).toBeNull();
    expect(updated?.title_fr).toBe('Wifi (MAJ)');
  });

  // ── Story 3.1 review (P7) — cross-résidence INSERT par co_mod ────────────────
  it('(n) co_mod résidence 2 ne peut PAS INSERT useful_numbers dans la résidence 1 (P7)', async () => {
    const { error } = await comodOtherClient.from('useful_numbers').insert({
      residence_id: DARNA_RESIDENCE_ID,
      category_key: 'securite',
      label_fr: 'Spoof',
      phone_e164: '+212600000099',
      order_in_category: 9,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('42501');
  });

  // ── Story 3.1 review (P2) — CHECK phone_e164 format E.164 ────────────────────
  it('(o) useful_numbers refuse phone_e164 non-E.164 (CHECK violation 23514)', async () => {
    const { error } = await comodClient.from('useful_numbers').insert({
      residence_id: DARNA_RESIDENCE_ID,
      category_key: 'securite',
      label_fr: 'Bad phone',
      phone_e164: '0600000000', // pas de + prefix → CHECK fail
      order_in_category: 2,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23514');
  });

  // ── Story 3.1 review (P9) — UNIQUE partial (residence_id, phone_e164) ────────
  it('(p) useful_numbers refuse doublon (residence_id, phone_e164) actif (P9 unique 23505)', async () => {
    const { error } = await comodClient.from('useful_numbers').insert({
      residence_id: DARNA_RESIDENCE_ID,
      category_key: 'securite',
      label_fr: 'Doublon poste de garde',
      phone_e164: '+212600000010', // = seededNumberId
      order_in_category: 3,
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505');
  });

  // ── Story 3.1 review (P1) — trigger force deleted_by = auth.uid() ────────────
  it('(q) trigger enforce_deleted_by_actor force deleted_by = auth.uid() (audit non-falsifiable)', async () => {
    const ts = Date.now();
    // Crée un useful_number éphémère via le co_mod Darna.
    const { data: tmp, error: insErr } = await comodClient
      .from('useful_numbers')
      .insert({
        residence_id: DARNA_RESIDENCE_ID,
        category_key: 'autre',
        label_fr: 'Éphémère',
        phone_e164: `+21260000${String(ts).slice(-4)}`,
        order_in_category: 5,
      })
      .select('id')
      .single();
    expect(insErr).toBeNull();

    // Le co_mod soft-delete en essayant d'attribuer à autrui (residentId) :
    // le trigger doit réécrire deleted_by = comodId (auth.uid()).
    const { error: delErr } = await comodClient
      .from('useful_numbers')
      .update({ deleted_at: new Date().toISOString(), deleted_by: residentId })
      .eq('id', tmp!.id);
    expect(delErr).toBeNull();

    const { data: after } = await admin
      .from('useful_numbers')
      .select('deleted_by, deleted_at')
      .eq('id', tmp!.id)
      .single();
    expect(after?.deleted_at).not.toBeNull();
    expect(after?.deleted_by).toBe(comodId); // trigger a écrasé residentId
  });

  // ── Story 3.5 — RPC retire_durable_entry (SECURITY DEFINER) ──────────────────
  it('(r) co_mod retire via RPC → soft-delete + moderation_log content_removed', async () => {
    const ts = Date.now();
    const { data: seeded, error: seedErr } = await admin
      .from('guide_entries')
      .insert({
        slug: `traditions-${ts}`,
        residence_id: DARNA_RESIDENCE_ID,
        theme_key: 'traditions',
        title_fr: 'À retirer',
        body_fr_markdown: 'corps',
        order_in_theme: 50,
        created_by: comodId,
      })
      .select()
      .single();
    if (seedErr || !seeded) throw seedErr ?? new Error('seed retire failed');

    const { error: rpcErr } = await comodClient.rpc('retire_durable_entry', {
      p_kind: 'guide_entry',
      p_id: seeded.id,
      p_reason: 'test_retrait',
    });
    expect(rpcErr).toBeNull();

    const { data: row } = await admin
      .from('guide_entries')
      .select('deleted_at, deleted_by')
      .eq('id', seeded.id)
      .single();
    expect(row?.deleted_at).not.toBeNull();
    expect(row?.deleted_by).toBe(comodId);

    const { data: logs } = await admin
      .from('moderation_log')
      .select('action, target_kind, target_id, actor_id')
      .eq('target_id', seeded.id)
      .eq('action', 'content_removed');
    expect((logs ?? []).length).toBe(1);
    expect(logs?.[0]?.target_kind).toBe('guide_entry');

    // Le résident ne voit plus l'entrée retirée.
    const { data: residentSees } = await residentClient
      .from('guide_entries')
      .select('id')
      .eq('id', seeded.id);
    expect(residentSees ?? []).toHaveLength(0);

    // Cleanup local (ne pas laisser de moderation_log/entry derrière).
    await admin.from('moderation_log').delete().eq('target_id', seeded.id);
    await admin.from('guide_entries').delete().eq('id', seeded.id);
  });

  it('(s) RPC retire_durable_entry appelé par un résident → exception not_co_mod (re-check interne)', async () => {
    const { error } = await residentClient.rpc('retire_durable_entry', {
      p_kind: 'guide_entry',
      p_id: seededNumberId, // un uuid quelconque ; le re-check rôle échoue avant le lookup
      p_reason: 'x',
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('not_co_mod');
  });
});
