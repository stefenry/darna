# Story 1.10d: Hardening ops — backup hebdo, 8 ADRs, runbook, invite-co-mods

Status: done

<!-- Split de la story 1.10 (epic 1.10) — cluster D (ops & docs). Backup = [INFRA/scaffold] ; ADRs/runbook/invite = [DOCS/NOW]. -->

## Story

**As a** solo dev / co-mod,
**I want** un backup hebdomadaire (scaffold), les 8 ADRs d'architecture, un runbook opérationnel et un script d'invitation co-mods sécurisé,
**so that** la plateforme est audit-defensible et récupérable avant la bêta (AR29, AR4, AR34, NFR29-33).

## Acceptance Criteria

> Source epic : `epics.md:828-840`. ADRs/runbook/invite = **[DOCS/NOW]** vérifiables ; backup = **[INFRA/scaffold]** (pas de creds R2 ni Edge Function déployée — D6).

---

### AC1 — Backup hebdomadaire (AR29, NFR33) — **scaffold (D6)**

**Given** aucun env R2/Cloudflare, aucune Edge Function, le cron `purge-expired` (1.9) est le **modèle Bearer** ([Source: `app/api/cron/purge-expired/route.ts`])
**When** la story est livrée (**scaffold maintenant, upload R2 activé quand le bucket est provisionné — D6**)
**Then** :

1. **`app/api/cron/weekly-backup/route.ts`** (GET, garde `Authorization: Bearer ${env.server.CRON_SECRET}` → 401 sinon, pattern purge-expired) : déclenche le dump et log `cron.backup_*` ; échec → alerte e-mail Brevo (pattern `lib/email` / `budget-alert.ts`).
2. **`supabase/functions/weekly-backup/`** (Edge Function Deno) : `supabase db dump` → gzip → upload `r2://darna-backups/postgres/YYYY-MM-DD.sql.gz` ; **rétention 12 semaines** (purge des plus anciens) — [Source: architecture.md:1417-1426]. **TODO explicite** : l'upload réel (S3-compatible fetch vers R2) est gardé derrière les creds → scaffold fonctionnel, activation post-provisioning.
3. **`vercel.json`** : `crons` += `{ "path":"/api/cron/weekly-backup", "schedule":"0 3 * * 0" }` (dimanche 03:00 UTC) — **conserver** le cron `purge-expired` existant.
4. **`lib/env.ts`** : ajouter `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` en `z.string().optional()` (ne fait pas fail-fast l'app tant que non provisionné).

**And** RPO 7j documenté (runbook AC3). **Vérif réelle (dump + upload) déférée pré-bêta.** Test : la route 401 sans Bearer, 200 avec (Edge call mocké/stub).

---

### AC2 — 8 ADRs (AR4) — **collision résolue : déplacer les process-ADRs (D3)**

**Given** `docs/adr/` contient 3 ADRs de process (`0001-tailwind-3-keep-starter`, `0002-vitest-4-major-upgrade`, `0003-bundle-story-1-1-and-1-2`) en **collision** avec la numérotation architecture (`0001-postgres-fts`…`0008`)
**When** la story est livrée (**décision Stephane : déplacer les process-ADRs**)
**Then** :

1. `git mv` les 3 ADRs existants vers **`docs/adr/process/`** (préservés, hors de la séquence architecture) ; grep + corriger toute référence.
2. écrire les **8 ADRs d'architecture** aux numéros canoniques dans `docs/adr/` ([Source: architecture.md:1538-1545]), chacun **Context / Decision / Consequences / Status** :
   - `0001-postgres-fts-search.md`, `0002-brevo-email-provider.md`, `0003-locale-routing-public-only.md`, `0004-rls-vs-fk-discipline.md`, `0005-rate-limiting-upstash.md`, `0006-soft-delete-cascade-anonymization.md`, `0007-supabase-tier-mvp-weekly-backup.md`, `0008-rls-isolation-tests.md`
3. les ADRs 0005-0008 documentent les décisions **réellement implémentées** (rate-limit 1.10b, soft-delete cascade 1.9, backup 1.10d, RLS tests 1.10c) ; 0008 inclut le **forward-ref** des tables epic 2-4.

---

### AC3 — Runbook (`docs/runbook.md`) (NFR29-32, AR34)

**When** la story est livrée
**Then** `docs/runbook.md` documente : (1) **récupération** (perte domaine / Supabase / Vercel / R2), (2) **rotation des secrets** (1Password Families), (3) **invitation co-mods** via `scripts/invite-co-mods.ts` (AC4) + purge de l'env post-usage, (4) **checklist vérification backup hebdo**, (5) **contacts d'urgence** (dev fallback + recours juridique) + SLA. Inclut la note `grant-comod` partial-failure (deferred 1.8 #90) et la procédure `app_metadata` re-sync (deferred 1.8 #85).

---

### AC4 — `scripts/invite-co-mods.ts` (AR34) — **consolidation (D4)**

**Given** `scripts/grant-comod.ts` (1.8) bootstrappe via `generateLink` (sans e-mail) + `updateUserById(app_metadata)` + `users.update(role)` ([Source: `scripts/grant-comod.ts`])
**When** la story est livrée (**D4**)
**Then** **`scripts/invite-co-mods.ts`** devient le script canonique AR34 : `admin.auth.admin.inviteUserByEmail(email)` (envoie l'invitation) puis `updateUserById(id, { app_metadata:{ role:'co_mod', residence_id } })` + `users.update({ role:'co_mod' })` (cohérence DB↔JWT) ; lit `INITIAL_COMOD_EMAILS` ; idempotent ; masque les e-mails dans les logs ; rappelle de purger l'env post-usage. `package.json` : `"invite:comods"` ; `grant:comod` devient un **alias** (ou est retiré) — **zéro duplication** de la logique app_metadata. Documenté runbook (AC3).

---

## Tasks / Subtasks

- [x] **T1 — Backup scaffold** (AC1) : `app/api/cron/weekly-backup/route.ts` (Bearer) + `supabase/functions/weekly-backup/` (TODO R2) + `vercel.json` cron + env R2 optionnels + test 401/200.
- [x] **T2 — 8 ADRs** (AC2) : `git mv` process-ADRs → `docs/adr/process/` + écrire 0001-0008 (Context/Decision/Consequences/Status).
- [x] **T3 — Runbook** (AC3) : `docs/runbook.md` 5 sections + notes deferred 1.8.
- [x] **T4 — invite-co-mods** (AC4) : `scripts/invite-co-mods.ts` (inviteUserByEmail + app_metadata) + alias `grant:comod` + doc runbook.

---

## Dev Notes

### Compliance

- **AR29/NFR33** [architecture.md:1417-1426] Edge Function pg_dump → R2 hebdo 12 sem, RPO 7j. **AR4** [1532-1547] 8 ADRs. **AR34** [1510-1520] inviteUserByEmail + app_metadata, env purgée post-usage. **AR39** [1037] cron Bearer.

### Décisions héritées (déjà tranchées)

- **D3 (Stephane)** : déplacer les 3 process-ADRs sous `docs/adr/process/`, ADRs architecture aux numéros canoniques.
- **D4** : `invite-co-mods.ts` canonique, `grant-comod` alias.
- **D6** : backup scaffold-only (upload R2 pré-bêta).

### Fichiers UPDATE / pattern

- `app/api/cron/purge-expired/route.ts` (1.9) = **modèle Bearer** exact (Stephane a ajouté le log-avant-delete + ordering NFR55 — même rigueur attendue).
- `vercel.json` : `crons` purge-expired présent → **ajouter** weekly-backup.
- `lib/env.ts` : serverSchema (Upstash/CRON_SECRET ; **pas de R2**) → ajouter R2 optionnels.
- `scripts/grant-comod.ts` : 3 étapes (generateLink → app_metadata → users.role) → base de `invite-co-mods.ts` (remplace generateLink par inviteUserByEmail).
- `docs/adr/` : 3 process-ADRs existants ; `docs/ops/brevo-sender-setup.md` existe (pas de runbook).

### Hors-scope

Upload R2 réel + Edge déployée + creds (pré-bêta) · Supabase Pro tier/RPO 5min (post-bêta) · headers (1.10a) · rate-limit (1.10b) · tests (1.10c).

### References

- epic : epics.md:828-840 · AR29 : architecture.md:1417-1426 · AR4 : 1532-1547 · AR34 : 1510-1520
- `app/api/cron/purge-expired/route.ts` · `vercel.json` · `lib/env.ts` · `scripts/grant-comod.ts` · `docs/adr/*`
- inviteUserByEmail : https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail · Vercel Cron : https://vercel.com/docs/cron-jobs
- [[project_darna_arch_complete]]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `bmad-dev-story`.

### Debug Log References

- `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ **177 passed / 11 skipped** (+4 : weekly-backup route) · `pnpm build` ✅ (`/api/cron/weekly-backup` rendu `ƒ Dynamic`).
- L'Edge Function Deno (`supabase/functions/weekly-backup/index.ts`) est **exclue de tsc + eslint** (import remote `deno.land` + globale `Deno`) via `tsconfig.exclude` + `eslint.config.mjs ignores`.

### Completion Notes List

- **T1 — Backup scaffold** : route `app/api/cron/weekly-backup/route.ts` (Bearer `CRON_SECRET` → 401, sinon `admin.functions.invoke('weekly-backup')` → 200/500 + logs `cron.backup_*`) ; Edge Function Deno **no-op explicite** tant que `R2_*` absents (log `r2_not_configured`) + TODO upload S3-compatible ; `vercel.json` cron `0 3 * * 0` (purge-expired conservé) ; `lib/env.ts` +`R2_*` **optionnels** ; i18n `errors.cron.failed`. 4 tests (401/401/200/500). **Upload R2 réel + Edge déployée + dump = déférés pré-bêta** (D6, cf. runbook).
- **T2 — 8 ADRs** : `git mv docs/adr/{0001-tailwind,0002-vitest,0003-bundle}` → `docs/adr/process/` (aucune référence code cassée), puis écriture des 8 ADRs canoniques `0001-postgres-fts-search` … `0008-rls-isolation-tests` (Context/Decision/Consequences/Status), reflétant les décisions réellement implémentées (0004 RLS, 0005 rate-limit 1.10b, 0006 soft-delete 1.9, 0007 backup, 0008 RLS-tests 1.10c + forward-ref epic 2-4).
- **T3 — Runbook** : `docs/runbook.md` 5 sections (récupération, rotation secrets, invitation co-mods + purge env, vérif backup hebdo, contacts/SLA) incl. notes deferred 1.8 (grant-comod partial-failure, app_metadata re-sync).
- **T4 — invite-co-mods** : `scripts/invite-co-mods.ts` (canonique AR34 : `inviteUserByEmail` + `updateUserById` app_metadata + `users.update(role)`, idempotent, masque les e-mails, rappel purge env) ; `pnpm invite:comods` ; `grant:comod` conservé comme variante dev/local (D4).

### File List

**NEW**

- `app/api/cron/weekly-backup/route.ts`
- `supabase/functions/weekly-backup/index.ts`
- `scripts/invite-co-mods.ts`
- `docs/runbook.md`
- `docs/adr/0001-postgres-fts-search.md` … `0008-rls-isolation-tests.md` (8 fichiers)
- `tests/cron/weekly-backup.test.ts`

**MOVED**

- `docs/adr/{0001-tailwind-3-keep-starter,0002-vitest-4-major-upgrade,0003-bundle-story-1-1-and-1-2}.md` → `docs/adr/process/`

**MODIFIED**

- `lib/env.ts` (+R2\_\* optionnels) · `vercel.json` (+cron weekly-backup) · `package.json` (+script `invite:comods`)
- `messages/fr.json` (+`errors.cron.failed`) · `messages/ar.json` (stub)
- `tsconfig.json` (+exclude `supabase/functions`) · `eslint.config.mjs` (+ignore `supabase/functions/**`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-10d → review)

### Change Log

- **2026-06-16** — Implémentation `bmad-dev-story` (Opus 4.8). 4/4 tâches : backup scaffold (route Bearer + Edge no-op + cron Vercel + env R2 optionnels + 4 tests), 8 ADRs canoniques (+ déplacement des 3 process-ADRs, D3), runbook 5 sections, `invite-co-mods.ts` (D4). `typecheck/lint/test(177)/build` verts. Upload R2 réel + dump déférés pré-bêta (D6). Status : `review`.
- **2026-06-16** — Story créée par split de 1.10 (cluster D ops, Opus 4.8). ACs : backup scaffold (route Bearer + Edge TODO + cron + env R2), 8 ADRs (process-ADRs déplacés, D3), runbook, invite-co-mods consolidé (D4). Status : `ready-for-dev`.

### Review Findings

- [x] [Review][Decision] Brevo failure alert absente (AC1.1) — IMPLÉMENTÉE (a) : `alertBackupFailure()` via `brevoSendEmail` (client direct `lib/email/client`) dans les deux branches d'échec ; fire-and-forget (`void`) ; destinataire `LEGAL_CONTACT_EMAIL`. Test mock ajouté [`app/api/cron/weekly-backup/route.ts`]
- [x] [Review][Patch] `INITIAL_COMOD_EMAILS` requis → app crashe au cold boot quand purgé — passé en `.optional()` avec `.default('')` implicite via `(s ?? '')` ; comportement runtime : itère sur `[]` si absent (notifications co-mod silencieuses, app live) [`lib/env.ts`]
- [x] [Review][Patch] `users.update()` sans `.select()` — `.select('id')` ajouté dans le helper partagé `scripts/_apply-comod-role.ts` (force PostgREST `return=representation`, erreurs DB surfacent dans `row.error`)
- [x] [Review][Patch] Edge function no-op log `backup_completed` à tort — `result?.skipped` inspecté : log `cron.backup_skipped` si skipped, `cron.backup_completed` seulement si backup réel ; test `backup_skipped` ajouté [`app/api/cron/weekly-backup/route.ts`, `tests/cron/weekly-backup.test.ts`]
- [x] [Review][Patch] Script exit 0 si 0/N invitations — `process.exit(1)` ajouté si `invited === 0 && emails.length > 0` [`scripts/invite-co-mods.ts`]
- [x] [Review][Patch] `inviteUserByEmail` email_exists → idempotence cassée — détection 422 / "already registered" + `listUsers` (max 1000) pour retrouver l'userId confirmé et appliquer quand même rôle+app_metadata [`scripts/invite-co-mods.ts`]
- [x] [Review][Patch] `grant-comod.ts` duplique `updateUserById`+`users.update` — extrait dans `scripts/_apply-comod-role.ts` (helper partagé) ; les deux scripts importent `applyComodRole` (zéro duplication AC4)
- [x] [Review][Defer] Partial state counter : `invited` sous-comptabilise si étape 2/3 échoue après une invite réussie (le re-run idempotent récupère, runbook §3 couvre) — deferred, pre-existing
- [x] [Review][Defer] Timing collision Sunday 03:00 : `purge-expired` et `weekly-backup` se déclenchent simultanément (lecture seule pour le backup → safe au MVP) — deferred, pre-existing
- [x] [Review][Defer] `SUPABASE_DB_URL` référencé dans le TODO de l'Edge Function mais absent de `lib/env.ts` (scaffold pré-bêta) — deferred, pre-existing
- [x] [Review][Defer] Secrets R2 absents de `.env.example` (scaffold, documentés dans runbook) — deferred, pre-existing
- [x] [Review][Defer] Pas de `maxDuration` sur la route Vercel (timeout 10-15s si backup réel dépasse) — scaffold pré-bêta — deferred, pre-existing
