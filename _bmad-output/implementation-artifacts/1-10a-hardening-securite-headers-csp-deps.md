# Story 1.10a: Hardening sécurité — headers + CSP, pin deps, dette hardening

Status: done

<!-- Split de la story 1.10 (epic 1.10) en 4 clusters indépendants — cluster A (sécurité, [NOW] 100% vérifiable). -->

## Story

**As a** solo dev,
**I want** poser une CSP stricte + compléter les headers sécurité, épingler les dépendances `latest`, et solder la dette de hardening « sécurité » accumulée aux stories 1.6-1.8,
**so that** la surface d'attaque est réduite et reproductible avant la bêta — sans dépendre d'aucune infra externe (tout est vérifiable localement).

## Acceptance Criteria

> Source epic : `epics.md:816-818` (headers) + `deferred-work.md` (items 1.4/1.6/1.7/1.8 tagués 1.10). MVP FR-only ([[project_darna_mvp_fr_only]]). Cluster **[NOW]** : build + curl + tests suffisent.

---

### AC1 — Headers sécurité + CSP stricte (`next.config.ts`) (AR30, NFR10)

**Given** `next.config.ts` `headers()` pose HSTS / X-Frame-Options=DENY / X-Content-Type-Options=nosniff / Referrer-Policy=strict-origin-when-cross-origin / Permissions-Policy=`camera=(), microphone=(), geolocation=()` **mais aucune CSP** ([Source: `next.config.ts`])
**When** la story est livrée
**Then** le `headers()` (source `/:path*`) :

- **Permissions-Policy** ← `camera=(), microphone=(), geolocation=(), interest-cohort=()` (ajout `interest-cohort=()`, [Source: architecture.md:1479])
- **+ Content-Security-Policy** exactement ([Source: architecture.md:1484-1493]) :

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co https://*.r2.cloudflarestorage.com; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.brevo.com https://*.glitchtip.app https://*.upstash.io; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; upgrade-insecure-requests
```

**And** HSTS / X-Frame / nosniff / Referrer-Policy + le bloc `/:locale/install` Cache-Control + `withSentryConfig` **conservés** (non-régression). `script-src 'unsafe-inline'` accepté MVP (bootstrap Next) — CSP nonce-based = post-bêta (noter deferred).
**And** vérifié : `pnpm build` OK + `curl -I` rend la CSP et les headers (Completion Notes).
**And** **important** : tester sur **preview Vercel** que la CSP ne casse ni Supabase (connect/wss), ni Brevo, ni GlitchTip, ni le SW Serwist, avant prod.

---

### AC2 — Supply-chain : pin des deps `latest` + `packageManager` (deferred 1.4)

**Given** `package.json` épingle `next`, `@supabase/ssr`, `@supabase/supabase-js` à **`latest`** et n'a **pas** de `packageManager` ([Source: `package.json`, deferred-work 1.4 #64-65])
**When** la story est livrée
**Then** ces 3 deps sont épinglées à la **version exacte résolue** dans `pnpm-lock.yaml` (ex. `"next": "16.2.6"`) et `package.json` reçoit `"packageManager": "pnpm@<version installée>"`.
**And** `pnpm install --frozen-lockfile` + `pnpm build` restent verts (aucune montée de version implicite).

---

### AC3 — `isSafeActionLink` → https-only en prod + centralisé (deferred 1.6/1.7/1.8) (D7)

**Given** `isSafeActionLink` est **dupliqué** dans `app/actions/auth-signin.ts`, `app/actions/admission-submit.ts`, `app/[locale]/comod/admission/actions.ts` et accepte `http:` (cleartext) ([Source: agent code])
**When** la story est livrée
**Then** une fonction unique **`lib/auth/safe-action-link.ts`** : en `process.env.NODE_ENV === 'production'` → **`https:` uniquement** ; hors-prod → `http:` toléré (tunnel/staging). Les 3 copies sont supprimées et importent ce module.
**And** test unitaire `lib/auth/safe-action-link.test.ts` : https accepté ; http refusé en prod (mock NODE_ENV), accepté hors-prod ; non-URL/empty refusés.

---

### AC4 — Index unique partiel anti-race admission (deferred 1.7) + grant resserré

**Given** 2 soumissions `/admission` simultanées créent 2 lignes `pending` pour un même user (pas d'index unique, [Source: deferred-work 1.7]) ; et le `grant update` sur `admission_requests` inclut `deleted_at, deleted_by, deletion_reason` pour `authenticated` (sur-permissif, [Source: deferred-work 1.7 #97])
**When** la story est livrée
**Then** une migration **`supabase/migrations/<ts>_admission_hardening.sql`** :

1. `create unique index if not exists admission_requests_one_pending_per_user on public.admission_requests (user_id) where state = 'pending' and deleted_at is null;`
2. resserre le column-grant : **nouvelle** migration `revoke update ... ; grant update (state, decision_reason, decided_by, decided_at, updated_at, email_verified_at) on public.admission_requests to authenticated;` (retire `deleted_at/deleted_by/deletion_reason` — le soft-delete passe par service-role/SECURITY DEFINER, cohérent 1.9). **Ne pas éditer** une migration déjà appliquée → nouveau fichier.

**And** `app/actions/admission-submit.ts` : le `INSERT` catch le conflit Postgres `23505` → renvoie le code existant `duplicate_pending` (réutilise la branche, ajoute juste le catch). Test unitaire du cas conflit.
**And** `gen:types` régénéré si nécessaire (patch manuel si Docker down — leçon 1.7/1.8).

---

### AC5 — `mapRpcError` codes distincts (deferred 1.8) + proxy durci

**Given** `comod/admission/actions.ts` `mapRpcError` collapse `not_found`/`wrong_residence`/`not_co_mod` → `decision_failed` générique, sans tests dédiés ([Source: deferred-work 1.8 #87-88]) ; et `proxy.ts` matcher n'exclut pas `_rsc=`, le check `app_metadata.role` est une string littérale ([Source: deferred-work 1.4 #56,58])
**When** la story est livrée
**Then** :

1. `mapRpcError` distingue `not_found` → `errors.comod.invalid_id` (déjà existant), `wrong_residence` → nouveau `errors.comod.wrong_residence`, `not_co_mod` → `errors.comod.forbidden` ; `decision_failed` reste le fallback. + i18n FR (stubs AR). + **tests** des branches `not_found`/`wrong_residence` (deferred 1.8 #88).
2. `proxy.ts` : matcher exclut `_rsc` (évite l'appel Supabase à chaque RSC fetch) ; extraire `const CO_MOD_ROLE = 'co_mod'` (anti-typo). **Préserver** la logique cookie SSR + le 403 localisé + `vary: accept-language` (déjà en place).

**And** non-régression 1.6-1.9 verte ; `typecheck/lint/test/build` verts.

---

## Tasks / Subtasks

- [x] **T1 — Headers + CSP** (AC1) : compléter `next.config.ts` `headers()` (CSP exacte + interest-cohort), conserver l'existant. `curl -I` Completion Notes.
- [x] **T2 — Pin deps** (AC2) : épingler next/@supabase/\* aux versions lock + `packageManager`. `--frozen-lockfile` vert.
- [x] **T3 — safe-action-link** (AC3) : `lib/auth/safe-action-link.ts` (https-only prod) + dedupe ×3 + test.
- [x] **T4 — Migration admission hardening** (AC4) : index unique partiel + grant resserré (nouvelle migration) + catch 23505 dans admission-submit + test.
- [x] **T5 — mapRpcError + proxy** (AC5) : codes distincts + i18n + tests ; proxy `_rsc` + constante.

---

## Dev Notes

### Compliance

- **AR30/NFR10** [architecture.md:1468-1496] CSP + 5 hosts connect-src. **AR3/AR16-19** conservés.
- **N2/MVP FR-only** : i18n FR + stubs AR vides (fallback FR `deepMerge`).

### Fichiers UPDATE (état & à préserver)

- `next.config.ts` : `headers()` (HSTS/X-Frame/nosniff/Referrer/Permissions **sans** CSP) + bloc install + Sentry → **ajouter** CSP+interest-cohort, ne rien casser.
- `package.json` : 3 deps `latest` + pas de `packageManager`.
- `app/actions/{auth-signin,admission-submit}.ts` + `app/[locale]/comod/admission/actions.ts` : `isSafeActionLink` dupliqué → centraliser ; admission-submit → catch 23505.
- `proxy.ts` : matcher + check role (403 localisé + `vary` déjà ajoutés par Stephane en review 1.8 — **préserver**).
- `comod/admission/actions.ts` : `mapRpcError` (guard `residence_id is null` déjà ajouté — préserver).
- migrations : **nouveau** fichier (jamais éditer une migration appliquée).

### Hors-scope

CSP nonce-based (post-bêta) · rate-limit (1.10b) · tests RLS/a11y (1.10c) · backup/ADRs/runbook (1.10d).

### References

- epic : epics.md:816-818 · deferred-work items 1.4/1.6/1.7/1.8
- CSP exacte : architecture.md:1484-1493 · Permissions-Policy : 1479
- `next.config.ts`, `package.json`, `proxy.ts`, `comod/admission/actions.ts`, `admission-submit.ts`, `init_rls.sql:165-175`
- [[project_darna_mvp_fr_only]]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `bmad-dev-story`.

### Debug Log References

- `pnpm install` (sync lockfile après pin) + `pnpm install --frozen-lockfile` ✅ (les specifiers `latest`→exact ne cassent pas le lock ; versions identiques aux résolues).
- `pnpm typecheck` ✅ · `pnpm lint` ✅ 0 warning · `pnpm test` ✅ **167 passed / 5 skipped** (+10 : safe-action-link 5, mapRpcError not_found/wrong_residence 2, race 23505 1, autres) · `pnpm build` ✅.
- Smoke HTTP prod (port 3020) `curl -I /fr` : **tous les headers présents** dont la **CSP complète** (default-src 'self' … connect-src Supabase/Brevo/GlitchTip/Upstash … upgrade-insecure-requests) + Permissions-Policy avec `interest-cohort=()`.

### Completion Notes List

- **T1 — Headers+CSP** : constante `CSP` (10 directives, connect-src 5 hosts) + `interest-cohort=()` ajouté ; HSTS/X-Frame/nosniff/Referrer + bloc install Cache-Control + `withSentryConfig` **préservés**. `script-src 'unsafe-inline'` MVP (nonce-based → post-bêta, deferred). **À vérifier preview Vercel** : que la CSP ne casse ni Supabase wss/REST, ni Brevo, ni GlitchTip, ni le SW Serwist (déféré pré-prod).
- **T2 — Pin deps** : `next 16.2.6`, `@supabase/ssr 0.10.3`, `@supabase/supabase-js 2.106.1` (versions résolues) + `"packageManager":"pnpm@10.33.4"`. Lockfile re-synchronisé, `--frozen-lockfile` vert.
- **T3 — safe-action-link** : `lib/auth/safe-action-link.ts` (https-only si `NODE_ENV==='production'`, http toléré hors-prod) ; les 3 copies (auth-signin, admission-submit, comod/actions) supprimées et importent le module. 5 tests (`vi.stubEnv`).
- **T4 — Migration `20260618090000_admission_hardening.sql`** : index unique partiel `(user_id) where state='pending' and deleted_at is null` + grant UPDATE resserré (retire deleted_at/deleted_by/deletion_reason). `admission-submit.ts` catch `23505` → `duplicate_pending` (pas de magic-link sur le conflit). Test du cas race. Pas de changement de types (index/grant non typés).
- **T5 — mapRpcError + proxy** : `mapRpcError` en `switch` → `not_found`→invalid_id, `wrong_residence`→nouvelle clé, `not_co_mod`→forbidden, fallback decision_failed ; i18n `errors.comod.wrong_residence` FR + stub AR + clé ajoutée à `COMOD_ERROR_KEYS` ; 2 tests de branches. `proxy.ts` : constante `CO_MOD_ROLE` (anti-typo) + matcher en forme objet avec `missing: [RSC, Next-Router-Prefetch]` (skip middleware sur RSC/prefetch ; les layouts requireComod/requireResident gardent les soft-navigations). **À vérifier preview** : comportement RSC navigation + refresh session (déféré).

### File List

**NEW**

- `lib/auth/safe-action-link.ts`
- `lib/auth/safe-action-link.test.ts`
- `supabase/migrations/20260618090000_admission_hardening.sql`

**MODIFIED**

- `next.config.ts` (+CSP +interest-cohort)
- `package.json` (pin next/@supabase/\* + packageManager) · `pnpm-lock.yaml` (re-sync specifiers)
- `lib/auth` imports : `app/actions/auth-signin.ts`, `app/actions/admission-submit.ts` (+catch 23505), `app/[locale]/comod/admission/actions.ts` (+mapRpcError codes) — dédupe `isSafeActionLink`
- `lib/validation/admission-decision.ts` (+`errors.comod.wrong_residence` dans COMOD_ERROR_KEYS)
- `proxy.ts` (CO_MOD_ROLE + matcher missing RSC)
- `messages/fr.json` (+`errors.comod.wrong_residence`) · `messages/ar.json` (stub)
- `tests/comod/validate-admission.test.ts` (+2 branches) · `tests/admission/submit-action.test.ts` (+race 23505)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-10a → review)

### Change Log

- **2026-06-16** — Implémentation `bmad-dev-story` (Opus 4.8). 5/5 tâches : CSP+headers (smoke vert), pin deps+packageManager, `lib/auth/safe-action-link` https-only + dédupe ×3, migration index unique partiel + grant resserré + catch 23505, mapRpcError codes distincts + i18n + proxy CO_MOD_ROLE/matcher RSC. `typecheck/lint/test(167)/build` verts. Vérifs preview Vercel déférées (CSP vs services, comportement RSC). Status : `review`.
- **2026-06-16** — Story créée par split de 1.10 (cluster A sécurité, Opus 4.8). ACs : headers+CSP, pin deps, safe-action-link https-only, index unique anti-race + grant resserré, mapRpcError codes + proxy. Status : `ready-for-dev`.

### Review Findings

- [x] [Review][Patch] `mapRpcError('wrong_residence')` retourne `code: 'decision_failed'` au lieu de `code: 'forbidden'` — sémantiquement incorrect (c'est une violation d'autorisation, pas un échec de décision) ; l'UI n'utilise que `message_key` aujourd'hui mais le `code` est dans le type public [`app/[locale]/comod/admission/actions.ts:48`]
- [x] [Review][Patch] Scope bleed 1.10b : rate limiting Upstash déjà implémenté dans `admission-submit.ts` + UI (`admission-form.tsx` référence `errors.rate_limit.exceeded` + `errorCode:'rate_limited'`) alors que la spec 1.10a le list **hors-scope** — à documenter et tracker dans 1-10b story [informationnel, pas bloquant si intentionnel]
- [x] [Review][Defer] CSP `script-src 'unsafe-inline'` / `style-src 'unsafe-inline'` — accepté spec-explicitement pour le bootstrap Next.js MVP ; nonce-based différé post-bêta [architecture.md:1484-1493] — deferred, spec-intentionnel
- [x] [Review][Defer] Proxy matcher `missing: [RSC, Next-Router-Prefetch]` — session refresh contourne le middleware sur soft-nav RSC (getUser() ne peut pas rafraîchir un token expiré sans middleware) ; Completion Notes : "À vérifier preview Vercel" — deferred, pré-prod
- [x] [Review][Defer] TOCTOU : un résident accepté entre le duplicate-check et l'INSERT peut recréer une ligne `pending` — extrêmement improbable, le 23505 index ne couvre que pending→pending, pas accepted→new-pending — deferred, pré-existant
- [x] [Review][Defer] `isSafeActionLink` accepte n'importe quel `https://` sans vérification same-origin — open redirect potentiel si Supabase retourne un mauvais link — deferred, beyond AC3 scope
- [x] [Review][Defer] CSP manque `object-src 'none'` et `worker-src 'self'` — beyond spec (architecture.md:1484 ne les liste pas) — deferred, hardening post-bêta
