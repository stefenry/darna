# Story 2.1: Schéma artisans + ratings + tags bilingues + FTS Postgres

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **solo dev**,
I want **le schéma du domaine artisan (tables `artisans`, `ratings`, `tags`, `artisan_tags`, `artisan_consent_tokens`), avec tags bilingues FR/AR, notation typée 4 axes, index FTS Postgres, RLS multi-tenant et tokens de consentement, plus un utilitaire `slugify` déterministe**,
so that **toutes les features de l'Epic 2 (annuaire, fiche, création, consentement, notation, droit de réponse) reposent sur un modèle de données sain, performant et CNDP-compliant**.

C'est la **story fondation amont** de l'Epic 2 : les stories 2.2 → 2.8 consomment directement ce schéma. Aucune UI dans cette story — uniquement DDL, RLS, FTS, types générés, `lib/slug/`, et l'extension des tests RLS.

## Acceptance Criteria

> Source verbatim : `_bmad-output/planning-artifacts/epics.md` § « Story 2.1 » (l. 848-880). **Deux corrections techniques** par rapport au texte littéral des AC sont signalées en gras et détaillées en Dev Notes — elles priment sur la lettre de l'AC.

1. **AC1 — Tables.** Étant donné que la migration `<timestamp>_artisans_schema.sql` est appliquée, quand j'inspecte la base, alors les tables existent :
   - `artisans` : `id`, `slug`, `residence_id`, `display_name_fr`, `display_name_ar`, `phone_e164`, `price_relative` enum `$/$$/$$$/$$$$`, `has_invoice` enum `oui/non/sur_demande`, `state` enum `pending_consent/published/refused`, `published_at`, `created_by` (FK users), colonnes soft-delete.
   - `ratings` : `id`, `artisan_id`, `user_id`, `score_depannage` / `score_petits_travaux` / `score_travail_soigne` / `score_urgences` (1-5, **nullable par axe**), `comment_text`, `visibility` enum `pseudonym/named`, colonnes soft-delete.
   - `tags` : `id`, `key`, `label_fr`, `label_ar`.
   - `artisan_tags` : table de jointure (N-N artisans ↔ tags).
   - `artisan_consent_tokens` : `id`, `artisan_id`, `token_hash`, `expires_at`, `used_at`.
   - (AR5, AR7)
2. **AC2 — RLS rôle resident.** Étant donné que RLS est activée, quand je m'authentifie comme `resident` de la résidence X, alors je peux : SELECT les artisans où `residence_id=X AND state='published' AND deleted_at IS NULL` ; INSERT artisans où `residence_id=X AND created_by=auth.uid()` ; INSERT ratings où `user_id=auth.uid()` ; UPDATE/DELETE uniquement mes propres lignes. (AR6)
3. **AC3 — Isolation des `pending_consent`.** Étant donné les artisans en `pending_consent`, quand je m'authentifie comme `resident` et que je requête, alors je ne vois que **mes propres** soumissions en attente (celles des autres résidents sont masquées jusqu'au consentement de l'artisan).
4. **AC4 — Index FTS.** Étant donné la migration FTS, quand j'inspecte les index, alors des index **GIN** existent pour la recherche bilingue sur les noms d'artisans et sur les commentaires de ratings, **plus un index `pg_trgm` sur `phone_e164`** pour la déduplication. **Correction technique (voir Dev Notes §FTS) :** config `french` pour le FR et **`simple` pour l'AR** (Postgres n'a pas de config `arabic` — ADR 0001) ; le tsvector des commentaires vit sur `ratings`, pas sur `artisans`. (AR5)
5. **AC5 — Slugify.** Étant donné que `lib/slug/slugify.ts` est implémenté, quand j'appelle `slugify("Hassan le Plombier")` ou `slugify("حسن السباك")`, alors j'obtiens **`hassan-le-plombier`** et **`hsn-lsbk`** (ASCII kebab-case translittéré) de façon déterministe, avec gestion de collision par suffixe `-2`, `-3`. (AR15)
6. **AC6 — Tests slugify.** Étant donné que `lib/slug/slugify.test.ts` est commité, quand Vitest s'exécute, alors les cas limites passent : diacritiques FR, lettres arabes, scripts mixtes, noms très longs tronqués à 60 caractères.
7. **AC7 — Types générés.** Et les types sont régénérés via `pnpm run gen:types`, et `lib/supabase/types.generated.ts` est commité avec les nouvelles tables. (AR8)

### AC additionnel (régression — obligatoire, non écrit dans l'epic mais requis pour que le système reste cohérent)

8. **AC8 — Tests RLS étendus.** `tests/rls.test.ts` est étendu avec une suite `artisans`/`ratings` qui prouve l'isolation cross-résidence et cross-user (un résident d'une autre résidence ne voit pas / ne peut pas écrire ; un résident ne peut pas écrire la ligne d'un autre ; les `pending_consent` d'autrui sont invisibles). ADR 0008 mandate explicitement l'ajout de ces tables à ce fichier dès epic 2.1. `pnpm typecheck` et `pnpm test` restent verts.

## Tasks / Subtasks

- [x] **Task 1 — ENUMs du domaine artisan** (AC: 1)
  - [x] Ajouter au fichier de migration (en tête, avant les `create table`) les 4 nouveaux types : `create type public.artisan_price_relative as enum ('$','$$','$$$','$$$$');`, `create type public.artisan_has_invoice as enum ('oui','non','sur_demande');`, `create type public.artisan_state as enum ('pending_consent','published','refused');`, `create type public.rating_visibility as enum ('pseudonym','named');`. Valeurs en `snake_case`/littéral exact (AR15). NE PAS recréer `moderation_action` : `'rating_removed'` et `'comment_removed'` y existent déjà.
- [x] **Task 2 — Table `tags` + seed référentiel** (AC: 1)
  - [x] `create table public.tags` : `id uuid pk default gen_random_uuid()`, `key text not null unique`, `label_fr text not null`, `label_ar text` (nullable au MVP FR-only, slot AR prêt V1.5), `created_at timestamptz not null default now()`. Pas de `residence_id` (référentiel global partagé) — voir Dev Notes.
  - [x] Seed idempotent d'un jeu de tags de compétences de départ (ex. `plomberie`, `electricite`, `peinture`, `menuiserie`, `maconnerie`, `jardinage`, `climatisation`, `serrurerie`) via `insert ... on conflict (key) do nothing;` **dans la migration** (pas de `seed.sql` séparé — voir Dev Notes §Seed).
- [x] **Task 3 — Table `artisans`** (AC: 1, 2, 3)
  - [x] Colonnes exactes (cf. AC1) + discipline maison : `residence_id uuid not null references public.residences(id) on delete restrict` (AR7), quatuor soft-delete (`deleted_at`/`deleted_by`/`deletion_reason`), `created_at`/`updated_at timestamptz not null default now()`. `slug text not null unique`. `created_by uuid not null references public.users(id) on delete set null` (anonymisation contributeur, ADR 0006). `published_at timestamptz`. `display_name_ar` nullable.
  - [x] CHECK : `price_relative`/`has_invoice`/`state` typés par les ENUMs Task 1.
- [x] **Task 4 — Table `ratings`** (AC: 1, 2)
  - [x] 4 colonnes `score_* smallint` nullables avec `check (score_x between 1 and 5)` chacune. CHECK « ≥ 1 axe noté » : `check (num_nonnulls(score_depannage, score_petits_travaux, score_travail_soigne, score_urgences) >= 1)`.
  - [x] `artisan_id uuid not null references public.artisans(id) on delete cascade`, `user_id uuid references public.users(id) on delete set null` (**nullable** pour anonymisation purge, ADR 0006), `residence_id uuid not null references public.residences(id) on delete restrict` (AR7), `comment_text text`, `visibility rating_visibility not null default 'pseudonym'`, quatuor soft-delete + timestamps.
  - [x] `unique (artisan_id, user_id)` — une note par (artisan, contributeur) ; l'UX prévoit « mise à jour » et non doublon. (NULLs distincts en Postgres → OK pour lignes anonymisées.)
- [x] **Task 5 — Tables `artisan_tags` et `artisan_consent_tokens`** (AC: 1)
  - [x] `artisan_tags` : `artisan_id uuid not null references public.artisans(id) on delete cascade`, `tag_id uuid not null references public.tags(id) on delete restrict`, `primary key (artisan_id, tag_id)`.
  - [x] `artisan_consent_tokens` : `id uuid pk`, `artisan_id uuid not null references public.artisans(id) on delete cascade`, `residence_id uuid not null references public.residences(id) on delete restrict` (cohérence tenant), `token_hash text not null`, `expires_at timestamptz not null`, `used_at timestamptz`, `created_at timestamptz not null default now()`. AUCUNE policy client (écriture/lecture réservées service-role — stories 2.4/2.5).
- [x] **Task 6 — Triggers `updated_at`** (AC: 1)
  - [x] `create trigger trg_artisans_updated_at before update on public.artisans for each row execute function public.set_updated_at();` (réutiliser la fonction partagée existante — NE PAS la recréer). Idem `trg_ratings_updated_at`. Pas de trigger sur `tags`/`artisan_tags`/`artisan_consent_tokens` (pas d'`updated_at` métier requis ; `tags` peut en avoir un si tu lui ajoutes `updated_at`, sinon non).
- [x] **Task 7 — Index** (AC: 4)
  - [x] `create extension if not exists pg_trgm;` (sur le modèle du `pgcrypto` existant).
  - [x] FTS noms artisans (colonne générée + GIN) : `display_name_fr_tsv tsvector generated always as (to_tsvector('french', coalesce(display_name_fr,''))) stored` + `display_name_ar_tsv tsvector generated always as (to_tsvector('simple', coalesce(display_name_ar,''))) stored`, puis `create index idx_artisans_display_name_fr_tsv on public.artisans using gin (display_name_fr_tsv);` et `idx_artisans_display_name_ar_tsv` (GIN). **`simple`, pas `arabic`** (ADR 0001).
  - [x] FTS commentaires ratings : `comment_tsv tsvector generated always as (to_tsvector('french', coalesce(comment_text,''))) stored` + `create index idx_ratings_comment_tsv ... using gin (comment_tsv);`.
  - [x] Dédup téléphone : `create index idx_artisans_phone_e164_trgm on public.artisans using gin (phone_e164 gin_trgm_ops);`.
  - [x] Index de scope/tri (AR15 `idx_<table>_<cols>`) : `idx_artisans_residence_id_state` sur `(residence_id, state)`, `idx_artisans_created_at` sur `(created_at desc)`, `idx_ratings_artisan_id_created_at` sur `(artisan_id, created_at)`, `idx_artisan_tags_tag_id` sur `(tag_id)`.
- [x] **Task 8 — RLS** (AC: 2, 3)
  - [x] `enable row level security` sur les 5 nouvelles tables.
  - [x] `artisans` : `artisans_resident_select_published` (SELECT `state='published' and deleted_at is null and residence_id = <résidence du resident>` — voir template Dev Notes), `artisans_resident_select_own_pending` (SELECT ses propres `pending_consent` : `created_by = auth.uid() and deleted_at is null`), `artisans_co_mod_select_residence`, `artisans_resident_insert` (with check `residence_id = <sa résidence> and created_by = auth.uid()`), `artisans_resident_update_own` / pas de policy DELETE (soft-delete via UPDATE). REVOKE/GRANT column-level sur INSERT et UPDATE (voir Dev Notes §RLS).
  - [x] `ratings` : `ratings_resident_select_residence` (lecture des notes des artisans publiés de sa résidence, `deleted_at is null`), `ratings_resident_insert` (with check `user_id = auth.uid()` + résidence), `ratings_resident_update_own` (`user_id = auth.uid()`). REVOKE total puis GRANT des seules colonnes autorisées (`artisan_id, user_id, residence_id, score_*, comment_text, visibility`) — jamais de colonnes de modération.
  - [x] `tags` : `tags_public_select` (`for select using (true)`) — référentiel lisible par tous. Pas d'écriture client.
  - [x] `artisan_tags` : SELECT scoping via l'artisan parent ; INSERT par le contributeur de l'artisan (`exists (select 1 from artisans a where a.id = artisan_id and a.created_by = auth.uid())`).
  - [x] `artisan_consent_tokens` : `enable row level security` + AUCUNE policy (deny-all par défaut côté `authenticated` ; accès uniquement service-role / RPC SECURITY DEFINER en 2.4/2.5).
- [x] **Task 9 — `lib/slug/slugify.ts` + tests** (AC: 5, 6)
  - [x] Créer `lib/slug/slugify.ts` : `export function slugify(input: string): string` déterministe — normalisation Unicode NFKD + suppression diacritiques pour le latin ; translittération arabe → ASCII (table consonnes, **suppression des voyelles longues `ا`/`و`/`ي` au sens alif** et des diacritiques courtes) ; minuscules ; espaces/séparateurs → `-` ; suppression des caractères non `[a-z0-9-]` ; collapse des `-` multiples ; trim des `-` ; troncature à 60 caractères (sans couper sur un `-` final).
  - [x] Gestion de collision : fonction séparée pure `export function withCollisionSuffix(base: string, taken: Set<string> | string[]): string` qui renvoie `base`, puis `base-2`, `base-3`… (le test n'a pas besoin de la DB ; l'usage réel avec lookup DB est en story 2.4). NE PAS mettre d'I/O dans `slugify`.
  - [x] Fixtures de test obligatoires : `slugify("Hassan le Plombier") === "hassan-le-plombier"`, `slugify("حسن السباك") === "hsn-lsbk"`, diacritiques FR (`"Électricité Générale" → "electricite-generale"`), scripts mixtes, et un nom > 60 chars tronqué à 60. Voir Dev Notes §Slugify pour la table de translittération minimale (حسن → hsn, السباك → lsbk).
- [x] **Task 10 — Régénération des types** (AC: 7)
  - [x] `pnpm supabase db reset` (rejoue toutes les migrations) → `pnpm gen:types` → vérifier que `lib/supabase/types.generated.ts` contient `artisans`, `ratings`, `tags`, `artisan_tags`, `artisan_consent_tokens` et les nouveaux enums. `pnpm typecheck`. Commiter le fichier généré (AR8).
- [x] **Task 11 — Extension des tests RLS** (AC: 8)
  - [x] Étendre `tests/rls.test.ts` (suite gated `describe.skipIf(!RUN_LOCAL_RLS_TESTS)`) avec des cas `artisans`/`ratings` : alice (résidence Darna) crée un artisan `published` → bob (même résidence) le voit, eve (résidence 2) ne le voit pas ; un `pending_consent` d'alice est invisible à bob ; bob ne peut pas UPDATE la ligne d'alice (`42501` ou 0 ligne) ; tentative d'INSERT rating avec `user_id` ≠ `auth.uid()` rejetée. Réutiliser `makeCoMod`, les constantes `DARNA_RESIDENCE_ID` / `RESIDENCE_2_ID`, le pattern `storageKey` + re-sign.
- [x] **Task 12 — Validation finale**
  - [x] `pnpm supabase db reset` sans erreur ; `pnpm typecheck` ; `pnpm test` (vert, RLS skip propre hors Docker) ; `pnpm test:rls` si Docker dispo. `git add supabase/migrations/ lib/supabase/types.generated.ts lib/slug/ tests/rls.test.ts`.

## Dev Notes

> **Contexte data-only.** Aucune route, composant ou Server Action dans cette story. Le livrable est : 1 migration SQL, `lib/slug/{slugify.ts,slugify.test.ts}`, `lib/supabase/types.generated.ts` (régénéré), `tests/rls.test.ts` (étendu).

### Architecture & conventions à répliquer à l'identique

- **Stack** : PostgreSQL via Supabase Cloud (`eu-central-1`), SQL pur dans `supabase/migrations/*.sql` (Supabase CLI native, pas de DSL). `@supabase/supabase-js` 2.106.1 direct (jamais `pg`, jamais SQL string-construit). Types via `supabase gen types typescript`. Tests Vitest 2. [Source: architecture.md §Versions vérifiées, §Data Architecture]
- **Nom du fichier de migration** : `<timestamp>_artisans_schema.sql` avec un timestamp **strictement supérieur à `20260618090000`** (dernière migration existante). Créer via `pnpm supabase migration new artisans_schema` (génère le timestamp), OU nommer manuellement p.ex. `20260619090000_artisans_schema.sql`. Un seul fichier additif (le pattern des stories 1.7-1.9 = un fichier par story mêlant DDL + RLS + grants). En-tête de commentaire documentant la story + les AR/FR couverts (cf. toutes les migrations existantes). [Source: codebase `supabase/migrations/`]
- **Conventions DB** (AR15) : tables `snake_case` pluriel ; colonnes `snake_case` ; FK `<entity>_id` ; timestamps `*_at timestamptz` ; PK `id uuid primary key default gen_random_uuid()` (extension `pgcrypto` déjà active) ; index `idx_<table>_<colonnes>` ; policies `<table>_<role>_<action>` ; valeurs ENUM littérales `snake_case`. [Source: architecture.md §Naming Patterns + `20260524005559_init_schema.sql`]
- **Multi-tenant J1 (AR7, NFR25)** : `residence_id uuid not null references public.residences(id) on delete restrict` sur **toutes** les entités métier (`artisans`, `ratings`, `artisan_consent_tokens`). `tags` est un référentiel global → pas de `residence_id` (à confirmer ; choix assumé : tags partagés entre résidences pour V3). [Source: ADR 0004, architecture.md D4]
- **Soft-delete (AR9, NFR17)** : quatuor `deleted_at timestamptz`, `deleted_by uuid references public.users(id) on delete set null`, `deletion_reason text` sur les entités modérables (`artisans`, `ratings`). Pas de policy DELETE — le retrait passe par UPDATE de `deleted_at`. Toute policy SELECT filtre `deleted_at is null`. [Source: ADR 0006, `init_schema.sql` table `profiles`]
- **FK `ON DELETE` explicite (ADR 0004 #4)** : vers `residences` → `restrict` ; FK acteur/auteur anonymisable (`created_by`, `ratings.user_id`, `deleted_by`) → `set null` ; FK lifecycle enfant (`ratings.artisan_id`, `artisan_tags.*`, `artisan_consent_tokens.artisan_id`) → `cascade`. [Source: ADR 0004, ADR 0006]
- **Modèle exemple de table** à mirrorer (verbatim `profiles`) :
  ```sql
  create table public.profiles (
    user_id uuid primary key references public.users(id) on delete cascade,
    residence_id uuid not null references public.residences(id) on delete restrict,
    villa integer not null check (villa between 1 and 150),
    language text not null default 'fr' check (language in ('fr', 'ar')),
    identity_mode text not null default 'pseudo' check (identity_mode in ('pseudo', 'identified')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    deleted_by uuid references public.users(id) on delete set null,
    deletion_reason text
  );
  ```

### §RLS — patterns exacts (défense en profondeur ADR 0004)

- **Helpers JWT existants** (NE PAS recréer) : `public.auth_role()` → `coalesce(auth.jwt()->'app_metadata'->>'role','public')` ; `public.auth_residence_id()` → uuid depuis `app_metadata.residence_id`. `auth.uid()` pour l'ownership self. [Source: `20260524005600_init_rls.sql`]
- **Lecture annuaire résidence** : le pattern le plus sûr aujourd'hui (le `app_metadata.residence_id` n'est pas encore peuplé pour tous les résidents — TODO connu) est la **sous-requête sur `public.users`**, exactement comme `profiles_resident_select_residence` :
  ```sql
  create policy artisans_resident_select_published on public.artisans
    for select using (
      deleted_at is null
      and state = 'published'
      and residence_id = (
        select residence_id from public.users
        where id = auth.uid()
          and role in ('resident', 'co_mod')
          and deleted_at is null
      )
    );
  ```
  Policy séparée pour ses propres `pending_consent` (AC3) :
  ```sql
  create policy artisans_resident_select_own_pending on public.artisans
    for select using (deleted_at is null and created_by = auth.uid());
  ```
- **Column-level GRANT/REVOKE (ADR 0004 #2 — OBLIGATOIRE, anti auto-promotion/forge)** : un REVOKE column-level ne diminue PAS un GRANT table-level Supabase préexistant → toujours « REVOKE total puis GRANT colonnes ». Pour `ratings` :
  ```sql
  revoke insert on public.ratings from authenticated;
  grant insert (artisan_id, user_id, residence_id, score_depannage, score_petits_travaux,
                score_travail_soigne, score_urgences, comment_text, visibility)
    on public.ratings to authenticated;
  revoke update on public.ratings from authenticated;
  grant update (score_depannage, score_petits_travaux, score_travail_soigne, score_urgences,
                comment_text, visibility, updated_at, deleted_at, deletion_reason)
    on public.ratings to authenticated;
  ```
  Idem pour `artisans` (INSERT limité à `slug, residence_id, display_name_fr, display_name_ar, phone_e164, price_relative, has_invoice, state, created_by` ; UPDATE limité aux colonnes éditables + colonnes soft-delete). Le test RLS (Task 11) doit vérifier qu'écrire une colonne hors-liste renvoie `42501`.
- **Écritures sensibles via SECURITY DEFINER** : si un retrait modéré de rating doit logger dans `moderation_log` (enum `rating_removed` déjà présent), c'est une RPC `security definer set search_path = public`, `grant execute ... to service_role`. **Hors scope 2.1** (relève d'Epic 5 / 2.7) — ne pas implémenter ici, juste ne pas bloquer le pattern.

### §FTS — résolution des deux conflits de l'AC4

1. **`arabic` n'existe pas en Postgres standard.** `to_tsvector('arabic', …)` lèverait `text search configuration "arabic" does not exist`. ADR 0001 tranche : **FR = config `french`, AR = config `simple` (+ `pg_trgm` pour le fuzzy)**. Utiliser `'simple'` pour `display_name_ar_tsv`. [Source: ADR 0001 `docs/adr/0001-postgres-fts-search.md`]
2. **`comment_text` est sur `ratings`, pas `artisans`.** L'AC4 écrit `display_name_fr || comment_text` dans un seul index : impossible en colonne générée mono-table. Interprétation fidèle de l'intention (recherche couvre noms + commentaires) : **2 tsvector générés distincts** — `display_name_*_tsv` sur `artisans`, `comment_tsv` sur `ratings` — chacun avec son index GIN. La story 2.2 (recherche) combinera les deux via jointure.
3. **Tags dans le FTS** : l'UX suggère d'indexer aussi les labels de tags (« plombier vs plomberie »), mais cela exige une dénormalisation/trigger sur `artisan_tags`. **Hors scope 2.1** : la story 2.2 pourra filtrer par tag via jointure `artisan_tags`. Noté comme enhancement possible, non requis ici.
4. Colonnes générées : `generated always as (to_tsvector(<config>, coalesce(<col>,''))) stored` (STORED, pas VIRTUAL — requis pour indexer en GIN). Requêtes côté 2.2 via `websearch_to_tsquery('french'|'simple', …)`. [Source: architecture.md §Data Architecture, ADR 0001]

### §Slugify — spécification déterministe (AC5/AC6)

- Latin : `String.prototype.normalize('NFKD')` + suppression des marques diacritiques `̀-ͯ`, lowercase, non `[a-z0-9]` → `-`, collapse `-`, trim, troncature 60.
- Arabe → ASCII : translittération **consonantique** (les voyelles longues `ا` alif, et diacritiques courtes, sont supprimées). Table minimale couvrant les deux fixtures (à compléter pour l'alphabet usuel) :
  - حسن → `h`+`s`+`n` = `hsn` (ح→h, س→s, ن→n)
  - السباك → ا(∅) ل→l س→s ب→b ا(∅) ك→k = `lsbk`
  - Mapping de base recommandé : ب→b د→d ف→f ج→j ك→k ل→l م→m ن→n ر→r س→s ت→t و→w (voyelle longue → ∅ en position interne) ي→y (idem) ه→h ح→h خ→kh ع→a غ→gh ق→q ص→s ض→d ط→t ظ→z ث→th ذ→d ز→z ش→sh ة→t ء→∅ ا→∅. Déterministe, sans dépendance externe (l'architecture est conservatrice côté deps — pas de lib de translittération).
- **`slugify` reste pure (aucune I/O).** Collision → `withCollisionSuffix(base, taken)` séparé, testable sans DB. L'usage réel (lookup `select 1 from artisans where slug = $1`) sera câblé en story 2.4.
- **Tombstoning (CC #19)** : un slug soft-deleted n'est jamais réutilisé ; l'accès à un slug mort renverra `410 Gone` — comportement de route géré en 2.3, mais la colonne `slug` doit rester `unique` y compris sur les lignes soft-deleted (ne pas filtrer `deleted_at` dans la contrainte d'unicité). [Source: epics.md CC #19, architecture.md §Navigation]

### §Seed

Pas de `seed.sql` séparé (`[db.seed]` désactivé dans `supabase/config.toml`). Le seed des `tags` vit **dans la migration** pour s'appliquer aussi en prod via `db push`. Pattern idempotent : `insert into public.tags (key, label_fr, label_ar) values (...) on conflict (key) do nothing;`. Jamais de user/co-mod en SQL (AR34). [Source: `20260524005605_seed_residence.sql`, `supabase/config.toml`]

### §Types & workflow de synchro (AR8)

```bash
pnpm supabase migration new artisans_schema    # ou nommage manuel > 20260618090000
# … édition SQL …
pnpm supabase db reset                          # drop + replay idempotent
pnpm gen:types                                  # régénère lib/supabase/types.generated.ts
pnpm typecheck                                  # vérifie le match
git add supabase/migrations/ lib/supabase/types.generated.ts
```

`gen:types` = `bash scripts/generate-types.sh` (garde-fou : échoue si la sortie ne contient pas `export type Database`). Header du fichier généré : `// AUTO-GENERATED ... DO NOT EDIT`. **Fichier versionné dans git.** [Source: package.json, `lib/supabase/README.md`]

### §Tests RLS (AC8) — pattern à étendre

Fichier `tests/rls.test.ts`. Suite gated `describe.skipIf(!RUN_LOCAL_RLS_TESTS)` (`RUN_LOCAL_RLS_TESTS = process.env.SUPABASE_LOCAL_TEST === 'true'`), lancée par `pnpm test:rls` contre la stack Supabase locale Docker (`pnpm supabase start`). Réutiliser :

- `adminClient` (service-role) pour `auth.admin.createUser({ email, password, email_confirm:true })`.
- Sessions isolées : un client par acteur avec `storageKey` distinct + `persistSession:false`, puis `signInWithPassword`.
- `makeCoMod(...)` pose `app_metadata:{role,residence_id}` via `updateUserById` **puis re-signe** (le JWT doit porter le claim pour `auth_role()`/`auth_residence_id()`).
- Constantes : `DARNA_RESIDENCE_ID='00000000-0000-0000-0000-000000000001'`, `RESIDENCE_2_ID='000000e2-0000-0000-0000-000000000002'`.
- Assertions : cross-user/cross-résidence → `expect(data).toHaveLength(0)` ; écriture interdite (colonne hors GRANT) → `expect(error?.code).toBe('42501')`.
- `env` via `parseSupabaseLocalEnv()` de `@/lib/env` (jamais `process.env` direct). [Source: ADR 0008, `tests/rls.test.ts`]

### Project Structure Notes

- Migration : `supabase/migrations/<ts>_artisans_schema.sql` (NEW).
- Slug : `lib/slug/slugify.ts` + `lib/slug/slugify.test.ts` (NEW — `lib/slug/` n'existe pas encore). Tests co-localisés `.test.ts` à côté de la source (cohérent avec le repo) ; pas dans `tests/`.
- Types : `lib/supabase/types.generated.ts` (UPDATE — régénéré, ne jamais éditer à la main).
- Tests RLS : `tests/rls.test.ts` (UPDATE).
- Aucun conflit de structure détecté. `lib/search/fts.ts` (query builder bilingue) est prévu mais **relève de la story 2.2**, pas 2.1.

### References

- [Source: epics.md#Story-2.1] — AC verbatim, liste des 5 tables et colonnes, AR5/AR6/AR7/AR8/AR9/AR15.
- [Source: epics.md#Epic-2] — objectif killer feature, 4 axes (Dépannage/Petits travaux/Travail soigné/Urgences), workflow consentement, dépendances 2.2-2.8.
- [Source: docs/adr/0001-postgres-fts-search.md] — FR=`french`, **AR=`simple`** (+pg_trgm), pas de service externe.
- [Source: docs/adr/0004-rls-vs-fk-discipline.md] — défense 4 couches : policies par rôle, column GRANT/REVOKE, SECURITY DEFINER, FK ON DELETE explicites.
- [Source: docs/adr/0006-soft-delete-cascade-anonymization.md] — soft-delete + purge J+7 ; `ratings.user_id` → `set null` à l'anonymisation (donc nullable).
- [Source: docs/adr/0008-rls-isolation-tests.md] — Vitest `tests/rls.test.ts`, gated Docker, job CI `e2e-rls` bloquant, artisans/ratings rejoignent ce test en 2.1+.
- [Source: supabase/migrations/20260524005559_init_schema.sql] — modèle de table, conventions colonnes/FK.
- [Source: supabase/migrations/20260524005600_init_rls.sql] — helpers `auth_role`/`auth_residence_id`, templates de policy, REVOKE/GRANT column-level.
- [Source: supabase/migrations/20260524005603_init_triggers.sql] — `public.set_updated_at()` partagé, naming `trg_<table>_updated_at`.
- [Source: supabase/migrations/20260524005527_init_enums.sql] — `moderation_action` contient déjà `rating_removed`/`comment_removed`.
- [Source: ux-design-specification.md] — 4 axes (slugs `depannage`/`petits-travaux`/`travail-soigne`/`urgences`, échelle 1-5, NULL=NA), attributs fiche/carte (nom, tags, phone, prix `$-$$$$`, badge facture), pseudonyme par défaut + visibilité opt-in, états `pending_consent`/`published`/`refused`, slug canonique tombstoné.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — bmad-dev-story, 2026-06-16

### Debug Log References

- Stack Supabase locale indisponible au run (Docker Desktop éteint, `supabase start` bloqué sur le pull d'images first-run — 0 octet de sortie, aucun event image sur 20 s). Stoppé proprement.
- Contournement de validation SQL : migration rejouée contre un **Postgres 16 nu** (`postgres:16-alpine`) avec stubs minimaux des objets fournis par Supabase (`auth.uid/jwt`, `public.residences`, `public.users`, `set_updated_at`, `auth_role/residence_id`, rôle `authenticated`, `pgcrypto`). Résultat : migration appliquée **sans erreur** — 5 tables, 11 policies, 4 index GIN, 8 tags seedés, contraintes CHECK / colonnes générées tsvector / `pg_trgm` toutes valides.
- 1er run avorté à la policy `artisans_resident_select_published` (`column "role" does not exist`) : déficience du stub `users` (corrigé en ajoutant `role/residence_id/deleted_at`), pas un bug de migration.

### Completion Notes List

**Livré et validé :**

- Migration `supabase/migrations/20260619090000_artisans_schema.sql` (1 fichier additif, DDL + RLS + grants + FTS) — **syntaxe/exécution validées sur Postgres 16 réel**.
- `lib/slug/slugify.ts` + `lib/slug/slugify.test.ts` — **12 tests verts** (fixtures AC5/AC6 : `hassan-le-plombier`, `hsn-lsbk`, diacritiques FR, scripts mixtes, troncature 60, collisions `-2/-3`).
- `lib/supabase/types.generated.ts` — 5 tables + 4 enums ajoutés au format générateur exact ; `pnpm typecheck` **vert**.
- `tests/rls.test.ts` — suite `RLS artisans / ratings (AC8)` ajoutée (alice/bob/eve, cross-résidence, masquage pending_consent AC3, forge `state` → 42501, usurpation `user_id` rating). Gated `skipIf(!RUN_LOCAL_RLS_TESTS)`.
- `pnpm test` (189 pass, 21 skip — RLS gated), `pnpm lint` **verts**.

**Décisions techniques :**

- AC4 conflit `arabic` : config `simple` pour l'AR (ADR 0001), 2 tsvector distincts (`display_name_*_tsv` sur artisans, `comment_tsv` sur ratings).
- Slugify : table de translit AR ambiguë (و/ي), tranchée en faveur du mapping explicite `و→w / ي→y` ; seul `ا` (∅) est contraint par les AC. Documenté dans le code.

**⚠️ Résidus de validation (gated Docker, NON exécutés localement — stack indisponible) :**

1. `pnpm gen:types` n'a pas été rejoué : `types.generated.ts` a été **rédigé à la main** au format exact du générateur et validé par `typecheck`. → Rejouer `pnpm gen:types` une fois la stack up pour garantir l'identité byte-à-byte (diff attendu : nul ou cosmétique).
2. `pnpm test:rls` n'a pas tourné (auth réelle requise). C'est **le comportement CI normal du projet** (CI skippe les RLS — cf. en-tête `tests/rls.test.ts` ; validation via `release.yml` → `db push`). Les policies ont néanmoins été chargées sans erreur sur Postgres 16. → Rejouer `pnpm supabase db reset && pnpm test:rls` en local quand Docker peut puller, avant merge.

### File List

- `supabase/migrations/20260619090000_artisans_schema.sql` (NEW)
- `lib/slug/slugify.ts` (NEW)
- `lib/slug/slugify.test.ts` (NEW)
- `lib/supabase/types.generated.ts` (MODIFIED — 5 tables + 4 enums)
- `tests/rls.test.ts` (MODIFIED — suite artisans/ratings AC8)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED — statut 2.1)

### Change Log

| Date       | Version | Description                                                                                                                                                                                                                                                                                               |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-16 | 0.1     | Implémentation story 2.1 : schéma artisan (5 tables), RLS multi-tenant, FTS bilingue (french/simple + pg_trgm), slugify déterministe + tests, types régénérés (manuel), tests RLS étendus. Migration validée sur Postgres 16 ; gen:types/test:rls résiduels (stack Docker indisponible). Statut → review. |

## Review Findings

> Code review BMad 2026-06-17 (3 couches adversariales : Blind Hunter, Edge Case Hunter, Acceptance Auditor). 2 decision-needed, 3 patch, 11 defer, 9 dismissed.

### Decision-needed

- [x] [Review][Decision] **Soft-delete / retrait par le résident — GRANT manquant vs spec** → **RÉSOLU 2026-06-17 : garder strict.** Le code reste tel quel (retrait = co-mod/service-role) ; le grant de retrait résident sera ajouté dans la story dédiée 2.7. La liste de GRANT des Dev Notes §RLS est à corriger (spec defect, code correct). [migration:992-994, 1035-1037]
- [x] [Review][Decision] **`state` absent du GRANT INSERT artisans vs liste littérale spec** → **RÉSOLU 2026-06-17 : garder strict.** `state` reste hors du GRANT INSERT (forcé à `pending_consent`, test `42501`) ; la liste des Dev Notes §RLS est à corriger (spec defect, code correct). [migration:986-988]

### Patch

- [x] [Review][Patch] **`ratings_resident_insert` ne valide pas que l'artisan est publié / de la même résidence** (HIGH) → **CORRIGÉ 2026-06-17.** Ajout d'un `exists (... a.state='published' and a.deleted_at is null and a.residence_id = ratings.residence_id)` au `with check`. Validé sur Postgres 16 réel. [supabase/migrations/20260619090000_artisans_schema.sql]
- [x] [Review][Patch] **Policy SELECT `artisan_tags` fuit cross-résidence + artisans non publiés** (MEDIUM) → **CORRIGÉ 2026-06-17.** `exists` aligné sur la visibilité artisans (published+résidence OU `created_by = auth.uid()`). Validé sur Postgres 16 réel. [supabase/migrations/20260619090000_artisans_schema.sql]
- [x] [Review][Patch] **Tests RLS : assertions de sécurité durcies + write cross-résidence ajouté** (AC8) → **CORRIGÉ 2026-06-17.** ⚠️ La sous-crainte « usurpation rating sans score → échoue sur le CHECK » était un FAUX POSITIF (le test contenait déjà `score_depannage: 1`, il échouait bien sur la RLS). Réel : durci `bob user_id≠uid` et `eve moderation_log` vers `expect(code).toBe('42501')` ; ajout de 2 tests write cross-résidence (eve→artisan rés.1, eve→rating sur artisan rés.1) prouvant AC8 « ne peut pas écrire ». [tests/rls.test.ts]

### Defer

- [x] [Review][Defer] **RLS jamais exécutée réellement** [tests/rls.test.ts] — Suite gated, validée seulement sur Postgres 16 stub. AC2/AC3/AC8 prouvées par assertion, pas par run. Action avant merge : `pnpm supabase db reset && pnpm test:rls` avec Docker.
- [x] [Review][Defer] **`types.generated.ts` rédigé à la main** [lib/supabase/types.generated.ts] — Rejouer `pnpm gen:types` pour garantir l'identité byte-à-byte avec le générateur (résidu connu, Completion Notes #1).
- [x] [Review][Defer] **`unique (artisan_id, user_id)` + ratings anonymisés NULL** [migration:859] — NULLs distincts → accumulation de ratings `user_id IS NULL` non dédupliquables ; les agrégats (story 2.2) doivent en tenir compte.
- [x] [Review][Defer] **Aucun chemin client ne publie un artisan** [migration:815, 992] — `state→published` = service-role 2.5 ; pas d'invariant `state='published' ⇔ published_at not null`. Par design ; annuaire vide pour les lecteurs jusqu'à 2.5.
- [x] [Review][Defer] **`slugify` renvoie `''` pour entrées 100% non-latin/non-arabe** [lib/slug/slugify.ts] — Vérifié (emoji/cyrillique/CJK → `''`). Pas de garde ; à gérer au câblage DB en 2.4 (slug vide = `not null unique` accepté → 1er gagne, suivants collisionnent).
- [x] [Review][Defer] **Ré-notation = INSERT → `23505` (pas d'upsert)** [migration:859] — Le flow notation 2.6 devra faire un upsert ; le schéma ne fournit pas la sémantique « mise à jour » évoquée dans le commentaire.
- [x] [Review][Defer] **Robustesse tests : collisions `Date.now()` + `RESIDENCE_2_ID` partagé** [tests/rls.test.ts] — Emails/slugs basés sur `Date.now()` (ms) collisionnables sur machine rapide ; `RESIDENCE_2_ID` upserté/supprimé par deux suites → couplage. Utiliser un compteur/crypto + isoler l'UUID par suite.
- [x] [Review][Defer] **`afterAll` ignore des chaînes FK RESTRICT latentes** [tests/rls.test.ts] — Le cleanup casse dès qu'un test 2.4/2.5 insérera consent_tokens/tags (RESTRICT sur residence_id) ou un rating sur RESIDENCE_2.
- [x] [Review][Defer] **`phone_e164` sans CHECK format ni unicité** [migration:812] — Accepte `''`/garbage/doublons ; la dédup (index trgm non-unique) est déférée à l'app 2.4.
- [x] [Review][Defer] **`artisan_tags` INSERT autorisé sur parent pending/soft-deleted** [migration:1057] — `with check` ne vérifie que `created_by = auth.uid()` (pas `deleted_at`/state) ; pas de chemin client en 2.1.
- [x] [Review][Defer] **Tombstoning slug non asserté via DB** [migration:808] — `slug not null unique` global (correct, couvre soft-deleted) mais aucun test ne prouve la non-réutilisation ; route 410 = story 2.3.
