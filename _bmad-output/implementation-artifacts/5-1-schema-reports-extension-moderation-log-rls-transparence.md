# Story 5.1: Schéma reports + extension moderation_log + RLS transparence

Status: review

> ⚠️ **3 points structurants** (détaillés en Dev Notes) : (1) **Mapping conceptuel** — l'AC parle de `event_key`/`motive_key`/`payload_json` ; le schéma existant (`moderation_log`, Epic 1) utilise `action` (enum), `reason_code`, `reason_text_anonymized`. On **étend l'existant** (ADD VALUE + nouvelle colonne `payload_json jsonb`), on ne renomme rien. (2) `report_opened` n'est **PAS** public (révélerait l'activité de signalement) → exclu de la vue `moderation_log_public` ; seul le co_mod travaille la table `reports`. (3) La transparence publique passe par une **vue SECURITY DEFINER `moderation_log_public`** qui whiteliste colonnes + actions et n'expose le `display_name` que des acteurs `co_mod` (qui acceptent l'identification par rôle).

## Story

As a **solo dev**,
I want **the schema for content reports + moderation log extensions with the right RLS for public transparence**,
so that **signalements are tracked privately and moderation actions are publicly auditable (CNDP-compliant immutable audit).**

Fondation Epic 5 : table `reports` (enums fermés `report_target_type`/`report_reason`/`report_state`), extension `moderation_log` (3 nouvelles `moderation_action` + colonne `payload_json`), vue de redaction `moderation_log_public`, RLS asymétrique (résident voit ses signalements / co_mod voit+résout ceux de sa résidence / journal public en lecture anonyme), trigger d'audit `report_opened`.

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 5.1 » (l. 1424-1454). FR31-FR34, AR5, AR15, NFR17, CC #19. Précisions techniques en Dev Notes — elles priment.

1. **AC1 — Table `reports`.** Colonnes `id`, `residence_id`, `reporter_id` FK users, `target_type` enum {`artisan`, `rating`, `alert`, `alert_comment`, `tip`, `guide_entry`, `useful_number`}, `target_id` uuid, `reason` enum {`diffamation`, `info_erronee`, `harcelement`, `spam`, `hors_charte`, `autre`}, `note_text` optional (≤200), `state` enum {`open`, `closed_removed`, `closed_kept`}, `created_at`, `resolved_at`, `resolved_by` FK co_mod, `resolution_motive`.
2. **AC2 — Extension `moderation_log`.** Nouvelles `moderation_action` : `report_opened`, `content_kept`, `escalation_triggered` (`content_removed`/`rating_removed`/`comment_removed`/`user_deleted` existent déjà). Nouvelle colonne `payload_json jsonb` (no-PII). Log reste immutable (INSERT seul, pas de soft-delete sur le log lui-même).
3. **AC3 — RLS résident.** INSERT ses propres reports (`reporter_id=auth.uid()`), SELECT seulement les siens, PAS d'UPDATE/DELETE ; ne voit JAMAIS les reports des autres.
4. **AC4 — RLS co_mod.** SELECT tous les reports de sa résidence, UPDATE pour les résoudre.
5. **AC5 — RLS `moderation_log`.** SELECT public (lecture transparence), INSERT rejeté côté client (writes via trigger/Server Action service-role uniquement).
6. **AC6 — Vue `moderation_log_public` + types.** Vue redaction : PII strippée (pas d'`actor_id`/email ; `display_name` seulement pour `co_mod` ; cibles des events PII type `user_deleted` masquées), actions privées exclues. Types régénérés (`pnpm gen:types`).

### AC additionnel (régression — obligatoire)

7. **AC7 — Tests RLS.** Bloc « Epic 5 » dans `tests/rls.test.ts` : INSERT report auteur, SELECT own (résident), isolation cross-résident, co_mod voit tout sa résidence, idempotence open report (duplicate → 23505), refus UPDATE résident, INSERT moderation_log refusé client, vue publique masque `report_opened` + acteurs non-co_mod. (≥8 tests).

## Tasks / Subtasks

- [x] **Task 1 — ENUMs** (`20260701090000_moderation_reports_enums.sql`) — `create type report_target_type / report_reason / report_state` ; `alter type moderation_action add value` ×3 (`report_opened`, `content_kept`, `escalation_triggered`), `if not exists`, fichier séparé (committed avant usage — pattern `20260630090000`).
- [x] **Task 2 — Schéma `reports` + extension log** (`20260701090100_moderation_reports_schema.sql`) — `alter table moderation_log add column payload_json jsonb` ; `create table reports` + CHECK note ≤200 ; index queue `(residence_id, state, created_at)`, reporter, target ; index UNIQUE partiel `(reporter_id, target_type, target_id) where state='open'` (idempotence).
- [x] **Task 3 — RLS + grants `reports`** — policies résident INSERT/SELECT own, co_mod SELECT/UPDATE residence ; REVOKE puis GRANT column-level (insert : `residence_id,target_type,target_id,reason,note_text` ; update : `state,resolved_at,resolved_by,resolution_motive`) ; `reporter_id` non granté (default `auth.uid()`).
- [x] **Task 4 — Trigger audit** — `log_report_opened()` SECURITY DEFINER → `moderation_log` (`report_opened`, payload no-PII `{target_type, reason}`, pas de `note_text`).
- [x] **Task 5 — Vue `moderation_log_public`** — SECURITY DEFINER (security_invoker=false), whitelist colonnes (`id,created_at,action,target_kind,target_id,reason_code,actor_display_name,residence_id,payload_json`), `display_name` co_mod only, masque cibles `user_deleted`, exclut actions consent-résidence + `report_opened` ; `grant select` à anon+authenticated.
- [x] **Task 6 — Types + tests** — `pnpm gen:types` ; bloc « Epic 5 » `tests/rls.test.ts` (≥8 tests).

## Dev Notes

### §Décisions

1. **D1 — Étendre, pas renommer.** `moderation_log` (Epic 1) a `action`/`reason_code`/`reason_text_anonymized`. L'AC nomme `event_key`/`motive_key`/`payload_json`. Mapping : `event_key`≈`action`, `motive_key`≈`reason_code`. On ajoute UNE colonne `payload_json jsonb` (structuré no-PII, future-proof Epic 5.3/5.5) plutôt que de casser le modèle existant. [tranché]
2. **D2 — `report_opened` privé.** Un signalement ouvert ne doit PAS apparaître sur `/transparence` (révélerait qui signale quoi → effet glaçant). Exclu de `moderation_log_public`. Aucune policy client SELECT ne le couvre → audit interne service-role only (CNDP immutable). `actor_id=reporter` conservé pour investigation anti-abus interne (jamais exposé). [tranché]
3. **D3 — Vue DEFINER vs RLS.** `moderation_log_public` en `security_invoker=false` : bypass la RLS de `moderation_log`, mais whiteliste explicitement colonnes ET actions → contrôle total de la surface publique. Le `display_name` n'est exposé que pour `actor.role='co_mod'` (acceptation d'identification par rôle, cf. 5.4). Acteurs système / résidents → `null`. [tranché]
4. **D4 — `target_type` enum élargi.** AC 5.1 liste 6 valeurs ; AC 5.2 mentionne aussi « numéro utile » → on ajoute `useful_number`. `alert_comment` conservé (forward-compat Epic 6.4, pas encore câblé en 5.2). [tranché]
5. **D5 — Idempotence par index UNIQUE partiel.** `unique (reporter_id, target_type, target_id) where state='open'` : un seul signalement OUVERT par (reporter, cible). 2ᵉ insert → `23505` → la Server Action 5.2 mappe `errors.report.duplicate`. Permet de re-signaler une fois un report précédent clôturé. [tranché]
6. **D6 — `reporter_id on delete set null`.** Alignement ADR 0006 (anonymisation RGPD) : si l'auteur supprime son compte, le report subsiste anonymisé (le co_mod garde le contexte), reporter_id nullable. [tranché]
7. **D7 — Bornage `report_state` minimal.** 5.1 = `{open, closed_removed, closed_kept}`. Les états juridiques (`closed_kept_pending_legal`…) sont ajoutés en 5.5 (ADD VALUE incrémental). [tranché]

### §Sécurité (NFR21 / AR6 / ADR 0004)

- Défense en profondeur : RLS + grants column-level. `reporter_id` non granté en INSERT (default `auth.uid()` — anti-spoof reporter). `residence_id` non granté en UPDATE.
- Pas de policy DELETE sur `reports` (résolution = UPDATE state). Log immutable (INSERT seul).
- Vue publique : aucune colonne PII (pas d'email, pas d'`actor_id` brut, pas de `reason_text_anonymized`) ; `payload_json` garanti no-PII par construction (triggers/actions Epic 5).
- `note_text` du report (peut contenir du PII saisi par le reporter) JAMAIS copié dans `moderation_log`.

### §Réutilisation directe

- `public.auth_role()` / `public.auth_residence_id()` (1.3), pattern grants `20260621090000`, pattern trigger audit SECURITY DEFINER `log_ephemeral_created` (4.1), pattern ADD VALUE séparé `20260630090000_ephemeral_enums`.

### Project Structure Notes

- **NEW** : 2 migrations (`20260701090000`/`090100`), table `reports`, vue `moderation_log_public`, fonction `log_report_opened`, colonne `moderation_log.payload_json`, enums `report_*`.
- **UPDATE** : `lib/supabase/types.generated.ts` (régénéré), `tests/rls.test.ts` (bloc Epic 5).

### References

- [Source: epics.md#Story-5.1] — AC verbatim.
- [Source: supabase/migrations/20260630090100_ephemeral_content_schema.sql] — modèle DDL/RLS/grants/trigger audit.
- [Source: supabase/migrations/20260524005559_init_schema.sql] — `moderation_log` existant.
- [Source: supabase/migrations/20260625090100_artisan_response.sql §6] — split policy public/résidence `moderation_log`.

## Dev Agent Record

### Completion Notes

- Migrations `20260701090000` (enums) + `20260701090100` (schéma/RLS/vue/trigger) appliquées en local (`supabase migration up`), types régénérés.
- Vue `moderation_log_public` testée : masque `report_opened`, acteurs non-co_mod, cibles `user_deleted`.
- Bloc tests RLS « Epic 5 » ajouté (gated `SUPABASE_LOCAL_TEST`).

### File List

- `supabase/migrations/20260701090000_moderation_reports_enums.sql` (NEW)
- `supabase/migrations/20260701090100_moderation_reports_schema.sql` (NEW)
- `lib/supabase/types.generated.ts` (regen)
- `tests/rls.test.ts` (Epic 5 block)

### Change Log

- 2026-06-20 — Story 5.1 implémentée (schéma reports + extension moderation_log + RLS transparence).
