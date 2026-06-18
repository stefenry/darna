# Story 1.10b: Hardening — rate-limiting Upstash

Status: done

<!-- Split de la story 1.10 (epic 1.10) — cluster B (rate-limiting, [INFRA] : code+tests buildables, vérif live gated par instance Upstash). -->

## Story

**As a** solo dev,
**I want** un rate-limiting Upstash (`lib/rate-limit.ts`) câblé sur la soumission d'admission et l'envoi de magic-link,
**so that** un attaquant ne peut pas mail-bomber une victime ni brûler le quota Brevo (AR31) — la mitigation explicitement déférée par les reviews 1.6/1.7.

## Acceptance Criteria

> Source epic : `epics.md:804-810` (AR31). `UPSTASH_REDIS_REST_URL`/`_TOKEN` sont déjà dans l'env ([Source: `lib/env.ts:15-16`]) mais aucun code rate-limit n'existe et `@upstash/*` n'est pas installé. **[INFRA]** : le code + les tests (Upstash mocké) sont vérifiables ; le compteur réel nécessite une instance Upstash (vérif déférée).

---

### AC1 — `lib/rate-limit.ts` (Upstash sliding window) (AR31)

**When** la story est livrée
**Then** :

1. `pnpm add @upstash/ratelimit @upstash/redis`
2. **`lib/rate-limit.ts`** : un `Redis` depuis `env.server.UPSTASH_REDIS_REST_URL`/`_TOKEN` + des `Ratelimit` (sliding window) ; expose `checkLimit(key: string, limit: number, windowSeconds: number): Promise<{ success: boolean; reset: number }>`.
3. **Fail-open** : si Upstash est injoignable (timeout/erreur), `checkLimit` retourne `{ success: true }` + log `rate_limit.degraded` (**ne jamais** fail-closed sur l'auth — un Upstash down ne doit pas bloquer toute connexion).

**And** test unitaire avec `@upstash/ratelimit` **mocké** (`vi.mock`) : succès, dépassement, dégradation fail-open.

---

### AC2 — Wiring admission (5/jour/IP) (AR31)

**Given** `app/actions/admission-submit.ts` (Server Action publique)
**When** la story est livrée
**Then** en tête d'action : récupérer l'IP via `headers()` `x-forwarded-for` (premier hop), `checkLimit('admission:'+ip, 5, 86400)` ; dépassement → `Result.error({ ... errorCode: 'rate_limited' })` mappé sur `message_key: 'errors.rate_limit.exceeded'` (le form affiche un banner, pattern `duplicate_pending`). **Préserver** tout le flux existant (Zod, duplicate_pending, INSERT strict, notify co-mods).
**And** log `admission.rate_limited` (sans PII) ; test du cas dépassement (aucun generateLink/INSERT).

---

### AC3 — Wiring magic-link (3/15min/email) (AR31)

**Given** `app/actions/auth-signin.ts` (magic-link, anti-énumération redirect check-email)
**When** la story est livrée
**Then** avant `generateLink` : `checkLimit('magic:'+emailNormalisé, 3, 900)` ; dépassement → **toujours** redirect `/auth/check-email` (anti-énumération **préservée**) **mais sans** envoyer de lien + log `auth.rate_limited`.
**And** test : 4e tentative en 15 min → pas d'envoi, redirect check-email.

---

### AC4 — Helper 429 pour Route Handlers + i18n

**When** la story est livrée
**Then** un helper (dans `lib/rate-limit.ts` ou voisin) produit une `Response` **429** + header **`Retry-After`** (secondes jusqu'à `reset`) + body `{ error: { code:'rate_limited', message_key:'errors.rate_limit.exceeded' } }` ([Source: architecture.md:1463]) — prêt pour les futurs webhooks/cron.
**And** i18n `errors.rate_limit.exceeded` (FR : « Trop de tentatives. Réessaie dans un moment. ») + stub AR vide.
**And** **hors-scope (D5)** : rate-limit `POST /api/webhook/sms-consent` (AR38) — le webhook arrive **epic 2.4**. Le helper est prêt, le wiring viendra là-bas.

---

## Tasks / Subtasks

- [x] **T1 — `lib/rate-limit.ts`** (AC1) : add deps + factory sliding window + `checkLimit` fail-open + helper 429 + test mock.
- [x] **T2 — Wiring admission** (AC2) : IP `x-forwarded-for` + 5/j + Result.error rate_limited + test.
- [x] **T3 — Wiring magic-link** (AC3) : 3/15min/email + anti-énumération préservée + test.
- [x] **T4 — i18n** (AC4) : `errors.rate_limit.exceeded` FR + stub AR.

---

## Dev Notes

### Compliance

- **AR31** [architecture.md:1455-1464] : Upstash sliding window, `lib/rate-limit.ts`, 429+Retry-After+`errors.rate_limit.exceeded`. **AR16-19** conservés (Result, no-PII).
- **Fail-open obligatoire** côté auth/admission (un Upstash down ne bloque pas les users).

### Fichiers UPDATE (état & à préserver)

- `app/actions/auth-signin.ts` : magic-link (TTL 15, generateLink, **anti-énumération redirect check-email** quel que soit l'issue). Insérer le check **avant** generateLink, **préserver** l'anti-énumération.
- `app/actions/admission-submit.ts` : flux complet (duplicate_pending, INSERT strict, notify). Insérer le check en **tête**, préserver le reste. (Si 1.10a a déjà ajouté le catch 23505, ne pas le défaire.)
- `lib/env.ts` : `UPSTASH_REDIS_REST_URL`/`_TOKEN` présents (server). Ne pas modifier.

### Latest tech

- `@upstash/ratelimit` `Ratelimit.slidingWindow(limit, '15 m')` + `@upstash/redis` `Redis.fromEnv()`-like (ou explicite via env.server). Le `limit(key)` retourne `{ success, limit, remaining, reset }`. Envelopper dans un timeout court (~1s) pour le fail-open.

### Hors-scope

Webhook sms-consent (epic 2.4) · headers/CSP (1.10a) · tests RLS/a11y (1.10c) · backup/ops (1.10d).

### References

- epic : epics.md:804-810 · AR31 : architecture.md:1455-1464
- `app/actions/{auth-signin,admission-submit}.ts` · `lib/env.ts:15-16`
- deferred-work 1.6 #71 (rate-limit signin), 1.7 (admission)
- Upstash Ratelimit : https://github.com/upstash/ratelimit-js
- [[project_darna_mvp_fr_only]]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `bmad-dev-story`.

### Debug Log References

- `pnpm add @upstash/ratelimit@2.0.8 @upstash/redis@1.38.0`.
- `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ **173 passed / 5 skipped** (+6 : rate-limit 4, admission rate_limited 1, signin rate_limited 1) · `pnpm build` ✅.
- **Piège test résolu** : `vi.fn().mockImplementation(() => { throw })` est intercepté par le détecteur unhandled-rejection de vitest et fait échouer le test **même quand `checkLimit` catch** (aucune frame `checkLimit` dans la stack). Fix : le fake `Ratelimit.limit` lève **directement** dans sa méthode async (piloté par une variable `mode`), pas via une vi.fn.

### Completion Notes List

- **T1 — `lib/rate-limit.ts`** : `Redis` + cache d'instances `Ratelimit` (sliding window) par couple (limit, fenêtre) ; `checkLimit(key, limit, windowSeconds)` ; **fail-open** sur exception (log `rate_limit.degraded`, retourne `{success:true}`) — un Upstash down ne bloque JAMAIS l'auth/admission. Helper `tooManyRequests(reset)` → 429 + `Retry-After`. 4 tests (mock Upstash via `mode`).
- **T2 — Admission 5/j/IP** : `checkLimit('admission:'+ip, 5, 86400)` après validation Zod (on ne pénalise pas une saisie invalide), IP via `x-forwarded-for` premier hop ; dépassement → `{ ok:false, errorCode:'rate_limited' }` (nouveau membre de `SubmitState`) ; le form affiche un banner `errors.rate_limit.exceeded` (pattern duplicate). Flux 1.7 préservé (+ catch 23505 de 1.10a intact). Test du cas.
- **T3 — Magic-link 3/15min/email** : `checkLimit('magic:'+email.toLowerCase(), 3, 900)` avant generateLink ; dépassement → **redirect check-email SANS envoi** (anti-énumération préservée) + log `auth.rate_limited`. Test.
- **T4 — i18n** : `errors.rate_limit.exceeded` FR + stub AR vide.
- **Vérif live Upstash déférée pré-bêta** : le compteur réel (vraie instance Upstash EU) n'est pas testé localement ; le code est fail-open donc fonctionne même sans instance configurée.

### File List

**NEW**

- `lib/rate-limit.ts`
- `lib/rate-limit.test.ts`

**MODIFIED**

- `package.json` (+@upstash/ratelimit +@upstash/redis) · `pnpm-lock.yaml`
- `app/actions/admission-submit.ts` (+rate-limit 5/j/IP, +errorCode rate_limited, +clientIp)
- `app/actions/auth-signin.ts` (+rate-limit 3/15min/email, anti-énumération préservée)
- `app/[locale]/(public)/admission/admission-form.tsx` (+banner rate_limited)
- `messages/fr.json` (+errors.rate_limit.exceeded) · `messages/ar.json` (stub)
- `tests/admission/submit-action.test.ts` (+mock rate-limit +cas rate_limited)
- `tests/auth/signin-action.test.ts` (+mock rate-limit +cas rate_limited)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-10b → review)

### Change Log

- **2026-06-16** — Implémentation `bmad-dev-story` (Opus 4.8). 4/4 tâches : `lib/rate-limit` (sliding window fail-open + helper 429), wiring admission 5/j/IP + magic-link 3/15min/email (anti-énumération préservée), banner form, i18n. `typecheck/lint/test(173)/build` verts. Vérif live Upstash déférée pré-bêta (fail-open → app OK sans instance). Status : `review`.
- **2026-06-16** — Story créée par split de 1.10 (cluster B rate-limiting, Opus 4.8). ACs : lib/rate-limit fail-open, wiring admission 5/j/IP + magic-link 3/15min/email, helper 429, i18n. Status : `ready-for-dev`.

### Review Findings

- [x] [Review][Patch] `checkLimit` sans timeout : un hang Upstash (TCP stall sans rejection) suspend l'action pendant toute la durée du timeout Vercel (~30s) au lieu de fail-open immédiatement — ajouter `Promise.race` avec timeout ~2s [`lib/rate-limit.ts:50`]
- [x] [Review][Patch] Format fenêtre `'86400 s'` — utiliser la forme canonique `'1 d'` (moins de risque de bug du parser Upstash sur de grands compteurs secondes) [`lib/rate-limit.ts:31`]
- [x] [Review][Patch] Fail-open catch : `cause.name` seulement loggé — `cause.message` (contenant le détail utile ex. "401 Unauthorized", "ECONNREFUSED") silencieusement droppé, rend le diagnostic `rate_limit.degraded` inutilisable en prod [`lib/rate-limit.ts:58`]
- [x] [Review][Defer] IP spoofing via `x-forwarded-for` — sur Vercel, Vercel contrôle ce header et le premier hop est le vrai client IP ; en dehors de Vercel (staging custom), spoofable — mitiger via `x-real-ip` en fallback [`admission-submit.ts:41`] — deferred, Vercel prod mitigé
- [x] [Review][Defer] Singleton `redisSingleton` / `limiters` — unsafe si routes migrent vers Edge Runtime (module scope réinitialisé par isolate) ; OK pour Node.js Runtime actuel — deferred, noter dans commentaire
- [x] [Review][Defer] Pas de rate-limit IP sur `auth-signin.ts` — seul l'email est limité (3/15min) ; un attaquant avec N emails depuis 1 IP n'est pas bloqué — deferred, beyond AC3 scope
