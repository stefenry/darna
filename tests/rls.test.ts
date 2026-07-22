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

  it('transparence FR33 : lecture publique via la vue ; table brute moderation_log fermée au client (review Epic 5)', async () => {
    // La VUE de redaction moderation_log_public est l'UNIQUE chemin de lecture
    // publique (anti-contournement : actor_id / reason_text_anonymized /
    // report_opened). Elle reste interrogeable sans erreur.
    const { error: pubErr } = await eveClient
      .from('moderation_log_public')
      .select('action')
      .limit(1);
    expect(pubErr).toBeNull();

    // La table BRUTE n'est plus lisible directement côté client (grant révoqué).
    const { data: raw } = await eveClient.from('moderation_log').select('*');
    expect(raw ?? []).toHaveLength(0);
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

  it('moderation_log : artisan_response_published n’est PAS public (vue l’exclut + table brute fermée — review Epic 5)', async () => {
    // artisan_response_published est une action de cycle de vie artisan (2.8), pas
    // une décision de gouvernance : la vue moderation_log_public l'exclut et
    // JOURNAL_ACTIONS (5.4) ne la liste pas → absente de /transparence. Le verrou
    // review Epic 5 ferme en plus la table brute (la vue est la source unique).
    await admin.from('moderation_log').insert({
      residence_id: DARNA_RESIDENCE_ID,
      actor_id: null,
      action: 'artisan_response_published',
      target_kind: 'artisan',
      target_id: publishedArtisanId,
    });
    // Exclue de la vue publique (y compris pour un co_mod d'une autre résidence).
    const { data: viaView, error: viewErr } = await eveClient
      .from('moderation_log_public')
      .select('id')
      .eq('target_id', publishedArtisanId)
      .eq('action', 'artisan_response_published');
    expect(viewErr).toBeNull();
    expect(viaView ?? []).toHaveLength(0);
    // Table brute fermée au client (grant révoqué).
    const { data: viaRaw } = await eveClient
      .from('moderation_log')
      .select('id')
      .eq('target_id', publishedArtisanId)
      .eq('action', 'artisan_response_published');
    expect(viaRaw ?? []).toHaveLength(0);
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

  // Review 3.2 P15 — RPC rejette une locale invalide (whitelist `fr`/`ar`).
  it('(h1) RPC search_guide_entries refuse p_locale invalide (invalid_locale)', async () => {
    const { error } = await residentClient.rpc('search_guide_entries', {
      p_query: 'portail',
      p_locale: 'zz',
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/invalid_locale/);
  });

  // Review 3.2 P17 — colonne générée `ar_complete` cohérente avec FR48 :
  // un seed FR-only doit ressortir avec ar_complete=false.
  it('(h2) guide_entries.ar_complete = false sur seed FR-only (FR48)', async () => {
    const { data } = await residentClient
      .from('guide_entries')
      .select('ar_complete')
      .eq('id', seededEntryId)
      .single();
    expect(data?.ar_complete).toBe(false);
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

// Story 4.1 (AC additionnel) — RLS contenu éphémère : auteur résident (INSERT/
// UPDATE/retrait de ses propres alertes/bons plans), lecture active non expirée,
// expiration filtrée, isolation cross-résidence, audit moderation_log par trigger,
// RPC retract_own_ephemeral (garde created_by). alice = auteur, dora = autre
// résident même résidence, eve = co_mod résidence 2.
describe.skipIf(!RUN_LOCAL_RLS_TESTS)('RLS contenu éphémère (Epic 4)', () => {
  let admin: DarnaClient;
  let aliceId: string;
  let aliceClient: DarnaClient; // résident auteur (Darna)
  let doraClient: DarnaClient; // autre résident (Darna), non-auteur
  let eveClient: DarnaClient; // co_mod résidence 2
  let activeAlertId: string;
  let aliceTipId: string;

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
    const { error: updErr } = await admin
      .from('users')
      .update({ role, residence_id: residenceId })
      .eq('id', id);
    if (updErr) throw new Error(`${label} users update failed: ${updErr.message}`);
    const client = createClient<Database>(localUrl, publishableKey, {
      auth: { storageKey: `rls-eph-${label}`, persistSession: false },
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
      slug: `test2-eph-${Date.now()}`,
      villa_count: 150,
    });

    const alice = await makeUser(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'resident',
      'ephalice',
      DARNA_RESIDENCE_ID,
    );
    aliceId = alice.id;
    aliceClient = alice.client;

    const dora = await makeUser(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'resident',
      'ephdora',
      DARNA_RESIDENCE_ID,
    );
    doraClient = dora.client;

    const eve = await makeUser(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'co_mod',
      'epheve',
      RESIDENCE_2_ID,
    );
    eveClient = eve.client;

    const ts = Date.now();
    // Alerte ACTIVE (Darna), créée par alice.
    const { data: active, error: aErr } = await admin
      .from('alerts')
      .insert({
        slug: `coupure-eau-${ts}`,
        residence_id: DARNA_RESIDENCE_ID,
        title_fr: "Coupure d'eau",
        body_fr: 'Demain matin.',
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        created_by: aliceId,
      })
      .select()
      .single();
    if (aErr || !active) throw aErr ?? new Error('seed active alert failed');
    activeAlertId = active.id;

    // Alerte EXPIRÉE (créée 2j avant, TTL 1j → expirée mais expires_at > created_at).
    const { error: eErr } = await admin.from('alerts').insert({
      slug: `vieille-alerte-${ts}`,
      residence_id: DARNA_RESIDENCE_ID,
      title_fr: 'Vieille alerte',
      body_fr: 'Périmée.',
      created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      expires_at: new Date(Date.now() - 86_400_000).toISOString(),
      created_by: aliceId,
    });
    if (eErr) throw eErr;

    // Bon plan d'alice (Darna), pour le retrait via RPC.
    const { data: tip, error: tErr } = await admin
      .from('tips')
      .insert({
        slug: `perceuse-${ts}`,
        residence_id: DARNA_RESIDENCE_ID,
        category_key: 'pret_objet',
        title_fr: 'Perceuse à prêter',
        body_fr: 'Le week-end.',
        expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        created_by: aliceId,
      })
      .select()
      .single();
    if (tErr || !tip) throw tErr ?? new Error('seed tip failed');
    aliceTipId = tip.id;
  });

  afterAll(async () => {
    if (admin) {
      await admin
        .from('alerts')
        .delete()
        .eq('residence_id', DARNA_RESIDENCE_ID)
        .eq('created_by', aliceId);
      await admin
        .from('tips')
        .delete()
        .eq('residence_id', DARNA_RESIDENCE_ID)
        .eq('created_by', aliceId);
    }
  });

  it('(a) résident voit une alerte active de sa résidence', async () => {
    const { data, error } = await doraClient.from('alerts').select('id').eq('id', activeAlertId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('(b) résident NE voit PAS une alerte expirée (expires_at < now, feed filtré)', async () => {
    const { data } = await doraClient
      .from('alerts')
      .select('id, expires_at')
      .lt('expires_at', new Date().toISOString());
    expect(data ?? []).toHaveLength(0);
  });

  it('(c) résident AUTEUR insère sa propre alerte (created_by = self au défaut)', async () => {
    const { data, error } = await aliceClient
      .from('alerts')
      .insert({
        slug: `mon-alerte-${Date.now()}`,
        residence_id: DARNA_RESIDENCE_ID,
        title_fr: 'Mon alerte',
        body_fr: 'Contenu.',
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select('id, created_by')
      .single();
    expect(error).toBeNull();
    expect(data?.created_by).toBe(aliceId);
  });

  it('(d) résident NE peut PAS insérer dans une autre résidence (RLS with check)', async () => {
    const { error } = await aliceClient.from('alerts').insert({
      slug: `cross-${Date.now()}`,
      residence_id: RESIDENCE_2_ID,
      title_fr: 'X',
      body_fr: 'Y',
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it('(e) co_mod résidence 2 ne voit PAS les alertes de la résidence 1 (isolation)', async () => {
    const { data } = await eveClient.from('alerts').select('id').eq('id', activeAlertId);
    expect(data ?? []).toHaveLength(0);
  });

  it('(f) CHECK expiration : refuse expires_at > 31j (tips) → 23514', async () => {
    const { error } = await aliceClient.from('tips').insert({
      slug: `trop-loin-${Date.now()}`,
      residence_id: DARNA_RESIDENCE_ID,
      category_key: 'autre',
      title_fr: 'Trop loin',
      body_fr: 'X',
      expires_at: new Date(Date.now() + 60 * 86_400_000).toISOString(),
    });
    expect(error?.code).toBe('23514');
  });

  it('(g) trigger log_ephemeral_created → moderation_log alert_created', async () => {
    const { data } = await admin
      .from('moderation_log')
      .select('action, actor_id')
      .eq('target_id', activeAlertId)
      .eq('action', 'alert_created');
    expect((data ?? []).length).toBeGreaterThanOrEqual(1);
    expect(data?.[0]?.actor_id).toBe(aliceId);
  });

  it('(h) RPC retract_own_ephemeral : l’auteur retire son bon plan', async () => {
    const { error } = await aliceClient.rpc('retract_own_ephemeral', {
      p_kind: 'tip',
      p_id: aliceTipId,
      p_reason: 'plus disponible',
    });
    expect(error).toBeNull();
    const { data } = await admin
      .from('tips')
      .select('deleted_at, deleted_by')
      .eq('id', aliceTipId)
      .single();
    expect(data?.deleted_at).not.toBeNull();
    expect(data?.deleted_by).toBe(aliceId);
    const { data: ml } = await admin
      .from('moderation_log')
      .select('action')
      .eq('target_id', aliceTipId)
      .eq('action', 'tip_self_retracted');
    expect((ml ?? []).length).toBe(1);
  });

  it('(i) RPC retract_own_ephemeral : un non-auteur → exception forbidden', async () => {
    const { error } = await doraClient.rpc('retract_own_ephemeral', {
      p_kind: 'alert',
      p_id: activeAlertId,
      p_reason: 'x',
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain('forbidden');
  });

  it('(j) alert_templates : résident SELECT OK, INSERT refusé (42501)', async () => {
    const { data, error } = await aliceClient.from('alert_templates').select('template_key');
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThanOrEqual(7);
    const { error: insErr } = await aliceClient.from('alert_templates').insert({
      template_key: `forge_${Date.now()}`,
      icon: 'X',
      label_fr: 'Forge',
    });
    expect(insErr?.code).toBe('42501');
  });

  it("(k) review #2 : l'auteur ne peut NI restaurer NI éditer une alerte retirée par modération", async () => {
    // Alerte d'alice retirée (deleted_at posé — simule moderate_remove_content 5.3).
    const { data: seeded, error: seedErr } = await admin
      .from('alerts')
      .insert({
        slug: `retiree-mod-${Date.now()}`,
        residence_id: DARNA_RESIDENCE_ID,
        title_fr: 'Retirée par mod',
        body_fr: 'X',
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        created_by: aliceId,
        deleted_at: new Date().toISOString(),
        deletion_reason: 'moderation',
      })
      .select('id')
      .single();
    if (seedErr || !seeded) throw seedErr ?? new Error('seed removed alert failed');

    // Restauration directe (deleted_at = null) → colonne non grantée à l'auteur.
    const { error: restoreErr } = await aliceClient
      .from('alerts')
      .update({ deleted_at: null })
      .eq('id', seeded.id);
    expect(restoreErr?.code).toBe('42501');

    // Édition d'une ligne retirée → 0 ligne (policy author_update USING deleted_at is null).
    const { data: edited } = await aliceClient
      .from('alerts')
      .update({ title_fr: 'Hack' })
      .eq('id', seeded.id)
      .select('id');
    expect(edited ?? []).toHaveLength(0);

    // La ligne reste retirée.
    const { data: after } = await admin
      .from('alerts')
      .select('deleted_at')
      .eq('id', seeded.id)
      .single();
    expect(after?.deleted_at).not.toBeNull();
  });

  it("(l) review mineur : l'auto-retrait est audité mais MASQUÉ de la vue publique", async () => {
    // aliceTipId a été auto-retiré en (h) → trace tip_self_retracted en audit.
    const { data: audit } = await admin
      .from('moderation_log')
      .select('action')
      .eq('target_id', aliceTipId)
      .eq('action', 'tip_self_retracted');
    expect((audit ?? []).length).toBe(1);

    // …mais la vue publique /transparence ne l'expose pas (geste auteur ≠ modération).
    const anon = createClient<Database>(
      parseSupabaseLocalEnv().SUPABASE_LOCAL_URL,
      parseSupabaseLocalEnv().SUPABASE_LOCAL_PUBLISHABLE_KEY,
      { auth: { storageKey: 'rls-eph-anon', persistSession: false } },
    );
    const { data: pub, error } = await anon
      .from('moderation_log_public')
      .select('action')
      .eq('target_id', aliceTipId);
    expect(error).toBeNull();
    expect((pub ?? []).every((r) => r.action !== 'tip_self_retracted')).toBe(true);
  });

  it('(m) 6.2 increment_share_count : résident de la résidence incrémente son alerte', async () => {
    const { data: before } = await admin
      .from('alerts')
      .select('share_count')
      .eq('id', activeAlertId)
      .single();
    const { error } = await aliceClient.rpc('increment_share_count', {
      p_kind: 'alert',
      p_id: activeAlertId,
    });
    expect(error).toBeNull();
    const { data: after } = await admin
      .from('alerts')
      .select('share_count')
      .eq('id', activeAlertId)
      .single();
    expect(after?.share_count).toBe((before?.share_count ?? 0) + 1);
  });

  it('(n) 6.2 increment_share_count : borné résidence — co_mod d’une AUTRE résidence = no-op', async () => {
    const { data: before } = await admin
      .from('alerts')
      .select('share_count')
      .eq('id', activeAlertId)
      .single();
    // eve est co_mod de la résidence 2 ; l'alerte vit en résidence 1.
    const { error } = await eveClient.rpc('increment_share_count', {
      p_kind: 'alert',
      p_id: activeAlertId,
    });
    expect(error).toBeNull(); // RPC réussit mais 0 ligne ne matche (residence guard).
    const { data: after } = await admin
      .from('alerts')
      .select('share_count')
      .eq('id', activeAlertId)
      .single();
    expect(after?.share_count).toBe(before?.share_count ?? 0);
  });

  it('(o) 6.4 réaction 👍 : le résident insère la sienne, vue agrégée = 1', async () => {
    const { error } = await aliceClient
      .from('reactions')
      .insert({ target_type: 'alert', target_id: activeAlertId });
    expect(error).toBeNull();
    // L'auteur voit sa propre réaction (select_own).
    const { data: own } = await aliceClient
      .from('reactions')
      .select('id, user_id')
      .eq('target_type', 'alert')
      .eq('target_id', activeAlertId);
    expect((own ?? []).length).toBe(1);
    expect(own?.[0]?.user_id).toBe(aliceId);
    // Compte agrégé public (sans révéler qui).
    const { data: c } = await aliceClient
      .from('reaction_counts')
      .select('count')
      .eq('target_type', 'alert')
      .eq('target_id', activeAlertId)
      .maybeSingle();
    expect(c?.count).toBe(1);
  });

  it('(p) 6.4 privacy : un autre résident NE voit PAS la ligne d’autrui, mais voit le compte', async () => {
    const { data: rows } = await doraClient
      .from('reactions')
      .select('id')
      .eq('target_type', 'alert')
      .eq('target_id', activeAlertId);
    expect((rows ?? []).length).toBe(0); // select_own → aucune ligne d'alice.
    const { data: c } = await doraClient
      .from('reaction_counts')
      .select('count')
      .eq('target_type', 'alert')
      .eq('target_id', activeAlertId)
      .maybeSingle();
    expect(c?.count).toBe(1); // mais le compte agrégé est visible.
  });

  it('(q) 6.4 toggle off : le résident retire sa réaction → compte 0', async () => {
    const { error } = await aliceClient
      .from('reactions')
      .delete()
      .eq('target_type', 'alert')
      .eq('target_id', activeAlertId);
    expect(error).toBeNull();
    const { data: c } = await aliceClient
      .from('reaction_counts')
      .select('count')
      .eq('target_type', 'alert')
      .eq('target_id', activeAlertId)
      .maybeSingle();
    expect(c ?? null).toBeNull(); // plus aucune ligne agrégée.
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 5.1 — RLS modération réactive & transparence (Epic 5).
//   Tables : reports (signalement résident → co_mod) + vue moderation_log_public.
//   RLS asymétrique : résident INSERT/SELECT own (jamais cross), co_mod
//   SELECT/UPDATE résidence. Idempotence open report (index UNIQUE partiel).
//   Vue publique : masque report_opened + acteurs non-co_mod + cibles user_deleted.
// ─────────────────────────────────────────────────────────────────────────────
describe.skipIf(!RUN_LOCAL_RLS_TESTS)('RLS modération & transparence (Epic 5)', () => {
  let admin: DarnaClient;
  let reporterId: string;
  let otherResidentId: string;
  let comodId: string;
  let comodOtherId: string;
  let reporterClient: DarnaClient; // résident Darna (auteur du signalement)
  let otherResidentClient: DarnaClient; // résident Darna (tiers)
  let comodClient: DarnaClient; // co_mod Darna
  let comodOtherClient: DarnaClient; // co_mod résidence 2
  // Cible polymorphe : reports.target_id n'a pas de FK (couple target_type +
  // target_id) → un uuid arbitraire suffit, ça découple le test du schéma artisans.
  const targetId = crypto.randomUUID();

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
      .update({ role, residence_id: residenceId, display_name: label })
      .eq('id', id);
    if (updateErr) throw new Error(`${label} users update failed: ${updateErr.message}`);
    const client = createClient<Database>(localUrl, publishableKey, {
      auth: { storageKey: `rls-reports-${label}`, persistSession: false },
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
      slug: `test2-reports-${Date.now()}`,
      villa_count: 150,
    });

    const reporter = await makeUser(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'resident',
      'rrep',
      DARNA_RESIDENCE_ID,
    );
    reporterId = reporter.id;
    reporterClient = reporter.client;

    const other = await makeUser(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'resident',
      'rother',
      DARNA_RESIDENCE_ID,
    );
    otherResidentId = other.id;
    otherResidentClient = other.client;

    const comod = await makeUser(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'co_mod',
      'rcomod',
      DARNA_RESIDENCE_ID,
    );
    comodId = comod.id;
    comodClient = comod.client;

    const comodOther = await makeUser(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'co_mod',
      'rcomod2',
      RESIDENCE_2_ID,
    );
    comodOtherId = comodOther.id;
    comodOtherClient = comodOther.client;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from('reports').delete().eq('target_id', targetId);
    await admin.from('moderation_log').delete().eq('target_id', targetId);
    for (const id of [reporterId, otherResidentId, comodId, comodOtherId]) {
      if (id) await admin.auth.admin.deleteUser(id);
    }
  });

  it('(a) résident INSERT son propre signalement (reporter_id default auth.uid())', async () => {
    const { data, error } = await reporterClient
      .from('reports')
      .insert({
        residence_id: DARNA_RESIDENCE_ID,
        target_type: 'artisan',
        target_id: targetId,
        reason: 'info_erronee',
        note_text: 'Le numéro ne répond plus.',
      })
      .select('id, reporter_id, state')
      .single();
    expect(error).toBeNull();
    expect(data?.reporter_id).toBe(reporterId);
    expect(data?.state).toBe('open');
  });

  it('(b) INSERT déclenche le trigger audit report_opened (payload no-PII, sans note_text)', async () => {
    const { data: ml } = await admin
      .from('moderation_log')
      .select('action, actor_id, payload_json, reason_code')
      .eq('target_id', targetId)
      .eq('action', 'report_opened');
    expect((ml ?? []).length).toBeGreaterThanOrEqual(1);
    const row = ml?.[0];
    expect(row?.reason_code).toBe('info_erronee');
    expect(JSON.stringify(row?.payload_json)).not.toContain('répond plus');
  });

  it('(c) résident relit SON signalement ; le tiers ne le voit PAS (RLS own-only)', async () => {
    const mine = await reporterClient.from('reports').select('id');
    expect(mine.error).toBeNull();
    expect((mine.data ?? []).length).toBe(1);

    const theirs = await otherResidentClient.from('reports').select('id');
    expect(theirs.error).toBeNull();
    expect((theirs.data ?? []).length).toBe(0);
  });

  it('(d) idempotence : 2e signalement ouvert même (reporter, cible) → 23505', async () => {
    const { error } = await reporterClient.from('reports').insert({
      residence_id: DARNA_RESIDENCE_ID,
      target_type: 'artisan',
      target_id: targetId,
      reason: 'spam',
    });
    expect(error?.code).toBe('23505');
  });

  it('(e) co_mod Darna voit le signalement de sa résidence', async () => {
    const { data, error } = await comodClient
      .from('reports')
      .select('id, reporter_id')
      .eq('target_id', targetId);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(1);
    expect(data?.[0]?.reporter_id).toBe(reporterId);
  });

  it('(f) co_mod résidence 2 ne voit PAS le signalement de Darna (isolation)', async () => {
    const { data, error } = await comodOtherClient
      .from('reports')
      .select('id')
      .eq('target_id', targetId);
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(0);
  });

  it('(g) résident ne peut PAS UPDATE un signalement (aucune policy UPDATE résident → 0 ligne)', async () => {
    const { data: rows } = await reporterClient.from('reports').select('id').limit(1);
    const reportId = rows?.[0]?.id;
    expect(reportId).toBeTruthy();
    const { data, error } = await reporterClient
      .from('reports')
      .update({ state: 'closed_kept' })
      .eq('id', reportId!)
      .select('id');
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(0); // RLS : aucune ligne mutée.
  });

  it('(h) co_mod résout le signalement (UPDATE state + resolved_by)', async () => {
    const { data: rows } = await comodClient
      .from('reports')
      .select('id')
      .eq('target_id', targetId)
      .limit(1);
    const reportId = rows?.[0]?.id;
    const { data, error } = await comodClient
      .from('reports')
      .update({
        state: 'closed_kept',
        resolved_by: comodId,
        resolution_motive: 'Vérifié, conservé.',
      })
      .eq('id', reportId!)
      .select('id, state')
      .single();
    expect(error).toBeNull();
    expect(data?.state).toBe('closed_kept');
  });

  it('(i) client ne peut PAS INSERT dans moderation_log (writes système only → 42501)', async () => {
    const { error } = await reporterClient.from('moderation_log').insert({
      residence_id: DARNA_RESIDENCE_ID,
      action: 'content_kept',
      target_kind: 'artisan',
      target_id: targetId,
    });
    expect(error?.code).toBe('42501');
  });

  it('(j) vue moderation_log_public : report_opened est masqué (anon)', async () => {
    const anon = createClient<Database>(
      parseSupabaseLocalEnv().SUPABASE_LOCAL_URL,
      parseSupabaseLocalEnv().SUPABASE_LOCAL_PUBLISHABLE_KEY,
      { auth: { storageKey: 'rls-reports-anon', persistSession: false } },
    );
    const { data, error } = await anon
      .from('moderation_log_public')
      .select('action')
      .eq('target_id', targetId);
    expect(error).toBeNull();
    expect((data ?? []).every((r) => r.action !== 'report_opened')).toBe(true);
  });

  it('(k) BLOQUANT review : report_opened NON lisible via la TABLE BRUTE (anon + résident)', async () => {
    // Le signalement (a) a écrit une ligne report_opened (actor_id = reporter). La
    // vue l'exclut (j), mais la table brute doit aussi être fermée au client, sinon
    // `select … from moderation_log where action='report_opened'` fuiterait
    // l'identité du signalant (review Epic 5 — vue = seul chemin public).
    const anon = createClient<Database>(
      parseSupabaseLocalEnv().SUPABASE_LOCAL_URL,
      parseSupabaseLocalEnv().SUPABASE_LOCAL_PUBLISHABLE_KEY,
      { auth: { storageKey: 'rls-reports-anon-raw', persistSession: false } },
    );
    const { data: anonRaw } = await anon
      .from('moderation_log')
      .select('actor_id, action')
      .eq('target_id', targetId);
    expect(anonRaw ?? []).toHaveLength(0);

    const { data: residentRaw } = await reporterClient
      .from('moderation_log')
      .select('actor_id, action')
      .eq('target_id', targetId);
    expect(residentRaw ?? []).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 5.3 — RPC de résolution co_mod (moderate_remove_content / _keep_content).
//   Retrait : soft-delete cible polymorphe + report closed_removed + audit
//   content_removed. Garde co_mod + résidence + anti-race (state='open').
// ─────────────────────────────────────────────────────────────────────────────
describe.skipIf(!RUN_LOCAL_RLS_TESTS)('RLS modération RPC (Epic 5.3)', () => {
  let admin: DarnaClient;
  let residentId: string;
  let comodId: string;
  let comodOtherId: string;
  let residentClient: DarnaClient;
  let comodClient: DarnaClient;
  let comodOtherClient: DarnaClient;
  let entryId: string; // guide_entry cible (Darna)
  const seededIds: string[] = [];

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
    await admin.from('users').update({ role, residence_id: residenceId }).eq('id', id);
    const client = createClient<Database>(localUrl, publishableKey, {
      auth: { storageKey: `rls-modrpc-${label}`, persistSession: false },
    });
    await establishSession(admin, client, email, label);
    return { id, client };
  }

  async function seedReport(targetId: string): Promise<string> {
    const { data, error } = await admin
      .from('reports')
      .insert({
        residence_id: DARNA_RESIDENCE_ID,
        reporter_id: residentId,
        target_type: 'guide_entry',
        target_id: targetId,
        reason: 'hors_charte',
      })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('seed report failed');
    return data.id;
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
      slug: `test2-modrpc-${Date.now()}`,
      villa_count: 150,
    });

    const resident = await makeUser(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'resident',
      'mres',
      DARNA_RESIDENCE_ID,
    );
    residentId = resident.id;
    residentClient = resident.client;

    const comod = await makeUser(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'co_mod',
      'mcomod',
      DARNA_RESIDENCE_ID,
    );
    comodId = comod.id;
    comodClient = comod.client;

    const comodOther = await makeUser(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'co_mod',
      'mcomod2',
      RESIDENCE_2_ID,
    );
    comodOtherId = comodOther.id;
    comodOtherClient = comodOther.client;

    const ts = Date.now();
    const { data: entry, error: entryErr } = await admin
      .from('guide_entries')
      .insert({
        slug: `regle-test-${ts}`,
        residence_id: DARNA_RESIDENCE_ID,
        theme_key: 'codes_portails',
        title_fr: 'Règle test',
        body_fr_markdown: 'Contenu à modérer.',
        order_in_theme: 0,
        created_by: comodId,
      })
      .select('id')
      .single();
    if (entryErr || !entry) throw entryErr ?? new Error('seed guide_entry failed');
    entryId = entry.id;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from('reports').delete().eq('reporter_id', residentId);
    if (entryId) {
      await admin.from('moderation_log').delete().eq('target_id', entryId);
      await admin.from('guide_entries').delete().eq('id', entryId);
    }
    for (const id of seededIds) await admin.from('guide_entries').delete().eq('id', id);
    for (const id of [residentId, comodId, comodOtherId]) {
      if (id) await admin.auth.admin.deleteUser(id);
    }
  });

  it('(a) un résident ne peut PAS appeler moderate_remove_content (not_co_mod)', async () => {
    const reportId = await seedReport(entryId);
    const { error } = await residentClient.rpc('moderate_remove_content', {
      p_report_id: reportId,
      p_motive: 'hors_charte',
    });
    expect(error?.message).toContain('not_co_mod');
    await admin.from('reports').delete().eq('id', reportId);
  });

  it('(b) un co_mod d’une autre résidence est rejeté (wrong_residence)', async () => {
    const reportId = await seedReport(entryId);
    const { error } = await comodOtherClient.rpc('moderate_remove_content', {
      p_report_id: reportId,
      p_motive: 'autre',
    });
    expect(error?.message).toContain('wrong_residence');
    await admin.from('reports').delete().eq('id', reportId);
  });

  it('(c) co_mod retire : report closed_removed + cible soft-deletée + audit content_removed', async () => {
    const reportId = await seedReport(entryId);
    const { error } = await comodClient.rpc('moderate_remove_content', {
      p_report_id: reportId,
      p_motive: 'diffamation',
      p_note: 'Propos diffamatoires.',
    });
    expect(error).toBeNull();

    const { data: rep } = await admin
      .from('reports')
      .select('state, resolved_by, resolution_motive')
      .eq('id', reportId)
      .single();
    expect(rep?.state).toBe('closed_removed');
    expect(rep?.resolved_by).toBe(comodId);

    const { data: entry } = await admin
      .from('guide_entries')
      .select('deleted_at, deleted_by')
      .eq('id', entryId)
      .single();
    expect(entry?.deleted_at).not.toBeNull();
    expect(entry?.deleted_by).toBe(comodId);

    const { data: ml } = await admin
      .from('moderation_log')
      .select('action, reason_code')
      .eq('target_id', entryId)
      .eq('action', 'content_removed');
    expect((ml ?? []).length).toBe(1);
    expect(ml?.[0]?.reason_code).toBe('diffamation');
  });

  it('(d) re-résoudre le même report → already_resolved (anti-race)', async () => {
    // Le report de (c) est déjà closed_removed. Nouvelle tentative.
    const { data: rep } = await admin
      .from('reports')
      .select('id')
      .eq('reporter_id', residentId)
      .eq('state', 'closed_removed')
      .limit(1)
      .single();
    const { error } = await comodClient.rpc('moderate_keep_content', {
      p_report_id: rep!.id,
    });
    expect(error?.message).toContain('already_resolved');
  });

  it('(e) co_mod conserve : report closed_kept + audit content_kept', async () => {
    // Nouvelle cible (la précédente est soft-deletée) pour un report frais.
    const ts = Date.now();
    const { data: entry2 } = await admin
      .from('guide_entries')
      .insert({
        slug: `regle-keep-${ts}`,
        residence_id: DARNA_RESIDENCE_ID,
        theme_key: 'codes_portails',
        title_fr: 'Règle keep',
        body_fr_markdown: 'Contenu conforme.',
        order_in_theme: 0,
        created_by: comodId,
      })
      .select('id')
      .single();
    seededIds.push(entry2!.id);
    const reportId = await seedReport(entry2!.id);

    const { error } = await comodClient.rpc('moderate_keep_content', {
      p_report_id: reportId,
      p_note: 'Conforme à la charte.',
    });
    expect(error).toBeNull();

    const { data: rep } = await admin.from('reports').select('state').eq('id', reportId).single();
    expect(rep?.state).toBe('closed_kept');

    const { data: ml } = await admin
      .from('moderation_log')
      .select('action')
      .eq('target_id', entry2!.id)
      .eq('action', 'content_kept');
    expect((ml ?? []).length).toBe(1);

    // La cible conservée n'est PAS soft-deletée.
    const { data: entryRow } = await admin
      .from('guide_entries')
      .select('deleted_at')
      .eq('id', entry2!.id)
      .single();
    expect(entryRow?.deleted_at).toBeNull();
    await admin.from('moderation_log').delete().eq('target_id', entry2!.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 5.5 — RPC d'escalade juridique (escalate_report_legal / resolve_legal_escalation).
//   open → closed_kept_pending_legal → approved (content_kept) / removed
//   (content_removed + soft-delete). Garde co_mod + résidence + état atomique.
// ─────────────────────────────────────────────────────────────────────────────
describe.skipIf(!RUN_LOCAL_RLS_TESTS)('RLS escalade juridique (Epic 5.5)', () => {
  let admin: DarnaClient;
  let residentId: string;
  let comodId: string;
  let residentClient: DarnaClient;
  let comodClient: DarnaClient;
  const entries: string[] = [];

  async function makeUser(
    localUrl: string,
    publishableKey: string,
    role: 'resident' | 'co_mod',
    label: string,
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
      app_metadata: { role, residence_id: DARNA_RESIDENCE_ID },
    });
    await admin.from('users').update({ role, residence_id: DARNA_RESIDENCE_ID }).eq('id', id);
    const client = createClient<Database>(localUrl, publishableKey, {
      auth: { storageKey: `rls-legal-${label}`, persistSession: false },
    });
    await establishSession(admin, client, email, label);
    return { id, client };
  }

  async function seedEntryAndReport(): Promise<{ entryId: string; reportId: string }> {
    const seq = entries.length;
    const ts = `${Date.now()}-${seq}`;
    const { data: entry, error: e1 } = await admin
      .from('guide_entries')
      .insert({
        slug: `legal-${ts}`,
        residence_id: DARNA_RESIDENCE_ID,
        theme_key: 'codes_portails',
        title_fr: 'Legal test',
        body_fr_markdown: 'Contenu litigieux.',
        order_in_theme: 900 + seq,
        created_by: comodId,
      })
      .select('id')
      .single();
    if (e1 || !entry) throw e1 ?? new Error('seed entry failed');
    entries.push(entry.id);
    const { data: report, error: e2 } = await admin
      .from('reports')
      .insert({
        residence_id: DARNA_RESIDENCE_ID,
        reporter_id: residentId,
        target_type: 'guide_entry',
        target_id: entry.id,
        reason: 'diffamation',
      })
      .select('id')
      .single();
    if (e2 || !report) throw e2 ?? new Error('seed report failed');
    return { entryId: entry.id, reportId: report.id };
  }

  beforeAll(async () => {
    const localEnv = parseSupabaseLocalEnv();
    admin = createClient<Database>(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_SERVICE_KEY,
    );
    const resident = await makeUser(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'resident',
      'lres',
    );
    residentId = resident.id;
    residentClient = resident.client;
    const comod = await makeUser(
      localEnv.SUPABASE_LOCAL_URL,
      localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY,
      'co_mod',
      'lcomod',
    );
    comodId = comod.id;
    comodClient = comod.client;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from('reports').delete().eq('reporter_id', residentId);
    for (const id of entries) {
      await admin.from('moderation_log').delete().eq('target_id', id);
      await admin.from('guide_entries').delete().eq('id', id);
    }
    for (const id of [residentId, comodId]) if (id) await admin.auth.admin.deleteUser(id);
  });

  it('(a) un résident ne peut PAS escalader (not_co_mod)', async () => {
    const { reportId } = await seedEntryAndReport();
    const { error } = await residentClient.rpc('escalate_report_legal', {
      p_report_id: reportId,
      p_context_note: 'tentative',
    });
    expect(error?.message).toContain('not_co_mod');
  });

  it('(b) co_mod escalade : state pending_legal + audit escalation_triggered', async () => {
    const { entryId, reportId } = await seedEntryAndReport();
    const { error } = await comodClient.rpc('escalate_report_legal', {
      p_report_id: reportId,
      p_context_note: 'Avis juridique requis.',
    });
    expect(error).toBeNull();
    const { data: rep } = await admin.from('reports').select('state').eq('id', reportId).single();
    expect(rep?.state).toBe('closed_kept_pending_legal');
    const { data: ml } = await admin
      .from('moderation_log')
      .select('action')
      .eq('target_id', entryId)
      .eq('action', 'escalation_triggered');
    expect((ml ?? []).length).toBe(1);
  });

  it('(c) resolve sur un report non escaladé → not_pending_legal', async () => {
    const { reportId } = await seedEntryAndReport(); // état open
    const { error } = await comodClient.rpc('resolve_legal_escalation', {
      p_report_id: reportId,
      p_decision: 'approved',
      p_note: 'x',
    });
    expect(error?.message).toContain('not_pending_legal');
  });

  it('(d) resolve approved : closed_kept_legal_approved + content_kept', async () => {
    const { entryId, reportId } = await seedEntryAndReport();
    await comodClient.rpc('escalate_report_legal', {
      p_report_id: reportId,
      p_context_note: 'ctx',
    });
    const { error } = await comodClient.rpc('resolve_legal_escalation', {
      p_report_id: reportId,
      p_decision: 'approved',
      p_note: 'Avis : conserver.',
    });
    expect(error).toBeNull();
    const { data: rep } = await admin.from('reports').select('state').eq('id', reportId).single();
    expect(rep?.state).toBe('closed_kept_legal_approved');
    const { data: entry } = await admin
      .from('guide_entries')
      .select('deleted_at')
      .eq('id', entryId)
      .single();
    expect(entry?.deleted_at).toBeNull(); // conservé
  });

  it('(e) resolve removed : closed_removed_legal_advised + cible soft-deletée', async () => {
    const { entryId, reportId } = await seedEntryAndReport();
    await comodClient.rpc('escalate_report_legal', {
      p_report_id: reportId,
      p_context_note: 'ctx',
    });
    const { error } = await comodClient.rpc('resolve_legal_escalation', {
      p_report_id: reportId,
      p_decision: 'removed',
      p_note: 'Avis : retirer.',
    });
    expect(error).toBeNull();
    const { data: rep } = await admin.from('reports').select('state').eq('id', reportId).single();
    expect(rep?.state).toBe('closed_removed_legal_advised');
    const { data: entry } = await admin
      .from('guide_entries')
      .select('deleted_at, deleted_by')
      .eq('id', entryId)
      .single();
    expect(entry?.deleted_at).not.toBeNull();
    expect(entry?.deleted_by).toBe(comodId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Story 6.5 — RLS suggestions : résident INSERT/SELECT own ; co_mod SELECT
// résidence + UPDATE state. Jamais cross-résidence. Pas de lecture d'autrui.
// ─────────────────────────────────────────────────────────────────────────────
describe.skipIf(!RUN_LOCAL_RLS_TESTS)('RLS suggestions (Epic 6.5)', () => {
  let admin: DarnaClient;
  let sonia: DarnaClient; // résident res1 (auteur)
  let othmane: DarnaClient; // autre résident res1
  let karim: DarnaClient; // co_mod res1
  let eve: DarnaClient; // co_mod res2
  let suggestionId: string;

  async function makeUser(
    localUrl: string,
    key: string,
    role: 'resident' | 'co_mod',
    label: string,
    residenceId: string,
  ): Promise<DarnaClient> {
    const email = `${label}-${Date.now()}@test.darna.local`;
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: 'test-password-1234',
      email_confirm: true,
    });
    if (error || !created.user) throw error ?? new Error(`${label} create failed`);
    await admin.auth.admin.updateUserById(created.user.id, {
      app_metadata: { role, residence_id: residenceId },
    });
    await admin.from('users').update({ role, residence_id: residenceId }).eq('id', created.user.id);
    const client = createClient<Database>(localUrl, key, {
      auth: { storageKey: `rls-sug-${label}`, persistSession: false },
    });
    await establishSession(admin, client, email, label);
    return client;
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
      slug: `test2-sug-${Date.now()}`,
      villa_count: 150,
    });
    const url = localEnv.SUPABASE_LOCAL_URL;
    const key = localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY;
    sonia = await makeUser(url, key, 'resident', 'sugsonia', DARNA_RESIDENCE_ID);
    othmane = await makeUser(url, key, 'resident', 'sugothmane', DARNA_RESIDENCE_ID);
    karim = await makeUser(url, key, 'co_mod', 'sugkarim', DARNA_RESIDENCE_ID);
    eve = await makeUser(url, key, 'co_mod', 'sugeve', RESIDENCE_2_ID);
  });

  it('(a) résident insère sa suggestion (body seul, defaults figés)', async () => {
    const { data, error } = await sonia
      .from('suggestions')
      .insert({ body: 'Ajouter un mode sombre' })
      .select('id, user_id, residence_id, state')
      .single();
    expect(error).toBeNull();
    expect(data?.state).toBe('new');
    suggestionId = data!.id;
  });

  it('(b) l’auteur voit sa suggestion ; un autre résident ne la voit PAS', async () => {
    const { data: own } = await sonia.from('suggestions').select('id').eq('id', suggestionId);
    expect((own ?? []).length).toBe(1);
    const { data: other } = await othmane.from('suggestions').select('id').eq('id', suggestionId);
    expect((other ?? []).length).toBe(0);
  });

  it('(c) co_mod de la résidence voit la suggestion', async () => {
    const { data } = await karim.from('suggestions').select('id, body').eq('id', suggestionId);
    expect((data ?? []).length).toBe(1);
  });

  it('(d) co_mod d’une AUTRE résidence ne voit rien (isolation)', async () => {
    const { data } = await eve.from('suggestions').select('id').eq('id', suggestionId);
    expect((data ?? []).length).toBe(0);
  });

  it('(e) un résident NE PEUT PAS marquer comme lue (aucune policy update) ', async () => {
    await sonia.from('suggestions').update({ state: 'reviewed' }).eq('id', suggestionId);
    const { data } = await admin
      .from('suggestions')
      .select('state')
      .eq('id', suggestionId)
      .single();
    expect(data?.state).toBe('new'); // inchangé (RLS bloque l'auteur).
  });

  it('(f) co_mod marque comme lue (state → reviewed)', async () => {
    const { error } = await karim
      .from('suggestions')
      .update({ state: 'reviewed' })
      .eq('id', suggestionId);
    expect(error).toBeNull();
    const { data } = await admin
      .from('suggestions')
      .select('state')
      .eq('id', suggestionId)
      .single();
    expect(data?.state).toBe('reviewed');
  });

  afterAll(async () => {
    if (admin && suggestionId) await admin.from('suggestions').delete().eq('id', suggestionId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Retrait d'un résident par un co_mod (spec 2026-07-21) — la RPC
// comod_remove_resident porte ses gardes en SQL (SECURITY DEFINER + auth_role/
// auth_residence_id) : on vérifie ici qu'un résident ou un co_mod d'une autre
// résidence ne peuvent PAS l'exécuter, et que le soft-delete est complet.
// ─────────────────────────────────────────────────────────────────────────────
describe.skipIf(!RUN_LOCAL_RLS_TESTS)('RLS retrait résident (comod_remove_resident)', () => {
  let admin: DarnaClient;
  let karim: { id: string; client: DarnaClient }; // co_mod res1
  let eve: { id: string; client: DarnaClient }; // co_mod res2
  let rachid: { id: string; client: DarnaClient }; // résident res1 (cible)
  let sofia: { id: string; client: DarnaClient }; // résident res1 (appelant illégitime)

  async function makeUser(
    localUrl: string,
    key: string,
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
    await admin.auth.admin.updateUserById(created.user.id, {
      app_metadata: { role, residence_id: residenceId },
    });
    await admin.from('users').update({ role, residence_id: residenceId }).eq('id', created.user.id);
    const client = createClient<Database>(localUrl, key, {
      auth: { storageKey: `rls-rm-${label}`, persistSession: false },
    });
    await establishSession(admin, client, email, label);
    return { id: created.user.id, client };
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
      slug: `test2-rm-${Date.now()}`,
      villa_count: 150,
    });

    const url = localEnv.SUPABASE_LOCAL_URL;
    const key = localEnv.SUPABASE_LOCAL_PUBLISHABLE_KEY;
    karim = await makeUser(url, key, 'co_mod', 'karim-rm', DARNA_RESIDENCE_ID);
    eve = await makeUser(url, key, 'co_mod', 'eve-rm', RESIDENCE_2_ID);
    rachid = await makeUser(url, key, 'resident', 'rachid-rm', DARNA_RESIDENCE_ID);
    sofia = await makeUser(url, key, 'resident', 'sofia-rm', DARNA_RESIDENCE_ID);

    // Profil de la cible (le soft-delete miroir doit le toucher).
    await admin.from('profiles').insert({
      user_id: rachid.id,
      residence_id: DARNA_RESIDENCE_ID,
      villa: 42,
    });
  });

  it('un résident ne peut pas exécuter la RPC (forbidden)', async () => {
    const { error } = await sofia.client.rpc('comod_remove_resident', {
      p_target_user_id: rachid.id,
      p_reason: 'tentative illégitime',
    });
    expect(error?.message).toContain('forbidden');
  });

  it('un co_mod d’une autre résidence est rejeté (cross_residence)', async () => {
    const { error } = await eve.client.rpc('comod_remove_resident', {
      p_target_user_id: rachid.id,
      p_reason: 'tentative cross-résidence',
    });
    expect(error?.message).toContain('cross_residence');
  });

  it('motif vide rejeté (invalid_reason)', async () => {
    const { error } = await karim.client.rpc('comod_remove_resident', {
      p_target_user_id: rachid.id,
      p_reason: '   ',
    });
    expect(error?.message).toContain('invalid_reason');
  });

  it('impossible de retirer un co_mod (target_not_resident)', async () => {
    const { error } = await karim.client.rpc('comod_remove_resident', {
      p_target_user_id: karim.id,
      p_reason: 'auto-suppression interdite',
    });
    expect(error?.message).toContain('target_not_resident');
  });

  it('un co_mod de la résidence retire un résident : soft-delete complet + log', async () => {
    const { error } = await karim.client.rpc('comod_remove_resident', {
      p_target_user_id: rachid.id,
      p_reason: 'Déménagement confirmé (test RLS)',
    });
    expect(error).toBeNull();

    const { data: u } = await admin
      .from('users')
      .select('deleted_at, deleted_by, deletion_reason, display_name')
      .eq('id', rachid.id)
      .single();
    expect(u?.deleted_at).not.toBeNull();
    expect(u?.deleted_by).toBe(karim.id);
    expect(u?.deletion_reason).toBe('removed_by_comod');
    expect(u?.display_name).toBe('Voisin supprimé');

    const { data: p } = await admin
      .from('profiles')
      .select('deleted_at, deletion_reason')
      .eq('user_id', rachid.id)
      .single();
    expect(p?.deleted_at).not.toBeNull();
    expect(p?.deletion_reason).toBe('removed_by_comod');

    const { data: entries } = await admin
      .from('moderation_log')
      .select('actor_id, reason_code, reason_text_anonymized')
      .eq('action', 'user_deleted')
      .eq('target_id', rachid.id);
    expect(entries?.length).toBe(1);
    expect(entries?.[0]?.actor_id).toBe(karim.id);
    expect(entries?.[0]?.reason_code).toBe('removed_by_comod');
  });

  it('un second retrait est rejeté (already_deleted), sans doublon de log', async () => {
    const { error } = await karim.client.rpc('comod_remove_resident', {
      p_target_user_id: rachid.id,
      p_reason: 'double retrait',
    });
    expect(error?.message).toContain('already_deleted');

    const { data: entries } = await admin
      .from('moderation_log')
      .select('id')
      .eq('action', 'user_deleted')
      .eq('target_id', rachid.id);
    expect(entries?.length).toBe(1);
  });
});
