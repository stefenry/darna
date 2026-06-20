# Story 4.1: Schéma contenu éphémère — alerts + tips + templates

Status: done

> ⚠️ **3 points structurants** (détaillés en Dev Notes) : (1) RLS **inversée** vs Epic 3 — le résident est AUTEUR (INSERT/UPDATE/retrait de SES items), pas seulement lecteur ; (2) audit publication garanti par **trigger AFTER INSERT** `log_ephemeral_created` (le résident n'a aucun grant sur `moderation_log`) ; (3) `expires_at` borné par CHECK (backstop) — la valeur métier exacte (24/72/168h, ≤30j) est calculée côté Server Action / RPC (4.2/4.3).

## Story

As a **solo dev**,
I want **the schema for ephemeral content with expiration, pre-written templates and bilingual support**,
so that **residents can publish alerts in one tap and the feed self-maintains via auto-purge.**

Fondation Epic 4 : tables `alert_templates` (référentiel seedé), `alerts`, `tips`, RLS asymétrique auteur, index feed/cron, triggers d'audit + soft-delete, RPC de retrait auteur.

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 4.1 » (l. 1288-1308). FR27-FR30, AR5, AR7, AR9, AR15, AR19. Précisions techniques en Dev Notes — elles priment.

1. **AC1 — Tables.** `alert_templates` (seedé : `coupure_eau`, `coupure_electricite`, `desinsectisation`, `chien_perdu`, `objet_perdu`, `colis_livre`, `autre` ; `label_fr/ar`, `default_body_fr/ar`, `default_duration_hours`), `alerts` (`id`, `slug`, `residence_id`, `template_id` FK, `title_fr/ar`, `body_fr/ar`, `created_by`, `expires_at`, soft-delete), `tips` (`id`, `slug`, `residence_id`, `category_key` enum {`offre_voisin`, `pret_objet`, `evenement`, `autre`}, `title_fr/ar`, `body_fr/ar`, `created_by`, `expires_at`, soft-delete).
2. **AC2 — RLS.** Résident : SELECT alerts/tips de sa résidence où `expires_at > now() AND deleted_at IS NULL`, INSERT/UPDATE/DELETE des siens.
3. **AC3 — Index.** Composites `(residence_id, expires_at, deleted_at)` (feed) + `created_at DESC` (tri).
4. **AC4 — Types + seed.** Types régénérés ; modèles seedés dans la migration.

### AC additionnel (régression — obligatoire)

5. **AC5 — Tests RLS.** Lecture active/expirée, INSERT auteur, isolation cross-résidence, trigger audit, RPC retrait, référentiel templates lecture-seule. (`tests/rls.test.ts` bloc « Epic 4 », 10 tests).

## Tasks / Subtasks

- [x] **Task 1 — ENUMs** (`20260630090000_ephemeral_enums.sql`) — `moderation_action` += `alert_created`, `tip_created`, `alert_self_retracted`, `tip_self_retracted`, `content_expired` (ADD VALUE séparé, committed avant usage) ; `create type tip_category`.
- [x] **Task 2 — Schéma** (`20260630090100_ephemeral_content_schema.sql`) — `alert_templates` + seed 7 modèles ; `alerts` ; `tips` ; CHECK (slug, longueurs, `expires_at` futur + cap 8j/31j).
- [x] **Task 3 — Index** — `idx_<t>_residence_expires`, `idx_<t>_created_at`, `idx_<t>_expires_cleanup` (partial `where deleted_at is null`, cron).
- [x] **Task 4 — Triggers** — `set_updated_at` (réutilisé), `enforce_deleted_by_actor` (réutilisé 3.1), `log_ephemeral_created` (NEW, SECURITY DEFINER → moderation_log).
- [x] **Task 5 — RLS + grants** — SELECT (résident actif / co_mod tout / auteur ses items), INSERT/UPDATE auteur ; grants column-level ; templates lecture-seule.
- [x] **Task 6 — RPC retrait** (`20260630090200_ephemeral_retract_rpc.sql`) — `retract_own_ephemeral(p_kind, p_id, p_reason)` SECURITY DEFINER, garde `created_by`, audit dédié.
- [x] **Task 7 — Types + tests** — `pnpm gen:types` ; 10 tests RLS Postgres réel.

## Dev Notes

### §Décisions

1. **D1 — RLS inversée.** Epic 3 = co_mod auteur / résident lecteur. Epic 4 = résident auteur. Policies INSERT/UPDATE `created_by = auth.uid()` ; policy `*_author_select_own` (l'auteur voit ses items même expirés, pour gestion/retrait). [tranché]
2. **D2 — Audit par trigger.** `moderation_log` reste deny-all client → trigger `log_ephemeral_created` (SECURITY DEFINER, owner postgres BYPASSRLS) écrit `alert_created`/`tip_created` quel que soit le chemin (AR19). [tranché]
3. **D3 — Pas de FTS.** Feed trié fraîcheur, pas de recherche (AC 4.4) → pas de colonnes `search_*_tsv` (vs Epic 3). [tranché]
4. **D4 — `expires_at` backstop CHECK.** `expires_at > created_at` + cap `created_at + 8 days` (alerts) / `31 days` (tips). Bornes métier exactes en Server Action/RPC (défense en profondeur). [tranché]
5. **D5 — `alert_templates` référentiel global** (modèle `tags` 2.1) : pas de `residence_id`, seed idempotent `on conflict do nothing`, lecture-seule client. [tranché]

### §Sécurité (NFR21 / AR6 / ADR 0004)

- Défense en profondeur : RLS + grants column-level (`created_by` non granté, default `auth.uid()` ; `residence_id` non granté en UPDATE — tenant figé).
- Pas de policy DELETE : soft-delete par UPDATE (auteur) ou RPC ; hard-delete réservé au cron purge (4.5) / système.
- RPC `retract_own_ephemeral` : whitelist kind (anti-injection table), garde `created_by`, soft-delete atomique `WHERE deleted_at IS NULL RETURNING` (idempotent + anti-race).

### §Réutilisation directe

- `public.set_updated_at()`, `public.enforce_deleted_by_actor()` (3.1 review P1), helpers `auth_role()/auth_residence_id()`, pattern grants `20260627090000`.

### Project Structure Notes

- **NEW** : 3 migrations (`20260630090000/090100/090200`), tables `alert_templates`/`alerts`/`tips`, fonctions `log_ephemeral_created`/`retract_own_ephemeral`.
- **UPDATE** : `lib/supabase/types.generated.ts` (régénéré).

### References

- [Source: epics.md#Story-4.1] — AC verbatim.
- [Source: supabase/migrations/20260627090000_durable_content_schema.sql] — modèle DDL/RLS/grants.
- [Source: supabase/migrations/20260628090000_review_3_1_hardening.sql] — trigger `enforce_deleted_by_actor`, CHECK slug.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (2026-06-20, dev autonome Epic 4).

### Debug Log References

- `npx supabase migration up --local` → 3 migrations appliquées OK.
- `pnpm gen:types` → 1648 lignes, `alerts`/`tips`/`alert_templates`/`tip_category`/`retract_own_ephemeral` présents.
- `SUPABASE_LOCAL_TEST=true vitest run tests/rls.test.ts` → 71/71 (dont 10 Epic 4).

### Completion Notes List

- RLS inversée auteur livrée (D1) ; trigger audit garantit `moderation_log` sans grant client (D2).
- `default_body_*` nullable (modèle « autre » = saisie libre).
- AR fields seedés (référentiel complet) bien que MVP FR-only.

### File List

- **NEW** `supabase/migrations/20260630090000_ephemeral_enums.sql`
- **NEW** `supabase/migrations/20260630090100_ephemeral_content_schema.sql`
- **NEW** `supabase/migrations/20260630090200_ephemeral_retract_rpc.sql`
- **NEW** `tests/rls.test.ts` (bloc « RLS contenu éphémère (Epic 4) »)
- **UPDATE** `lib/supabase/types.generated.ts`

### Change Log

| Date       | Version | Description                                              |
| ---------- | ------- | -------------------------------------------------------- |
| 2026-06-20 | 0.1     | Schéma + RLS + triggers + RPC + tests RLS (dev autonome) |
