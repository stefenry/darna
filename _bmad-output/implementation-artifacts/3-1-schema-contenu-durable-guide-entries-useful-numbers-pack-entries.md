# Story 3.1: Schéma contenu durable — guide_entries + useful_numbers + pack_entries

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> ⚠️ **3 points structurants** (détaillés en Dev Notes) : (1) **Story de fondation Epic 3** — une **migration unique** crée les 3 tables (`guide_entries`, `useful_numbers`, `pack_entries`), leurs enums, RLS, grants colonne, colonnes FTS générées + index GIN, triggers `updated_at`. Aucune route, aucun composant : c'est du DDL pur, sur le modèle exact de `20260619090000_artisans_schema.sql` (Epic 2.1). (2) **RLS asymétrique** — résident **lecture seule** ; co_mod **CRUD complet** de sa résidence (les Server Actions co_mod arrivent en 3.5, mais les policies + grants colonne — y compris le grant `update(deleted_at, deleted_by)` pour le soft-delete co_mod — sont posés **ici**). (3) **`theme_key` / `category_key` = enums littéraux** (i18n résolu au render, **pas** de colonne `display_name`) ; **`section_key` du pack = `text`** (curé par co_mod, pas de liste fermée — voir §Décisions D3).

## Story

As a **solo dev**,
I want **le schéma des 3 modules de contenu durable avec champs bilingues, thématisation, ordonnancement, FTS bilingue et RLS prête au CRUD**,
so that **les co-mods puissent curer la connaissance communautaire dans les deux langues, et que les stories 3.2-3.5 se posent sur un socle complet sans `ALTER TABLE` ultérieur**.

Story de **fondation** de l'Epic 3 (analogue à 2.1 pour l'Epic 2). Elle ne livre **aucune UI** : elle prépare le terrain pour la lecture Guide (3.2), Numéros utiles (3.3), Pack accueil (3.4) et le CRUD co_mod (3.5). Le **RPC de recherche** (`ts_headline`) relève de 3.2 ; le **RPC de retrait + log modération** relève de 3.5 — 3.1 ne pose que les tables, RLS et grants.

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 3.1 » (l. 1128-1154). FR23-FR26, NFR47, AR5/AR6/AR7/AR9/AR15. Précisions techniques (enums exacts, soft-delete, FTS, grants colonne) en Dev Notes — elles priment.

1. **AC1 — Les 3 tables existent.** Étant donné que la migration est appliquée, quand j'inspecte la base, alors existent : `guide_entries` (`id`, `slug`, `residence_id`, `theme_key`, `title_fr`, `title_ar`, `body_fr_markdown`, `body_ar_markdown`, `order_in_theme`, `created_by`, quatuor soft-delete), `useful_numbers` (`id`, `residence_id`, `category_key` enum, `label_fr`, `label_ar`, `phone_e164`, `notes_fr`, `notes_ar`, `order_in_category`, `created_by`, soft-delete), `pack_entries` (`id`, `residence_id`, `section_key`, `title_fr`, `title_ar`, `body_fr_markdown`, `body_ar_markdown`, `order_in_section`, `created_by`, soft-delete) — toutes avec `residence_id` FK → `residences(id) on delete restrict`. (AR5, AR7, AR9, AR15)
2. **AC2 — RLS résident = lecture seule.** Étant donné les policies appliquées, quand je m'authentifie comme `resident`, alors je peux `SELECT` toutes les entrées **non supprimées de ma résidence** dans les 3 tables ; je ne peux **ni** `INSERT` **ni** `UPDATE` **ni** soft-delete (lecture seule stricte — aucun grant écrit à `authenticated` pour le rôle résident sur ces tables).
3. **AC3 — RLS co_mod = CRUD résidence.** Étant donné les policies appliquées, quand je m'authentifie comme `co_mod`, alors je peux `INSERT`/`UPDATE` (y compris poser `deleted_at`/`deleted_by` pour le soft-delete) toutes les entrées **de ma résidence** dans les 3 tables. Cross-résidence rejeté `42501`.
4. **AC4 — `theme_key` enum stable + i18n au render.** Étant donné que `theme_key` est typé enum, quand j'inspecte le schéma, alors les valeurs sont des identifiants stables (`codes_portails`, `horaires_gardien`, `regles_jardin`, `dechets`, `traditions`, `securite`, `autre`) — **aucune** colonne `display_name` sur le thème ; les libellés sont résolus à l'affichage via i18n (clés `community.guide.themes.<key>`). Idem `useful_number_category` (`securite`, `syndic`, `urgences`, `sante`, `autre`). (NFR47)
5. **AC5 — FTS bilingue prêt.** Étant donné les colonnes FTS générées, quand j'inspecte le schéma, alors `guide_entries` et `pack_entries` portent des colonnes `search_fr_tsv` (config `french`, sur `title || body`) et `search_ar_tsv` (config `simple`, ADR 0001) **générées STORED**, indexées GIN — prêtes pour la recherche 3.2.
6. **AC6 — Types régénérés.** Et les types sont régénérés et commités dans `lib/supabase/types.generated.ts` (les 3 tables + 2 enums apparaissent dans `Database['public']['Tables']` / `['Enums']`).

### AC additionnel (régression — obligatoire)

7. **AC7 — Tests RLS verts + soft-delete cohérent.** Écriture co*mod **uniquement** via les grants colonne posés ici (jamais sur `created_at`, `search*\*\_tsv`générées, ni`residence_id`en UPDATE) ; **aucune** policy`DELETE`(soft-delete par`UPDATE`de`deleted_at`réservé co_mod) ; le`SELECT`résident **exclut** les lignes`deleted_at is not null`(un contenu retiré disparaît de la lecture).`pnpm gen:types`puis`pnpm typecheck`/`lint`/`test`verts ;`tests/rls.test.ts` étendu (résident read-only KO en écriture, co_mod CRUD OK, cross-résidence KO, soft-delete masque la lecture).

## Tasks / Subtasks

- [ ] **Task 1 — Migration : enums du domaine durable** (AC: 1, 4)
  - [ ] Créer `supabase/migrations/20260623090000_durable_content_schema.sql` (timestamp **> 20260622120000**, dernière migration existante — monotonie stricte). En-tête commentaire sur le modèle de `20260619090000` (intention, ADRs couverts, décisions FTS/soft-delete/grants).
  - [ ] `create type public.guide_theme_key as enum ('codes_portails','horaires_gardien','regles_jardin','dechets','traditions','securite','autre');`
  - [ ] `create type public.useful_number_category as enum ('securite','syndic','urgences','sante','autre');`
  - [ ] **Pas** d'enum pour `section_key` (pack) → `text` (D3). **Pas** de recréation de `moderation_action` (réutilisé tel quel en 3.5 via `content_removed`).

- [ ] **Task 2 — Table `guide_entries`** (AC: 1, 5)
  - [ ] Colonnes : `id uuid pk default gen_random_uuid()`, `slug text not null`, `residence_id uuid not null references public.residences(id) on delete restrict`, `theme_key public.guide_theme_key not null`, `title_fr text not null`, `title_ar text`, `body_fr_markdown text not null`, `body_ar_markdown text`, `order_in_theme integer not null default 0`, `created_by uuid references public.users(id) on delete set null`, quatuor `created_at`/`updated_at`/`deleted_at`/`deleted_by`/`deletion_reason` (copier exactement le pattern artisans l.82-85).
  - [ ] Colonnes FTS générées STORED : `search_fr_tsv tsvector generated always as (to_tsvector('french', coalesce(title_fr,'') || ' ' || coalesce(body_fr_markdown,''))) stored`, `search_ar_tsv tsvector generated always as (to_tsvector('simple', coalesce(title_ar,'') || ' ' || coalesce(body_ar_markdown,''))) stored`.
  - [ ] Contrainte slug : **unique scopé résidence** `constraint guide_entries_residence_slug_unique unique (residence_id, slug)` (le slug est la cible deep-link 3.2 ; il doit être unique par résidence, pas global — multi-tenant AR7). Slug unique y compris sur lignes soft-deleted (tombstoning, cohérent CC #19 / artisans).

- [ ] **Task 3 — Table `useful_numbers`** (AC: 1)
  - [ ] Colonnes : `id`, `residence_id` (idem), `category_key public.useful_number_category not null`, `label_fr text not null`, `label_ar text`, `phone_e164 text not null`, `notes_fr text`, `notes_ar text`, `order_in_category integer not null default 0`, `created_by` (idem), quatuor soft-delete + `created_at`/`updated_at`.
  - [ ] **Pas** de FTS (accès par catégorie, pas de recherche — épic 3.3). Pas de `slug` (pas deep-linkable individuellement, FR36 ne cite pas l'entrée mais la page `/numeros-utiles`).

- [ ] **Task 4 — Table `pack_entries`** (AC: 1, 5)
  - [ ] Colonnes : `id`, `residence_id` (idem), `section_key text not null` (D3 — pas enum), `title_fr text not null`, `title_ar text`, `body_fr_markdown text not null`, `body_ar_markdown text`, `order_in_section integer not null default 0`, `created_by` (idem), quatuor soft-delete + `created_at`/`updated_at`.
  - [ ] Colonnes FTS générées identiques à `guide_entries` (`search_fr_tsv`/`search_ar_tsv`) — pour homogénéité 3.2 même si la recherche pack n'est pas un AC (le pack 3.4 deep-linke vers le Guide, mais garder FTS prêt évite un futur `ALTER`).

- [ ] **Task 5 — Triggers `updated_at`** (AC: 1)
  - [ ] 3 triggers `trg_<table>_updated_at before update … execute function public.set_updated_at()` (fonction existante, init_triggers ; même usage que `trg_artisans_updated_at`).

- [ ] **Task 6 — Index** (AC: 5)
  - [ ] GIN FTS : `idx_guide_entries_search_fr_tsv`, `idx_guide_entries_search_ar_tsv`, `idx_pack_entries_search_fr_tsv`, `idx_pack_entries_search_ar_tsv`.
  - [ ] Tri/scope : `idx_guide_entries_residence_theme_order on guide_entries (residence_id, theme_key, order_in_theme)`, `idx_useful_numbers_residence_category_order on useful_numbers (residence_id, category_key, order_in_category)`, `idx_pack_entries_residence_section_order on pack_entries (residence_id, section_key, order_in_section)`.

- [ ] **Task 7 — RLS résident (lecture seule)** (AC: 2)
  - [ ] `enable row level security` sur les 3 tables.
  - [ ] Pour chaque table, policy `SELECT` `<table>_resident_select_residence` : `deleted_at is null and residence_id = (select residence_id from public.users where id = auth.uid() and role in ('resident','co_mod') and deleted_at is null)` (copier le pattern `artisans_resident_select_published` l.187-200 **sans** la condition `state`).
  - [ ] **Aucun** grant `insert`/`update`/`delete` à `authenticated` issu du rôle résident — `revoke insert, update, delete on <table> from authenticated` puis ne re-grant **que** pour co_mod (Task 8). Le résident ne peut donc rien écrire (AC2).

- [ ] **Task 8 — RLS co_mod (CRUD) + grants colonne** (AC: 3, 7)
  - [ ] Pour chaque table, policy `SELECT` co_mod `<table>_co_mod_select_residence` (voit aussi les soft-deleted de sa résidence, pour réafficher/restaurer en 3.5) : `public.auth_role() = 'co_mod' and residence_id = public.auth_residence_id()` (pattern `artisans_co_mod_select_residence` l.207-214).
  - [ ] Policy `INSERT` `<table>_co_mod_insert` : `with check (public.auth_role() = 'co_mod' and residence_id = public.auth_residence_id() and created_by = auth.uid())`.
  - [ ] Policy `UPDATE` `<table>_co_mod_update` : `using (public.auth_role() = 'co_mod' and residence_id = public.auth_residence_id()) with check (public.auth_role() = 'co_mod' and residence_id = public.auth_residence_id())`. **Pas** de policy `DELETE` (soft-delete via UPDATE).
  - [ ] **Grants colonne (ADR 0004 #2)** — `revoke insert/update on <table> from authenticated` puis `grant` explicite **au seul périmètre co_mod** :
    - `guide_entries` INSERT : `(slug, residence_id, theme_key, title_fr, title_ar, body_fr_markdown, body_ar_markdown, order_in_theme, created_by)` ; UPDATE : `(slug, theme_key, title_fr, title_ar, body_fr_markdown, body_ar_markdown, order_in_theme, deleted_at, deleted_by, deletion_reason, updated_at)`.
    - `useful_numbers` INSERT : `(residence_id, category_key, label_fr, label_ar, phone_e164, notes_fr, notes_ar, order_in_category, created_by)` ; UPDATE : `(category_key, label_fr, label_ar, phone_e164, notes_fr, notes_ar, order_in_category, deleted_at, deleted_by, deletion_reason, updated_at)`.
    - `pack_entries` INSERT : `(residence_id, section_key, title_fr, title_ar, body_fr_markdown, body_ar_markdown, order_in_section, created_by)` ; UPDATE : `(section_key, title_fr, title_ar, body_fr_markdown, body_ar_markdown, order_in_section, deleted_at, deleted_by, deletion_reason, updated_at)`.
  - [ ] **Jamais** grant sur `created_at`, `search_*_tsv` (générées), ni `residence_id` en UPDATE (tenant figé). Le grant `update(deleted_at, deleted_by)` autorise le soft-delete co_mod ; le **log modération** associé reste un RPC SECURITY DEFINER (3.5) car `moderation_log` est écriture-système (architecture l.1060).
  - [ ] **Note grants à `authenticated`** : les grants colonne sont posés sur le rôle `authenticated` (Supabase n'a pas de rôle SQL par co_mod) ; l'**enforcement du rôle co_mod** est porté par le `with check (auth_role()='co_mod')` des policies, pas par le grant. C'est le pattern artisans (grant à authenticated, policy filtre `created_by`/`auth_role`).

- [ ] **Task 9 — Régénération types + commit** (AC: 6)
  - [ ] `pnpm gen:types` (mode local Docker, cf. `scripts/generate-types.sh`) → vérifier `guide_entries`/`useful_numbers`/`pack_entries` dans `Tables`, `guide_theme_key`/`useful_number_category` dans `Enums`. Commiter `lib/supabase/types.generated.ts` (AR8).

- [ ] **Task 10 — Tests RLS étendus** (AC: 7)
  - [ ] `tests/rls.test.ts` (suite gated `SUPABASE_LOCAL_TEST`) — nouveau block « RLS contenu durable (Epic 3) » : seeds en `beforeAll` (1 résident + 1 co_mod **même résidence**, 1 co_mod **autre résidence**, 1 `guide_entries` seedée par le co_mod). Cas : (a) résident `SELECT` voit l'entrée ; (b) résident `INSERT` → `42501` (lecture seule) ; (c) résident `UPDATE` deleted_at → `42501` ; (d) co_mod même résidence `INSERT`/`UPDATE` OK ; (e) co_mod autre résidence `UPDATE` → `42501`/0 ligne ; (f) co_mod soft-delete (`update deleted_at=now()`) puis résident `SELECT` → **0 ligne** (masquage). Réutiliser les helpers de session isolée (`storageKey` distinct, cf. l.22-40).

## Dev Notes

> **Stack & conventions** : DDL pur Supabase/Postgres, **strictement** sur le modèle de `supabase/migrations/20260619090000_artisans_schema.sql` (Epic 2.1) — c'est le template canonique à imiter ligne à ligne (structure tables, FTS générées, RLS, grants colonne, triggers, index). Aucun code applicatif dans cette story.

### §Décisions (points tranchés)

1. **D1 — Une seule migration additive.** Les 3 tables + 2 enums + RLS + grants + FTS + triggers + index dans **un fichier** `20260623090000_durable_content_schema.sql`, pas un fichier par table (pattern artisans : tout le domaine dans une migration). Idempotence non requise (migration versionnée), mais conserver l'ordre DDL → RLS → grants → index comme 2.1.
2. **D2 — Slug unique par résidence, pas global.** `unique(residence_id, slug)` (et non `slug text unique` comme artisans). Raison : multi-tenant (AR7) — deux résidences peuvent avoir une entrée `code-portail`. Le deep-link 3.2 résout `slug` **dans** la résidence du lecteur (RLS scope). [tranché]
3. **D3 — `pack_entries.section_key = text`, pas enum.** L'épic 3.1 ne ferme pas la liste des sections (`Codes portails, Horaires gardien, Jours poubelles, Contacts utiles, Traditions locales` sont des exemples 3.4, pas un enum exhaustif). Le pack est éditorial et curé par co_mod → `text` libre, ordonné par `order_in_section`. Les libellés de section sont stockés tels quels (FR/AR via les titres d'entrée), pas via i18n de clé. À l'inverse `theme_key`/`category_key` **sont** des enums (listes fermées, i18n au render, NFR47). [tranché]
4. **D4 — RLS asymétrique, écriture co_mod posée ici.** Bien que les Server Actions co_mod arrivent en 3.5, les **policies + grants** co_mod (INSERT/UPDATE/soft-delete) sont dans **cette** migration : le schéma doit être complet et auto-cohérent (un test RLS 3.1 doit pouvoir prouver le CRUD co_mod). 3.5 ne fait qu'ajouter la couche applicative + le RPC de retrait (log modération). [tranché]
5. **D5 — `moderation_log` non touché ici.** Le retrait co_mod (3.5) loggue via un RPC SECURITY DEFINER (pattern `process_artisan_consent`), réutilisant l'action enum **existante `content_removed`** + `target_kind in ('guide_entry','useful_number','pack_entry')`. Aucune valeur d'enum `moderation_action` à ajouter, aucune policy d'écriture client sur `moderation_log`. [tranché]
6. **D6 — FTS sur guide + pack, pas sur numéros.** Les numéros utiles s'accèdent par catégorie (3.3), pas par recherche → pas de tsvector. Guide ET pack portent `search_fr_tsv`/`search_ar_tsv` (pack par homogénéité, évite un futur ALTER même si 3.4 ne cherche pas). [tranché]

### §Sécurité (NFR21 / AR6 / ADR 0004)

- **Défense en profondeur** : RLS par rôle **+** grants colonne. Le résident n'a **aucun** grant écrit sur ces 3 tables → toute tentative INSERT/UPDATE échoue `42501` même si une future Server Action buggée l'oubliait.
- **Tenant figé** : `residence_id` non re-grantée en UPDATE (un co_mod ne peut pas déplacer une entrée vers une autre résidence). `with check` des policies co_mod ré-impose `residence_id = auth_residence_id()`.
- **Colonnes système** : `created_at`, `search_*_tsv` (générées), jamais grantées. Soft-delete : seules `deleted_at`/`deleted_by`/`deletion_reason` grantées en UPDATE co_mod (pas de policy DELETE).
- **`auth_residence_id()`** suppose `app_metadata.residence_id` peuplé (vrai pour co_mod via 1.8). Pour le SELECT résident, garder la **sous-requête sur `public.users`** (pattern artisans) car `app_metadata` n'est pas garanti pour tous les résidents.

### §Réutilisation directe (ne PAS réinventer)

- **Template migration** : `supabase/migrations/20260619090000_artisans_schema.sql` — copier la structure (tables l.63-150, RLS l.165-300, grants colonne l.242-251 & l.300-311, triggers l.140-150, index l.155-180). C'est le **seul** modèle à suivre.
- **Helpers RLS** : `public.auth_role()`, `public.auth_residence_id()` (`20260524005600_init_rls.sql` l.10-37) ; `public.set_updated_at()` (`20260524005603_init_triggers.sql`).
- **Soft-delete** : quatuor `deleted_at timestamptz / deleted_by uuid references users(id) on delete set null / deletion_reason text` (ADR 0006 ; pattern artisans l.82-85).
- **Tests** : `tests/rls.test.ts` block « ratings (AC8) » comme modèle de seeds + sessions isolées (`storageKey` par user, l.22-40).
- **Génération types** : `scripts/generate-types.sh` / `pnpm gen:types`.

### §Gotchas (appris des stories 1.3 / 2.1)

- Les colonnes `generated always as … stored` **doivent** être STORED (pas VIRTUAL) pour être indexables GIN.
- Postgres n'a **pas** de config FTS `arabic` → AR utilise `simple` (ADR 0001), comme artisans.
- Un `unique(residence_id, slug)` autorise le **même** slug sur des lignes soft-deleted de la même résidence (NULLs non concernés ici) — acceptable, le tombstoning fin (réémission de slug) est géré par Epic 6, pas ici.
- `gen:types` nécessite Docker local up (`supabase start`) ; le commit du fichier généré est **obligatoire** (CI ne le régénère pas — AR8).
- `ar.json` n'est pas concerné par cette story (pas d'UI), mais les **enums** sont en français-identifiant stable (pas de traduction de valeur enum — i18n au render uniquement, NFR47).

### Project Structure Notes

- **NEW** : `supabase/migrations/20260623090000_durable_content_schema.sql` ; bloc de tests dans `tests/rls.test.ts`.
- **UPDATE** : `lib/supabase/types.generated.ts` (régénéré, commité).
- **AUCUNE** route, **AUCUN** composant, **AUCUNE** clé i18n dans cette story (elles arrivent en 3.2-3.5).
- Conventions : tables snake*case pluriel, FK `<table>_id`, enums `public.<domaine>*<concept>`, policies `<table>_<role>_<action>`, index `idx*<table>*<colonnes>`.

### References

- [Source: epics.md#Story-3.1] — AC verbatim (l.1128-1154), FR23-FR26, NFR47.
- [Source: prd.md] — FR23 (l.916), FR24 (l.917), FR25 (l.918), FR26 (l.919), FR48 (l.961), NFR17 (l.996), NFR21 (l.1000), NFR25 (l.1007), NFR47 (l.1039).
- [Source: architecture.md] — tables Epic 3 listées (l.354), RLS 100% tables données (l.1060), tables impactées modération NULL user_id (l.1432), F4 Guide `guide_entries` (l.1213).
- [Source: supabase/migrations/20260619090000_artisans_schema.sql] — **template canonique** : tables + FTS générées + RLS + grants colonne + triggers + index (fichier entier).
- [Source: supabase/migrations/20260524005559_init_schema.sql] — quatuor soft-delete (residences l.14-23), `moderation_log` (l.103-117).
- [Source: supabase/migrations/20260524005600_init_rls.sql] — `auth_role()` / `auth_residence_id()` (l.10-37).
- [Source: supabase/migrations/20260524005527_init_enums.sql] — `moderation_action` (l.33-40, réutilisé `content_removed`).
- [Source: tests/rls.test.ts] — pattern seeds + sessions isolées.
- [Source: docs/adr/...] — ADR 0001 (FTS `simple` pour AR), ADR 0004 (grants colonne), ADR 0006 (soft-delete + anonymisation).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log

| Date       | Version | Description                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-06-19 | 0.1     | Création story 3.1 (context engine). Fondation Epic 3 : migration unique (3 tables guide_entries/useful_numbers/pack_entries + 2 enums + RLS asymétrique résident-lecture/co_mod-CRUD + grants colonne + FTS bilingue généré + index GIN + triggers updated_at), régénération types, tests RLS étendus. Aucune UI. Status → ready-for-dev. |
