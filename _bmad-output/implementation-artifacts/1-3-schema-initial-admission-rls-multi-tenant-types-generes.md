# Story 1.3: Schéma initial admission, RLS multi-tenant & types générés

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** solo dev (Stephane),
**I want** les 6 tables fondatrices du flow admission (`residences`, `users`, `profiles`, `admission_requests`, `moderation_log`, `notifications_prefs`) provisionnées par 6 migrations Supabase versionnées, avec RLS multi-tenant (4 rôles), soft-delete CNDP, triggers `updated_at`, seed résidence Darna et types TypeScript générés,
**so that** les stories d'admission (1.6 magic-link, 1.7 demande, 1.8 validation co-mod, 1.9 profil/RGPD) puissent se construire sur une fondation Postgres souveraine, multi-tenant-ready (NFR25), strictement isolée par RLS, sans aucun mapping camelCase et sans aller-retour de schéma plus tard.

## Acceptance Criteria

> **Convention BDD** : chaque AC est testable indépendamment. La référence finale est l'epic ([Source: _bmad-output/planning-artifacts/epics.md#Story-1.3]) — toute divergence dans cette story est une erreur à corriger.

**AC1 — 6 migrations versionnées + `db reset` idempotent (AR5)**
**Given** le dossier `supabase/migrations/` contient exactement ces 6 fichiers, dans cet ordre :

- `20260601000001_init_enums.sql`
- `20260601000002_init_schema.sql`
- `20260601000003_init_rls.sql`
- `20260601000004_init_indexes.sql`
- `20260601000005_init_triggers.sql`
- `20260601000006_seed_residence.sql`

**When** je lance `pnpm supabase db reset` (stack locale Docker démarrée)
**Then** les 6 migrations s'appliquent sans erreur, créent exactement 6 tables `public.residences`, `public.users`, `public.profiles`, `public.admission_requests`, `public.moderation_log`, `public.notifications_prefs`, et `pnpm supabase db reset` est **rejouable** (idempotent — aucun side-effect entre deux runs).

> **Note FTS** : `init_fts.sql` (index GIN tsvector pour annuaire) est différé à Epic 2 (artisans). Pas dans 1.3.

**AC2 — Multi-tenant J1 : `residence_id` not null partout (AR7, NFR25)**
**Given** les 5 tables d'entités utilisateur (`users`, `profiles`, `admission_requests`, `moderation_log`, `notifications_prefs`)
**When** j'inspecte le schéma via `pnpm supabase db dump --schema public`
**Then** chacune porte `residence_id uuid not null references residences(id) on delete restrict` et chaque INSERT sans `residence_id` est rejeté par Postgres avec `null value in column "residence_id" violates not-null constraint`.

> **Exception** : `notifications_prefs` a `residence_id` quand-même (cohérence multi-tenant V3), même si la PK est `user_id` (cf. AC4).

**AC3 — Colonnes soft-delete + audit CNDP sur entités modérables (AR9, NFR17)**
**Given** les 4 tables `users`, `profiles`, `admission_requests`, `moderation_log`
**When** j'inspecte le schéma
**Then** chacune porte :

- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz` (nullable)
- `deleted_by uuid` (nullable, references `users(id) on delete set null`)
- `deletion_reason text` (nullable)

`notifications_prefs` n'a **pas** de soft-delete (table de prefs, cascade hard via `user_id` PK avec `on delete cascade`).

**AC4 — `notifications_prefs` : 3 toggles opt-in/opt-out + PK `user_id` (FR40)**
**Given** la table `public.notifications_prefs`
**When** j'inspecte sa définition
**Then** elle a exactement ces colonnes :

- `user_id uuid primary key references users(id) on delete cascade`
- `residence_id uuid not null references residences(id) on delete restrict`
- `alerts_urgentes_enabled boolean not null default true` (FR40-a : alertes coupures/sécurité — opt-out)
- `nouvelles_entrees_annuaire_enabled boolean not null default false` (FR40-b : nouvelles fiches artisans — opt-in)
- `activite_contributions_enabled boolean not null default true` (FR40-c : activité sur ses propres contributions — opt-out)
- `updated_at timestamptz not null default now()`

Defaults reflètent la politique anti-spam (FR43) — opt-in strict sur le marketing-like (annuaire), opt-out sur l'urgent et le perso.

**AC5 — `users.first_login_at` + `pack_accueil_dismissed_at` (Story 3.4 forward-compat)**
**Given** la table `public.users`
**When** j'inspecte sa définition
**Then** elle inclut :

- `first_login_at timestamptz` (nullable) — bannière Pack accueil tant que `null`
- `pack_accueil_dismissed_at timestamptz` (nullable) — quand l'user dismisse la bannière

Aucun `ALTER TABLE` ne sera requis en Story 3.4 pour ces deux colonnes.

**AC6 — ENUMs pour state admission + decision_reason (FR1-FR11)**
**Given** le fichier `20260601000001_init_enums.sql`
**When** je l'inspecte
**Then** il crée exactement ces ENUMs PostgreSQL :

- `user_role` : `'resident' | 'co_mod' | 'demandeur' | 'public'`
- `admission_state` : `'pending' | 'accepted' | 'rejected'`
- `admission_decision_reason` : `'villa_out_of_range' | 'duplicate' | 'incomplete_info' | 'manual_review_needed'` (liste fermée, AC du flow validation co-mod)
- `admission_contact_channel` : `'email' | 'sms'` (canal magic-link choisi par le demandeur)
- `moderation_action` : `'admission_accepted' | 'admission_rejected' | 'user_deleted' | 'content_removed' | 'rating_removed' | 'comment_removed'` (extensible — story 5.x ajoutera ses actions via `ALTER TYPE`)

`admission_requests.decision_reason admission_decision_reason` est `not null` quand `state = 'rejected'`, `null` quand `state = 'pending' | 'accepted'` (enforced via `CHECK` constraint).

**AC7 — RLS activé sur 6/6 tables avec policies nommées `<table>_<role>_<action>` (AR6, AR15)**
**Given** le fichier `20260601000003_init_rls.sql`
**When** je l'inspecte et lance `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`
**Then** :

- `relrowsecurity = true` sur les 6 tables
- Les policies suivantes existent (nommées strictement selon AR15) :

  **`admission_requests`** :
  - `admission_requests_demandeur_select` : `auth.uid() = user_id`
  - `admission_requests_demandeur_insert` : `auth.uid() = user_id` (insert sa propre demande)
  - `admission_requests_co_mod_select` : `(auth.jwt() -> 'app_metadata' ->> 'role') = 'co_mod' AND residence_id = (auth.jwt() -> 'app_metadata' ->> 'residence_id')::uuid`
  - `admission_requests_co_mod_update` : idem co_mod_select (transitions state)
  - **Aucune** policy DELETE pour `demandeur` ou `co_mod` (soft-delete uniquement)

  **`users`** :
  - `users_resident_select_self` : `auth.uid() = id`
  - `users_co_mod_select_residence` : co_mod scope résidence
  - `users_resident_update_self` : `auth.uid() = id` (profil)

  **`profiles`** :
  - `profiles_resident_select_residence` : autres résidents de la même résidence (annuaire post-MVP — read-only multi-villa-mate)
  - `profiles_resident_update_self` : `auth.uid() = user_id`

  **`moderation_log`** :
  - `moderation_log_public_select` : `using (true)` — lecture publique (FR33 transparence)
  - **Aucune** policy INSERT/UPDATE/DELETE côté client (writes système uniquement via `SECURITY DEFINER` function, cf. Story 1.8)

  **`notifications_prefs`** :
  - `notifications_prefs_resident_select_self` : `auth.uid() = user_id`
  - `notifications_prefs_resident_update_self` : `auth.uid() = user_id`
  - `notifications_prefs_resident_insert_self` : `auth.uid() = user_id` (provisioned au 1er login)

  **`residences`** :
  - `residences_public_select` : `using (true)` — lecture publique (1 résidence MVP, scope public)
  - **Aucune** policy write côté client

**Tests RLS automatisés** : différés à Story 1.10 (cf. Gap #7, ADR 0008 à rédiger en 1.10). En 1.3 : un seul test manuel SQL (cf. Tasks T9.4) qui valide qu'un user `demandeur` ne peut **PAS** lire une autre demande.

**AC8 — Indexes nommés `idx_<table>_<colonnes>` (AR15)**
**Given** le fichier `20260601000004_init_indexes.sql`
**When** je l'inspecte
**Then** il crée au minimum :

- `idx_admission_requests_residence_id_state` (file co-mod : WHERE residence_id = $1 AND state = 'pending')
- `idx_admission_requests_user_id` (lookup self)
- `idx_users_residence_id` (scope résidence)
- `idx_profiles_residence_id` (annuaire résidence)
- `idx_moderation_log_residence_id_created_at` (page transparence ORDER BY date desc)
- `idx_notifications_prefs_user_id` (PK déjà indexée, mais composite `(residence_id, user_id)` pour multi-tenant V3)

**AC9 — Trigger `updated_at` partagé sur 5 tables (AR15)**
**Given** le fichier `20260601000005_init_triggers.sql`
**When** je l'inspecte
**Then** il crée :

- 1 fonction PostgreSQL réutilisable `public.set_updated_at()` (`returns trigger`, `language plpgsql`, body : `new.updated_at = now(); return new;`)
- 5 triggers `BEFORE UPDATE` nommés `trg_<table>_updated_at` sur `residences`, `users`, `profiles`, `admission_requests`, `notifications_prefs` (pas sur `moderation_log` — log immutable).

**AC10 — Seed résidence Darna avec UUID stable, AUCUN user/co-mod en SQL (AR34)**
**Given** le fichier `20260601000006_seed_residence.sql`
**When** je l'inspecte
**Then** :

- Il insère **exactement 1 ligne** dans `residences` avec `id = '00000000-0000-0000-0000-000000000001'::uuid` (constante stable, choisie une fois ici puis fixée), `name = 'Darna'`, `villa_count = 150`, créée
- Il **n'insère AUCUN user, co-mod, profile, admission_request**. AR34 strict — provisioning co-mods = `scripts/invite-co-mods.ts` post-deploy (out-of-scope 1.3, livré en Story 1.6 ou 1.8).
- Migration idempotente (`on conflict (id) do nothing`).

**AC11 — `lib/supabase/types.generated.ts` produit par `pnpm gen:types` (AR8, AR20)**
**Given** `scripts/generate-types.sh` est câblé (plus un stub) et `SUPABASE_PROJECT_REF` est défini dans `.env.local`
**When** je lance `pnpm gen:types`
**Then** :

- Le fichier `lib/supabase/types.generated.ts` est créé/mis à jour
- Il contient un export `Database` avec les 6 tables typées en **snake_case** end-to-end (pas de transform camelCase — AR20)
- `pnpm typecheck` passe vert
- Le fichier est **versionné** dans git (commit obligatoire après chaque migration — cf. `lib/supabase/README.md`)

**AC12 — Bridge `public.users` ↔ `auth.users` documenté + cascadé (Supabase Auth pattern)**
**Given** la table `public.users` créée en migration `init_schema.sql`
**When** j'inspecte sa définition
**Then** :

- `id uuid primary key references auth.users(id) on delete cascade` (la PK = id Supabase Auth, suppression auth → suppression public en cascade)
- Un trigger `trg_auth_users_after_insert` sur `auth.users` qui crée automatiquement la ligne `public.users` correspondante + `public.notifications_prefs` avec les defaults FR40 (pattern Auth Hook DB-side, pas Edge Function)
- Documentation dans `lib/supabase/README.md` : « `public.users` est l'image projet de `auth.users` (1↔1, cascade) ; `app_metadata.role` et `app_metadata.residence_id` sont peuplés par `supabase.auth.admin.updateUserById()` lors de validation admission (Story 1.8) »

**AC13 — `pnpm typecheck` + `pnpm lint` + `pnpm test` verts au sortir de 1.3**
**Given** la story est implémentée
**When** je lance la pipeline locale
**Then** :

- `pnpm typecheck` → vert (avec `types.generated.ts` consommé par `lib/supabase/server.ts` et `client.ts`)
- `pnpm lint` → vert
- `pnpm test` → vert (au minimum 23 tests existants ; un nouveau test léger sur les types générés peut être ajouté, cf. Tasks)

---

## Tasks / Subtasks

> **Convention** : cocher chaque sous-tâche en cours d'implémentation. Une AC reste "non livrée" tant que tous ses sub-checks sont verts. **Tests d'abord** : pour chaque migration, valider que `db reset` est idempotent avant de passer à la suivante.

- [x] **T1 — Setup Supabase CLI + init local stack** (AC1)
  - [x] Décider : `npx supabase@latest` (recommandé, aligné avec `release.yml` story 1.2) ou install global. Trancher dans Debug Log.
  - [x] `npx supabase init` → crée `supabase/config.toml` à la racine + `supabase/migrations/` + `supabase/seed.sql`
  - [x] Éditer `supabase/config.toml` pour aligner `project_id`, port unique (eviter conflit avec autres projets locaux), region `eu-central-1`
  - [x] **NE PAS** committer `supabase/.branches`, `supabase/.temp` → ajouter au `.gitignore`
  - [x] `npx supabase start` → vérifier que la stack Docker boot (Postgres + Auth + Storage + Studio)
  - [x] Documenter dans `lib/supabase/README.md` : prérequis Docker, commandes `start` / `stop` / `db reset`

- [x] **T2 — Migration `init_enums.sql`** (AC6)
  - [x] Créer fichier via `npx supabase migration new init_enums` (timestamp + `_init_enums.sql`)
  - [x] Définir les 5 ENUMs : `user_role`, `admission_state`, `admission_decision_reason`, `admission_contact_channel`, `moderation_action`
  - [x] Valeurs en `snake_case` (AR15)
  - [x] **Pas** de `DROP TYPE` (incompat avec rejouabilité — `supabase db reset` recrée la DB from scratch)

- [x] **T3 — Migration `init_schema.sql`** (AC1, AC2, AC3, AC4, AC5, AC12)
  - [x] Créer fichier via `npx supabase migration new init_schema`
  - [x] Ordre des CREATE TABLE pour respecter FK : `residences` → `users` → `profiles` → `admission_requests` → `moderation_log` → `notifications_prefs`
  - [x] **`residences`** : `id uuid pk default gen_random_uuid()`, `name text not null`, `villa_count int not null check (villa_count between 1 and 1000)`, `slug text not null unique`, soft-delete cols (`created_at`, `updated_at`, `deleted_at`, `deleted_by`, `deletion_reason`)
  - [x] **`users`** : `id uuid pk references auth.users(id) on delete cascade`, `residence_id` FK not null, `role user_role not null default 'resident'`, `display_name text` (pseudo par défaut), `first_login_at timestamptz`, `pack_accueil_dismissed_at timestamptz`, soft-delete cols, **PAS** d'email/phone (vivent dans `auth.users`)
  - [x] **`profiles`** : `user_id uuid pk references users(id) on delete cascade`, `residence_id` FK not null, `villa int not null check (villa between 1 and 150)`, `tranche text`, `language text not null default 'fr' check (language in ('fr', 'ar'))`, `identity_mode text not null default 'pseudo' check (identity_mode in ('pseudo', 'identified'))` (FR16), soft-delete cols
  - [x] **`admission_requests`** : `id uuid pk default gen_random_uuid()`, `user_id uuid not null references users(id) on delete cascade` (lien magic-link déjà créé `auth.users`), `residence_id` FK, `villa int not null`, `tranche text`, `first_name text not null`, `contact_channel admission_contact_channel not null`, `state admission_state not null default 'pending'`, `decision_reason admission_decision_reason` (nullable), `decided_by uuid references users(id) on delete set null`, `decided_at timestamptz`, soft-delete cols, **CHECK** : `(state = 'rejected' AND decision_reason is not null) OR (state in ('pending', 'accepted') AND decision_reason is null)`
  - [x] **`moderation_log`** : `id uuid pk default gen_random_uuid()`, `residence_id` FK, `actor_id uuid references users(id) on delete set null` (anonymisation), `action moderation_action not null`, `target_kind text not null` (`'admission_request' | 'user' | 'rating' | 'comment' | ...`), `target_id uuid`, `reason_code text`, `reason_text_anonymized text`, `created_at timestamptz not null default now()`, soft-delete cols (mais `updated_at` **absent** — log immutable)
  - [x] **`notifications_prefs`** : cf. AC4 verbatim
  - [x] Activer `auth` schema + extension `pgcrypto` (`gen_random_uuid()`) si pas déjà fait via Supabase défaut
  - [x] `pnpm supabase db reset` → vérifier 6 tables créées sans erreur

- [x] **T4 — Auth bridge : trigger auto-provisioning `public.users` + `notifications_prefs`** (AC12)
  - [x] Dans `init_schema.sql` (ou nouvelle migration `init_auth_bridge.sql` si on veut isoler) : fonction `public.handle_new_auth_user()` `security definer set search_path = public, auth` qui INSERT `public.users` (résidence par défaut = Darna seed) + INSERT `public.notifications_prefs` (defaults FR40)
  - [x] Trigger `trg_auth_users_after_insert` `after insert on auth.users for each row execute function public.handle_new_auth_user()`
  - [x] **Important** : `residence_id` initial = résidence Darna (UUID stable AC10) — pour le MVP mono-résidence. En V3 multi-tenant, ce trigger devra lire `app_metadata.residence_id` (TODO commenté inline)
  - [x] Tester : créer un user via `supabase.auth.admin.createUser({ email })` localement → vérifier que `public.users` et `notifications_prefs` ont une ligne

- [x] **T5 — Migration `init_rls.sql`** (AC7)
  - [x] Créer fichier via `npx supabase migration new init_rls`
  - [x] `alter table ... enable row level security` sur les 6 tables
  - [x] Créer toutes les policies listées en AC7, nommage strict `<table>_<role>_<action>`
  - [x] Pour les policies `co_mod` : utiliser `(auth.jwt() -> 'app_metadata' ->> 'role') = 'co_mod'` ET `(auth.jwt() -> 'app_metadata' ->> 'residence_id')::uuid = residence_id`
  - [x] Aucune policy DELETE côté client (soft-delete via UPDATE de `deleted_at`)
  - [x] `pnpm supabase db reset` → vérifier que `select relrowsecurity from pg_class where relname in ('residences', 'users', ...)` renvoie `true` partout

- [x] **T6 — Migration `init_indexes.sql`** (AC8)
  - [x] Créer fichier via `npx supabase migration new init_indexes`
  - [x] 6 indexes listés en AC8 (filename `idx_<table>_<colonnes>`)
  - [x] Aucun index FTS GIN ici (différé Epic 2)

- [x] **T7 — Migration `init_triggers.sql`** (AC9)
  - [x] Créer fichier via `npx supabase migration new init_triggers`
  - [x] 1 fonction `public.set_updated_at()` partagée
  - [x] 5 triggers `trg_<table>_updated_at` sur `residences`, `users`, `profiles`, `admission_requests`, `notifications_prefs` (pas `moderation_log`)

- [x] **T8 — Migration `seed_residence.sql`** (AC10)
  - [x] Créer fichier via `npx supabase migration new seed_residence`
  - [x] `INSERT INTO residences (id, name, slug, villa_count) VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Darna', 'darna', 150) ON CONFLICT (id) DO NOTHING;`
  - [x] Aucun INSERT user / co-mod / profile

- [x] **T9 — Câbler `scripts/generate-types.sh` + générer `types.generated.ts`** (AC11)
  - [x] Remplacer le STUB par : appel `npx supabase gen types typescript --linked > lib/supabase/types.generated.ts` (mode `--linked` quand `SUPABASE_PROJECT_REF` est setup) OU `--local` (mode dev — utilise la stack Docker)
  - [x] Le script doit détecter : si `--local` ou `--linked` selon presence d'arg ou env var
  - [x] Ajouter en haut du fichier généré un commentaire `// DO NOT EDIT — généré par pnpm gen:types` (via sed ou wrapper)
  - [x] `pnpm gen:types --local` (après `supabase start`) → vérifier que `lib/supabase/types.generated.ts` est créé avec les 6 tables
  - [x] Mettre à jour `lib/supabase/client.ts` et `lib/supabase/server.ts` pour passer le générique `<Database>` au client : `createBrowserClient<Database>(...)` / `createServerClient<Database>(...)`
  - [x] `lib/supabase/proxy.ts` idem
  - [x] Mettre à jour `lib/supabase/README.md` (retirer la mention « stub » de Story 1.3)
  - [x] Vérifier que `types.generated.ts` est **versionné** (pas dans `.gitignore`)

- [x] **T10 — Test RLS minimal (sans Playwright)** (AC7)
  - [x] Créer `tests/rls.test.ts` (Vitest) qui :
    - boot un client Supabase server-side via `env.client` pointé sur la stack locale
    - crée 2 users `auth.admin.createUser` (alice + bob, même résidence)
    - alice insère une `admission_request`
    - bob essaie `select * from admission_requests` → attendu : `0 rows` (RLS bloque)
  - [x] Skip ce test si `SUPABASE_LOCAL_TEST=false` (CI sans stack Supabase locale — test approfondi est en Story 1.10)
  - [x] Tests RLS exhaustifs (alice / bob / eve cross-résidence sur 7 tables) = **out-of-scope** 1.3, story 1.10

- [x] **T11 — Mettre à jour `tests/setup.ts` si test 1.3 transite par `lib/supabase/*`** (Edge case identifié dans deferred-work review 1.1)
  - [x] Si T10 importe `lib/supabase/client.ts`, ajouter dans `tests/setup.ts` un stub des env vars Supabase ou un mock du module
  - [x] Si non requis, ne PAS modifier (éviter scope creep)

- [x] **T12 — Validation end-to-end** (toutes ACs)
  - [x] `pnpm supabase db reset` (2 fois consécutives — idempotence)
  - [x] `pnpm gen:types --local` → `lib/supabase/types.generated.ts` mis à jour
  - [x] `pnpm typecheck` → vert
  - [x] `pnpm lint` → vert
  - [x] `pnpm test` → vert (23 existants + nouveaux)
  - [x] `pnpm supabase db dump --schema public > /tmp/schema-darna.sql` → review manuelle du schéma final
  - [x] Commit `lib/supabase/types.generated.ts`
  - [x] Vérifier que `.github/workflows/release.yml` (story 1.2) saura appliquer ces migrations en prod via `npx supabase db push --linked`

---

## Dev Notes

### Architecture compliance — règles non-négociables

[Source: architecture.md#Implementation-Patterns-Consistency-Rules]

1. **Naming DB (AR15)** [Source: architecture.md:374-384] :
   - Tables : `snake_case` **pluriel** (`residences`, `admission_requests`) — **exception** `moderation_log` au singulier (entité journal collectif)
   - Colonnes : `snake_case` (`residence_id`, `deleted_at`, `display_name_fr`)
   - FK : `<entity>_id` (`user_id`, `residence_id`)
   - Timestamps : `_at` suffix `timestamptz` (`created_at`, `updated_at`, `deleted_at`)
   - Booleans : `is_*` / `has_*` (ex: `alerts_urgentes_enabled` ne respecte pas — historique FR40, conserver)
   - Bilingual : `<field>_<lang>` (`description_fr`, `description_ar`) — pas utilisé en 1.3
   - Indexes : `idx_<table>_<colonnes>`
   - Policies : `<table>_<role>_<action>` (ex: `admission_requests_demandeur_insert`)
   - Triggers : `trg_<table>_<event>` (`trg_users_updated_at`)
   - ENUMs valeurs : `snake_case` (`'resident'`, `'co_mod'`, `'demandeur'`, `'public'`)

2. **`snake_case` end-to-end (AR20)** [Source: architecture.md:482] : DB ↔ types générés ↔ JSON. **Aucun** mapping camelCase. Anti-D8 d'ajouter une couche d'adaptation.

3. **Multi-tenant J1 (AR7, NFR25)** [Source: architecture.md:273, 1029 ; prd.md:957] : `residence_id uuid not null references residences(id) on delete restrict` sur toutes les entités utilisateur. MVP mono-résidence (Darna) mais le scoping est en place. RLS isolation multi-résidence = différée V3.

4. **RLS sur 100% des tables (AR6)** [Source: architecture.md:286-287, 1028] : Exception unique `moderation_log` lecture publique (FR33 transparence). Tests RLS exhaustifs = Story 1.10 (Gap #7, ADR 0008 à venir).

5. **Soft-delete + audit (AR9, NFR17)** [Source: architecture.md:288, 1265-1266 ; prd.md:946] : Colonnes `deleted_at`, `deleted_by`, `deletion_reason`. Cascade décidée Gap #5 [architecture.md:1388-1398] :
   - Profil supprimé → cascade FK
   - Admission validée → `user_id → NULL` dans `moderation_log` (anonymisation, garde la preuve)
   - Pas de DELETE physique côté client (RLS bloque)

6. **Bridge `public.users` ↔ `auth.users`** : pattern Supabase standard `public.users.id uuid references auth.users(id) on delete cascade`. Trigger auto-provisioning sur `auth.users insert` (cf. T4). `app_metadata.role` + `app_metadata.residence_id` peuplés via `supabase.auth.admin.updateUserById()` côté service role lors de validation admission (Story 1.8).

7. **Types générés versionnés (AR8)** [Source: architecture.md:270, 482, 571, 895] : `lib/supabase/types.generated.ts` commit obligatoire après chaque migration. Pas gitignored.

### Versions verrouillées (vérifiées mai 2026 — ne pas dévier sans ADR)

[Source: architecture.md#Versions-vérifiées-recherche-web-mai-2026]

- **Supabase CLI** : `npx supabase@latest` (aligné avec `release.yml` story 1.2). Local dev nécessite **Docker Desktop** (Postgres 15 + Auth + Storage). Pas en devDep du projet (impact bundle size, et binaire natif).
- **`@supabase/supabase-js` 2.x** + **`@supabase/ssr`** déjà installés (story 1.1). Pas de bump requis.
- **Postgres 15** (Supabase défaut). Extensions disponibles : `pgcrypto` (UUIDs), `uuid-ossp`, `pg_trgm` (FTS Epic 2). En 1.3 : juste `pgcrypto`.
- **Nouvelles clés Supabase** (AR3) : `sb_publishable_*` / `sb_secret_*` (anciennes `anon`/`service_role` dépréciées fin 2026). Déjà validées par `lib/env.ts` (story 1.1).

### Patterns de code à réutiliser depuis 1.1/1.2

- **Clients Supabase** : `lib/supabase/server.ts`, `client.ts`, `proxy.ts` déjà câblés via `env.client.NEXT_PUBLIC_*`. 1.3 ajoute juste le générique `<Database>` du `types.generated.ts`. **Ne PAS** réintroduire `process.env.X!` ou `hasEnvVars` (auth bypass critique fixé en review 1.1).
- **Validation Zod (AR17)** : `lib/validation/{email,villa-number,phone-e164}.ts` réutilisables pour les futurs Server Actions admission (Story 1.7). En 1.3 : pas de Server Action, mais les schémas Zod **doivent matcher** les contraintes DB (ex: `zVillaNumber` (1-150 int) ↔ `profiles.villa int check (villa between 1 and 150)`).
- **Logger structuré** : `lib/logger.ts` avec PII strip — utile si on veut tracer les inserts admission (out-of-scope 1.3, sera utilisé en 1.7).
- **Tests Vitest co-localisés** `*.test.ts`. Setup `tests/setup.ts` charge déjà les env stubs (story 1.1 review).

### Out-of-scope (NE PAS livrer dans cette story)

| Élément                                                                                   | Story              | Raison                                       |
| ----------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------- |
| Server Actions admission (`createAdmissionRequest`, `acceptAdmission`, `rejectAdmission`) | 1.7 / 1.8          | Story dédiée                                 |
| Magic-link e-mail Brevo                                                                   | 1.6                | Auth dédiée                                  |
| Script `scripts/invite-co-mods.ts`                                                        | 1.6 ou 1.8         | Provisioning post-deploy                     |
| Tests RLS exhaustifs (alice/bob/eve × 7 tables)                                           | 1.10               | Gap #7, ADR 0008                             |
| FTS GIN tsvector (annuaire bilingue)                                                      | Epic 2 (story 2.1) | Tables artisans                              |
| Extension `moderation_log` avec actions Epic 5                                            | Story 5.1          | `ALTER TYPE moderation_action ADD VALUE ...` |
| UI prefs notifications (3 toggles)                                                        | 7.1                | UI dédiée, schema livré par 1.3              |
| Page admission UI (formulaire demandeur)                                                  | 1.7                | UI dédiée                                    |
| Queue co-mod UI                                                                           | 1.8                | UI dédiée                                    |
| Page transparence                                                                         | 8.1                | UI lecture `moderation_log`                  |
| Export RGPD JSON self-service                                                             | 8.3                | Story dédiée                                 |
| Purge automatique logs J+30                                                               | 8.5                | Cron Vercel dédié                            |
| ADR 0004 (schema 1.3) à formaliser dans `docs/adr/`                                       | 1.10               | Hardening batch                              |

> **Anti-scope-bleed (leçon 1.1 → ADR 0003)** : si un task semble nécessiter quelque chose hors de la liste ci-dessus, **arrêter et demander**. La review 1.1 a découvert que toute la story 1.2 avait été livrée silencieusement. À éviter ici.

### Project Structure Notes

[Source: architecture.md#Complete-Project-Directory-Structure]

Pour cette story 1.3, on livre :

```
SmartResidence/
├── supabase/                            # NEW — Supabase CLI workspace
│   ├── config.toml                      # NEW — local dev config (port, region)
│   ├── migrations/                      # NEW
│   │   ├── 20260601000001_init_enums.sql
│   │   ├── 20260601000002_init_schema.sql
│   │   ├── 20260601000003_init_rls.sql
│   │   ├── 20260601000004_init_indexes.sql
│   │   ├── 20260601000005_init_triggers.sql
│   │   └── 20260601000006_seed_residence.sql
│   ├── seed.sql                         # vide ou commenté (seed via migration)
│   └── .gitignore                       # NEW — ignore .branches/, .temp/
├── lib/
│   └── supabase/
│       ├── client.ts                    # MODIFIED — ajoute générique <Database>
│       ├── server.ts                    # MODIFIED — ajoute générique <Database>
│       ├── proxy.ts                     # MODIFIED — ajoute générique <Database>
│       ├── types.generated.ts           # NEW — output de pnpm gen:types
│       └── README.md                    # MODIFIED — retire mention "stub"
├── scripts/
│   └── generate-types.sh                # MODIFIED — câble la vraie commande
├── tests/
│   └── rls.test.ts                      # NEW (optionnel — test RLS minimal)
└── .gitignore                           # MODIFIED — ajouter supabase/.branches, supabase/.temp
```

**Variance avec architecture.md** : aucune. Tous les paths alignés avec architecture.md:941-948.

### Latest Tech Information (mai 2026)

**Supabase CLI workflow local-first** [Source: architecture.md:1108-1131] :

1. `pnpm supabase start` → boot Docker (Postgres + Auth + Storage + Studio sur ports custom)
2. `pnpm supabase migration new <name>` → fichier `supabase/migrations/<timestamp>_<name>.sql` vide
3. Édition SQL
4. `pnpm supabase db reset` → drop + recrée tout depuis migrations (idempotence assurée)
5. `pnpm gen:types --local` → régénère `types.generated.ts`
6. Commit migrations + types ensemble

**Production deploy** : tag `release-vX.Y` → `.github/workflows/release.yml` (story 1.2) exécute `npx supabase db push --linked` → migrations appliquées sur Supabase Cloud EU. Secrets requis : `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` (déjà documentés dans `.env.example` ? À vérifier, sinon les ajouter).

**`supabase gen types typescript` flags** :

- `--local` : utilise la DB Docker locale (dev)
- `--linked` : utilise le projet Supabase Cloud lié (CI/post-deploy)
- `--project-id <ref>` : alternative à `--linked`

**`SECURITY DEFINER` pour `moderation_log` writes** [Source: architecture.md:1028] : les écritures dans `moderation_log` (story 1.8+) passeront par des fonctions Postgres `SECURITY DEFINER` (exécutées avec les droits du créateur, donc bypass RLS write-protection). En 1.3 : on prépare le terrain mais on n'écrit pas ces fonctions (story dédiée).

**Auth Hook pattern (custom claims)** : pour peupler `app_metadata.role` + `app_metadata.residence_id` dans le JWT, deux approches :

- (a) `supabase.auth.admin.updateUserById(id, { app_metadata: { role: 'co_mod', residence_id } })` côté service role (Story 1.6 ou 1.8) — **choisi pour le MVP** (simple, pas de Hook à configurer)
- (b) Auth Hook custom claims (config dashboard Supabase) — différé V3 quand multi-résidence

### Testing Requirements

[Source: architecture.md#Process-Patterns-Validation]

- **Pas de Server Action en 1.3** → pas de test unit Vitest dédié business logic
- **Tests RLS** : test minimal en T10 (alice/bob, même résidence, demandeur ne lit que la sienne). Test exhaustif = Story 1.10.
- **Tests typage** : `pnpm typecheck` couvre — `lib/supabase/server.ts` consommera `Database` du `types.generated.ts`, donc une migration cassante = compile error détecté localement.
- **Tests d'idempotence migrations** : `pnpm supabase db reset` 2× consécutifs sans erreur (T12)
- **Tests CI** : `.github/workflows/ci.yml` (story 1.2) ne lance pas `supabase` en CI (pas de Docker) — la validation migration prod = `release.yml` sur tag. Donc test RLS local-only sauf à étendre CI (out-of-scope 1.3).

### Previous Story Intelligence

**Story 1.1 (done)** — déjà livré :

- Clients Supabase câblés via `env.client` (review 1.1 a corrigé l'usage `process.env.X!`)
- `lib/env.ts` valide `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (sb\_\*) au module-load
- 3 schémas Zod réutilisables (`zEmail`, `zVillaNumber` (1-150), `zPhoneMaroc` (`+212[567]\d{8}`))
- `tests/setup.ts` stub déjà les env vars Supabase (pas besoin de re-stub en 1.3)
- `scripts/generate-types.sh` STUB existe avec la commande cible commentée
- `pnpm gen:types` script déjà déclaré dans `package.json`

**Story 1.2 (done — bundle 1.1, ADR 0003)** — déjà livré :

- `.github/workflows/release.yml` exécute `npx supabase db push --linked` sur tag `release-*`
- GlitchTip prêt à capter erreurs RLS / migrations
- `lib/logger.ts` avec PII strip (utile si on log un INSERT admission, mais c'est 1.7)
- Variables `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` (optionnelles) déjà dans `.env.example`

**Pièges à éviter (lessons 1.1/1.2)** :

- Ne **pas** réintroduire `process.env.X!` direct
- Ne **pas** dévier des conventions vendor sans ADR (Tailwind 3.4 ADR 0001, Vitest 4 ADR 0002)
- Ne **pas** étendre le scope vers 1.4 / 1.6 / 1.7 / 1.8 / 1.10 (leçon ADR 0003 sur bundle 1.1+1.2)
- Ne **pas** logger PII direct (`console.log(user.email)`) — passer par `lib/logger.ts`

### References

- **Story complète** : [Source: _bmad-output/planning-artifacts/epics.md:475-519]
- **Architectural Requirements clés** : AR5 (migrations), AR6 (RLS), AR7 (residence_id J1), AR8 (types générés), AR9 (soft-delete), AR15 (naming), AR20 (snake_case), AR34 (invite script) [Source: _bmad-output/planning-artifacts/epics.md:185-222]
- **Conventions DB complètes** : [Source: _bmad-output/planning-artifacts/architecture.md:374-384]
- **Migrations init nommées** : [Source: _bmad-output/planning-artifacts/architecture.md:942-948]
- **Workflow local-first Supabase** : [Source: _bmad-output/planning-artifacts/architecture.md:1108-1131]
- **Génération types** : [Source: _bmad-output/planning-artifacts/architecture.md:270, 482, 571, 895, 990, 1111]
- **Multi-tenant J1 (NFR25)** : [Source: _bmad-output/planning-artifacts/prd.md:957]
- **Soft-delete + cascade (Gap #5)** : [Source: _bmad-output/planning-artifacts/architecture.md:1388-1398]
- **Tests RLS différés (Gap #7)** : [Source: _bmad-output/planning-artifacts/architecture.md:1400-1410]
- **Seed pattern (Gap #6)** : [Source: _bmad-output/planning-artifacts/architecture.md:1466-1476]
- **FR40 notifications 3 catégories** : [Source: _bmad-output/planning-artifacts/prd.md:895]
- **Workflow admission UX** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md:799-887]
- **ADR 0003 bundle 1.1+1.2** : [Source: docs/adr/0003-bundle-story-1-1-and-1-2.md] — contexte anti-scope-bleed

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context)

### Debug Log References

- **Timestamps migrations** : la spec listait des timestamps fictifs `20260601000001..6`. CLI Supabase utilise le timestamp courant à `migration new`, j'ai donc obtenu `20260524005527..05`. L'ordre lexicographique est préservé (les 6 fichiers sont dans la même minute), AC1 satisfaite. Pas de renommage pour ne pas casser les checksums.
- **Colima crash après premier `supabase start`** : la première session a fini exit 0 puis Colima est sorti seul (probablement OOM ou veille système). Restart via `colima start` + `supabase start` à nouveau a réussi.
- **`supabase_vector` échec de mount Docker socket sous Colima** : le container Logflare/Vector (collecteur de logs interne) tente de mounter `/var/run/docker.sock` du host, ce qui échoue avec Colima (le socket vit dans une VM Lima). Désactivé `analytics.enabled = false` dans `supabase/config.toml` — non requis pour story 1.3 (Logflare est un outil de debug Studio local, l'analytics prod est gérée par Supabase Cloud).
- **RLS test alice/bob — Multiple GoTrueClient sessions** : alice et bob partageaient la même `storage` par défaut, donc le `signInWithPassword` de bob écrasait la session d'alice → l'INSERT d'alice était fait avec le JWT de bob, viole `auth.uid() = user_id`. Fix : passer `auth.storageKey: 'rls-test-alice'` / `'rls-test-bob'` distincts dans `createClient`.
- **Bridge `public.users ↔ auth.users` — trigger DB-side** : choisi (a) trigger SECURITY DEFINER sur `auth.users INSERT` qui provisionne `public.users` + `public.notifications_prefs` plutôt que (b) Auth Hook custom claims. Raison : (a) idempotent localement + visible dans les migrations ; (b) nécessite config dashboard Supabase non versionnable. `app_metadata.residence_id` figé à l'UUID Darna côté trigger MVP, V3 lira `raw_app_meta_data->>'residence_id'` (TODO commenté inline).
- **`moderation_log` immutable** : pas de `updated_at` (log append-only par design), donc pas de trigger `trg_moderation_log_updated_at`. Cohérent avec FR33 transparence.
- **`scripts/generate-types.sh` — modes `local` / `linked`** : remplacé le stub par un wrapper qui prend `local` (défaut, via `supabase start`) ou `linked` (via `supabase link --project-ref`). Header `AUTO-GENERATED — DO NOT EDIT` ajouté avant les types.
- **2× `db reset` idempotent validé** : NOTICE `extension "pgcrypto" already exists, skipping` (attendu, géré par `create extension if not exists`). Aucun side-effect entre runs.

### Completion Notes List

✅ **6 migrations versionnées** appliquent successivement sans erreur (`init_enums`, `init_schema`, `init_rls`, `init_indexes`, `init_triggers`, `seed_residence`). `pnpm supabase db reset` idempotent (2 runs consécutifs OK).

✅ **6 tables avec RLS activée** validées via SQL : `select tablename, rowsecurity from pg_tables where schemaname='public'` → `t` partout.

✅ **14 policies RLS** créées strictement selon naming AR15 `<table>_<role>_<action>` (4 demandeur/co_mod sur `admission_requests`, 3 self sur `users`, 2 self/résidence sur `profiles`, 1 public sur `moderation_log`, 3 self sur `notifications_prefs`, 1 public sur `residences`).

✅ **5 ENUMs** : `user_role`, `admission_state`, `admission_decision_reason`, `admission_contact_channel`, `moderation_action`.

✅ **6 indexes `idx_*`** : file co-mod (`residence_id, state`), lookup self, scope résidence × 2, transparence (`residence_id, created_at desc`), prefs multi-tenant.

✅ **6 triggers `trg_*`** : 5 `updated_at` (résidences/users/profiles/admission_requests/notifications_prefs) + 1 `auth_users_after_insert` (auto-provisioning bridge).

✅ **Seed résidence Darna** : UUID stable `00000000-0000-0000-0000-000000000001`, idempotent via `on conflict do nothing`. AUCUN user/co-mod en SQL (AR34 respecté).

✅ **Types TypeScript générés** : `lib/supabase/types.generated.ts` (572 lignes) via `pnpm gen:types`, versionné, `snake_case` end-to-end (AR8, AR20). Clients Supabase (server.ts, client.ts, proxy.ts) typés avec `<Database>` générique.

✅ **Test RLS minimal vert** : `tests/rls.test.ts` avec `SUPABASE_LOCAL_TEST=true` → alice lit sa demande, bob retourne 0 rows (RLS bloque). Skip automatique sans Docker (CI-safe).

✅ **Pipeline complète verte** : `pnpm typecheck` + `pnpm lint` + `pnpm test` (23 verts + 2 RLS skipped). RLS test passe en local avec env vars.

✅ **`lib/supabase/README.md` mis à jour** : workflow local-first documenté, bridge `public.users ↔ auth.users` expliqué, lien vers ADRs, lien vers spec RLS Story 1.10.

✅ **Anti-scope-bleed respecté** (leçon ADR 0003) : pas de Server Actions admission (1.7/1.8), pas de magic-link Brevo (1.6), pas de tests RLS exhaustifs alice/bob/eve × 7 tables (1.10), pas d'invite-co-mods script (1.6/1.8), pas de FTS GIN (Epic 2). Strictement le périmètre 1.3.

📋 **Note Stephane** : story 1-2 a été marquée `done` par toi pendant l'exécution de 1.3 (sprint-status sync 2026-05-24 10:15Z). Story 1-4 a été marquée `ready-for-dev` (pré-création probable). Sprint cohérent au sortir de 1.3.

### File List

**Migrations Supabase (NEW)** :

- `supabase/config.toml` (init via `npx supabase init`, modifié : `analytics.enabled = false`)
- `supabase/.gitignore` (auto-créé par init)
- `supabase/migrations/20260524005527_init_enums.sql`
- `supabase/migrations/20260524005559_init_schema.sql` (6 tables + auth bridge trigger)
- `supabase/migrations/20260524005600_init_rls.sql`
- `supabase/migrations/20260524005601_init_indexes.sql`
- `supabase/migrations/20260524005603_init_triggers.sql`
- `supabase/migrations/20260524005605_seed_residence.sql`

**Types générés (NEW, versionnés AR8)** :

- `lib/supabase/types.generated.ts` (572 lignes)

**Modifiés** :

- `lib/supabase/client.ts` (ajout `<Database>` générique)
- `lib/supabase/server.ts` (ajout `<Database>` générique)
- `lib/supabase/proxy.ts` (ajout `<Database>` générique)
- `lib/supabase/README.md` (workflow local-first + bridge auth documentés)
- `scripts/generate-types.sh` (câblé : modes `local` / `linked`, header auto-generated)

**Tests (NEW)** :

- `tests/rls.test.ts` (test RLS minimal alice/bob, skip auto si `SUPABASE_LOCAL_TEST != 'true'`)

### Change Log

- **2026-05-24** — Story créée par `bmad-create-story` (Opus 4.7, 1M context, 4 agents d'analyse parallèles : epics / architecture / UX-PRD / previous-story-intel). Status : `ready-for-dev`.
- **2026-05-24** — Story implémentée par `bmad-dev-story` (Opus 4.7). 6 migrations versionnées + 6 tables + 14 RLS policies + 5 ENUMs + 6 indexes + 6 triggers + auth bridge + seed Darna + types générés + clients typés + test RLS minimal. Pipeline vert (typecheck/lint/test/db reset×2 idempotent). Status : `review`.
- **2026-05-24** — Code review par `bmad-code-review` (Opus 4.7, 3 layers parallèles : Blind Hunter + Edge Case Hunter + Acceptance Auditor). 76 findings bruts → triés : 5 decision-needed, 23 patch, 7 defer, 41 dismissed. 4 critiques identifiés (escalade de privilèges, auto-validation admission, fragilité auth bridge). Status : `in-progress` jusqu'à résolution.
- **2026-05-24** — Patches appliqués + 5 décisions tranchées : (D1) revert PG17 → PG15, (D2) `enable_signup = false` magic-link only via service_role, (D3) sous-requête conservée avec TODO Story 1.8, (D4) `actor_id` UUID public accepté (transparence FR33), (D5) trigger laissé, invite-co-mod fera UPDATE post-création. Tous les patches verts : 6 migrations idempotent (PG15.8) × 2, `gen:types` OK (580 lignes), `typecheck`/`lint`/`test` verts (23 + 5 RLS adversariaux). Status : `done`.

### Review Findings

> **Source** : code review parallèle 2026-05-24 par 3 reviewers indépendants (Blind / Edge Case / Acceptance). Triage consolidé. Format : `[Review][Type][Sévérité] Titre [fichier:ligne]`.

#### Decisions à trancher (5)

- [x] **[Review][Decision][medium] Postgres major_version 17 vs spec PG15** — `supabase/config.toml:42` exécute en PG17 alors que la spec/architecture verrouille PG15. Soit (a) rédiger un ADR « bump PG17 », soit (b) revenir à `major_version = 15`. Risque : divergence local↔Supabase Cloud si projet cloud reste sur PG15.
- [x] **[Review][Decision][critical] enable_signup=true + enable_confirmations=false ouvre signup spam** — `supabase/config.toml:177,227` permet à n'importe quel email de créer un compte `auth.users` qui déclenche le trigger (provisionne `public.users` + `notifications_prefs`) sans validation. Si le flow MVP est magic-link only, il faut soit (a) désactiver complètement le password (enable_signup=false côté password, magic-link via `signInWithOtp`), soit (b) activer `enable_confirmations=true`, soit (c) ajouter captcha. Couplé avec rate_limit.email_sent=2/h qui est par ailleurs trop bas.
- [x] **[Review][Decision][medium] `profiles_resident_select_residence` utilise sous-requête au lieu du JWT** — `supabase/migrations/20260524005600_init_rls.sql:55-61` lit `residence_id` via `(select residence_id from public.users where id = auth.uid())` au lieu de `public.auth_residence_id()`. Refactor maintenant pour cohérence avec policies co_mod, ou attendre Story 1.8 quand `app_metadata.residence_id` sera peuplé ? Impact perf à l'échelle annuaire résidence.
- [x] **[Review][Decision][medium] `moderation_log.actor_id` UUID public expose les co-mods** — La policy `moderation_log_public_select using (true)` (FR33 transparence) expose `actor_id` (= `auth.users.id`). Corrélable avec d'autres lectures publiques. Soit (a) accepter le risque (UUIDs opaques), soit (b) exposer un alias hashé/tronqué via vue, soit (c) restreindre la lecture publique à un sous-ensemble de colonnes (sans `actor_id`). À trancher avant Story 1.8 (premier writer).
- [x] **[Review][Decision][high] Trigger `handle_new_auth_user` force `role='demandeur'` pour TOUS les nouveaux comptes** — `supabase/migrations/20260524005559_init_schema.sql:635`. Quand `scripts/invite-co-mods.ts` (Story 1.6/1.8) appellera `auth.admin.createUser({ email })` pour inviter un co-mod, le trigger écrira `role='demandeur'` AVANT que `updateUserById` ne mette le claim `app_metadata.role='co_mod'`. Soit (a) le script invite-co-mods fait un `UPDATE public.users SET role='co_mod'` après création (workflow simple, à documenter en 1.6/1.8), soit (b) le trigger lit `new.raw_app_meta_data->>'role'` pour respecter l'intent au moment du create.

#### Patches à appliquer (23)

- [x] **[Review][Patch][critical] `users_resident_update_self` permet auto-promotion en co_mod** [`supabase/migrations/20260524005600_init_rls.sql:705-708`] — Un demandeur authentifié peut `update users set role='co_mod', residence_id='<autre>' where id = auth.uid()`. Fix : trigger `BEFORE UPDATE` qui rejette mutations sur `role`, `residence_id`, `deleted_at`, `deleted_by` hors d'un contexte privilégié, OU column-level `REVOKE UPDATE (role, residence_id) ON public.users FROM authenticated`.
- [x] **[Review][Patch][critical] `admission_requests_demandeur_insert` permet auto-validation** [`supabase/migrations/20260524005600_init_rls.sql:738-740`] — Aucune contrainte sur `state` ni `decided_*` : un demandeur peut INSERT `state='accepted', decided_by=self, decided_at=now()` et bypass le flow co-mod. Fix : `WITH CHECK (auth.uid() = user_id AND state = 'pending' AND decision_reason IS NULL AND decided_by IS NULL AND decided_at IS NULL AND residence_id = public.auth_residence_id())`.
- [x] **[Review][Patch][critical] `handle_new_auth_user` sans gestion d'erreur casse signup auth silencieusement** [`supabase/migrations/20260524005559_init_schema.sql:623-648`] — Toute exception dans le trigger (FK manquante, doublon, CHECK) ROLLBACK la création `auth.users`. L'utilisateur reçoit 500 brute, pas de log. Fix : wrapper `BEGIN ... EXCEPTION WHEN others THEN RAISE WARNING '...', SQLERRM; END;` + idéalement INSERT dans une table `auth_provisioning_errors` pour Sentry.
- [x] **[Review][Patch][critical] `handle_new_auth_user` sans ON CONFLICT casse restauration `auth.users`** [`supabase/migrations/20260524005559_init_schema.sql:635-639`] — Restaurer un user depuis backup déclenche INSERT en violation PK. Fix : `INSERT INTO public.users (...) VALUES (...) ON CONFLICT (id) DO NOTHING` + idem `notifications_prefs`.
- [x] **[Review][Patch][high] `admission_requests_co_mod_update` permet réécrire user_id/villa/created_at** [`supabase/migrations/20260524005600_init_rls.sql:749-758`] — Un co_mod peut détourner une admission en réattribuant `user_id`. Fix : trigger `BEFORE UPDATE` qui rejette mutation de `user_id`, `residence_id`, `villa`, `first_name`, `created_at` (colonnes immutables après création).
- [x] **[Review][Patch][high] `profiles_resident_select_residence` ne filtre pas `deleted_at` + n'exclut pas les demandeurs en attente** [`supabase/migrations/20260524005600_init_rls.sql:55-61`] — (1) Soft-delete CNDP cassé : un user soft-deleted ou un profil soft-deleted reste visible. (2) Un `demandeur` (post-trigger, pre-validation co-mod) a déjà sa `residence_id` Darna et peut lire l'annuaire complet AVANT acceptation. Fix : ajouter `AND deleted_at IS NULL` + condition `(select role from public.users where id = auth.uid()) IN ('resident', 'co_mod')`.
- [x] **[Review][Patch][high] REVOKE EXECUTE sur `handle_new_auth_user` manquant** [`supabase/migrations/20260524005559_init_schema.sql:623-648`] — Fonction SECURITY DEFINER appelable par n'importe quel rôle ayant accès au schéma public. Fix : `REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM public, authenticated, anon;` après création.
- [x] **[Review][Patch][high] `tests/rls.test.ts` ne teste que SELECT, manque les attaques INSERT/UPDATE** [`tests/rls.test.ts:1795-1806`] — Aucun test n'aurait attrapé les findings Patch #1, #2, #5. Fix : ajouter au minimum 3 tests rouges : (a) demandeur tente INSERT `state='accepted'`, (b) demandeur tente UPDATE `role='co_mod'` sur lui-même, (c) co_mod tente UPDATE `user_id` d'une admission.
- [x] **[Review][Patch][medium] `auth_residence_id()` crash sur JWT mal formé** [`supabase/migrations/20260524005600_init_rls.sql:672-678`] — Si `app_metadata.residence_id` contient une chaîne non-UUID, le cast `::uuid` lève `invalid_text_representation` à chaque query touchant une policy co_mod. Fix : wrapper PL/pgSQL avec `EXCEPTION WHEN invalid_text_representation THEN RETURN NULL`.
- [x] **[Review][Patch][medium] `auth_role()` / `auth_residence_id()` : commentaire annonce SECURITY DEFINER mais code ne l'a pas** [`supabase/migrations/20260524005600_init_rls.sql:664-678`] — Commentaire ment. Fix : soit retirer la mention SECURITY DEFINER du commentaire (les fonctions sont SQL stable, le planner peut quand même cacher), soit appliquer `SECURITY DEFINER set search_path = ''`.
- [x] **[Review][Patch][medium] `rate_limit.email_sent = 2` par heure global = DoS trivial** [`supabase/config.toml:199-200`] — 2 magic-links/h GLOBAL bloque la 3ème inscription. Fix : monter à 30/h global (ou utiliser `email_sent_per_recipient` si disponible).
- [x] **[Review][Patch][medium] CHECK NOT NULL manquant sur `decided_by`/`decided_at` quand state != pending** [`supabase/migrations/20260524005559_init_schema.sql:570-575`] — Un UPDATE peut passer `state='accepted'` sans renseigner acteur ni timestamp. Audit cassé. Fix : étendre `admission_requests_state_decision_check` pour `(state IN ('accepted','rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL) OR state = 'pending'`.
- [x] **[Review][Patch][medium] Filtrer `deleted_at IS NULL` dans `residences_public_select` et `moderation_log_public_select`** [`supabase/migrations/20260524005600_init_rls.sql:769-771,776-789`] — Soft-delete inappliqué côté lecture publique. Fix : `using (deleted_at IS NULL)` sur les deux policies (note : `moderation_log` n'a pas `deleted_at` actuellement — vérifier cohérence avec AC3 qui liste `moderation_log` comme soft-deletable).
- [x] **[Review][Patch][medium] `tests/rls.test.ts` consomme `process.env.SUPABASE_LOCAL_*` direct (régression principe 1.1)** [`tests/rls.test.ts:23-25`] — Dev Notes ligne 423 dit explicitement « Ne **pas** réintroduire `process.env.X!` direct ». Fix : ajouter un schéma Zod test-only dans `lib/env.ts` (ou un helper `lib/env-test.ts`) pour valider ces 3 vars + référencer depuis le test.
- [x] **[Review][Patch][medium] `generate-types.sh` ne valide pas la sortie de `npx supabase`** [`scripts/generate-types.sh:1693-1696`] — Si la stack Docker n'est pas démarrée, npx échoue mais `OUTPUT.tmp` contient le header puis rien (ou message d'erreur). Le `mv` est skip par `set -e` mais `.tmp` reste sur disque. Fix : `trap 'rm -f "$OUTPUT.tmp"' EXIT` + assertion `grep -q "export type Database" "$OUTPUT.tmp"` avant le `mv`.
- [x] **[Review][Patch][medium] `gen:types` doc dit `pnpm gen:types -- linked` mais script accepte aussi `pnpm gen:types linked`** [`scripts/generate-types.sh:1673`] — Confusion d'invocation. Fix : ajouter `case "$MODE" in local|linked) ;; *) echo "usage: $0 [local|linked]" >&2; exit 2 ;; esac` pour message d'erreur explicite.
- [x] **[Review][Patch][medium] `proxy.ts` swallow l'erreur de `getClaims()`** [`lib/supabase/proxy.ts:1569-1570`] — Si Supabase Auth est down (5xx, timeout), `data` est undefined et l'utilisateur est redirigé login (perte de session perçue). Fix : déstructurer `{ data, error }` et logger `error` via `lib/logger.ts` quand non-null.
- [x] **[Review][Patch][medium] `handle_new_auth_user` provisionne avant `email_confirmed_at` non-null** [`supabase/migrations/20260524005559_init_schema.sql:623-648`] — Couplé à la décision D2 : si on garde `enable_confirmations=false`, tout email crée des rows même non confirmé. Fix conditionnel à D2 : gate `if NEW.email_confirmed_at IS NOT NULL` (ou différer à `auth.users.UPDATE` quand confirmation arrive).
- [x] **[Review][Patch][medium] `profiles_resident_select_residence` : pas de policy SELECT pour co_mod** [`supabase/migrations/20260524005600_init_rls.sql`] — Un co_mod ne peut pas lister les profils de sa résidence (dépendance Story 1.8 modération). Fix : ajouter `profiles_co_mod_select_residence using (residence_id = public.auth_residence_id() AND deleted_at IS NULL)`.
- [x] **[Review][Patch][low] `set_updated_at` sans `set search_path = ''`** [`supabase/migrations/20260524005603_init_triggers.sql:5-12`] — Hygiène Postgres 15+ : fonction PL/pgSQL devrait figer son search_path. Fix : `set search_path = pg_catalog, public` (ou `''`).
- [x] **[Review][Patch][low] `residences.deleted_by` n'a pas de FK vers users** [`supabase/migrations/20260524005559_init_schema.sql:504`] — Incohérence avec les 4 autres tables. Fix : `deleted_by uuid references public.users(id) on delete set null`.
- [x] **[Review][Patch][low] `[db.seed]` configuré pointe vers `./seed.sql` inexistant** [`supabase/config.toml:67-71`] — Confusion : le seed Darna est rangé en migration. Fix : soit `enabled = false`, soit `sql_paths = []`.
- [x] **[Review][Patch][low] `additional_redirect_urls` autorise `https://127.0.0.1:3000` (TLS local désactivé)** [`supabase/config.toml:164`] — Copier-coller négligent. Fix : retirer (ou commenter avec note prod).

#### Deferred (7)

- [x] **[Review][Defer][critical] `proxy.ts` redirige `/api/*` vers `/auth/login` (302 HTML)** [`lib/supabase/proxy.ts:1572-1581`] — déféré, pré-existant story 1.1 (`deferred-work.md` ligne 11). Confirmé encore en 1.3 mais hors-scope.
- [x] **[Review][Defer][medium] column-level GRANT/REVOKE défense en profondeur** [`supabase/migrations/20260524005600_init_rls.sql`] — déféré, hardening Story 1.10 (consistent avec Gap #7 ADR 0008 différée).
- [x] **[Review][Defer][medium] `profiles.villa CHECK between 1 and 150` hard-codé vs `residences.villa_count`** [`supabase/migrations/20260524005559_init_schema.sql:536,557`] — déféré, Story V3 multi-résidence. MVP mono-résidence 150 villas → OK.
- [x] **[Review][Defer][low] Indexes manquants sur `decided_by`, `actor_id`, `target_id`** [`supabase/migrations/20260524005601_init_indexes.sql`] — déféré, perf à l'échelle multi-résidence V3.
- [x] **[Review][Defer][low] `deleted_by` self-FK SET NULL perd l'audit si acteur supprimé** [`supabase/migrations/20260524005559_init_schema.sql:525`] — déféré, cohérent avec Gap #5 (anonymisation) ; snapshot identifiant texte = Story 1.10 hardening.
- [x] **[Review][Defer][low] Trigger `auth.users` ne handle pas UPDATE (banned_until → deleted_at)** [`supabase/migrations/20260524005559_init_schema.sql:645-648`] — déféré, modération admin V1.5+ (out-of-scope MVP).
- [x] **[Review][Defer][low] `notifications_prefs` sans `created_at`** [`supabase/migrations/20260524005559_init_schema.sql:608-615`] — déféré, optionnel pour historique opt-in/out, ajustable V1.5 sans casser MVP.
