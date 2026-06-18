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
    await admin
      .from('residences')
      .upsert({
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

    await admin
      .from('residences')
      .upsert({
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
});
