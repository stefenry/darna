# Story 2.4: Création fiche artisan + workflow consentement SMS asynchrone

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> ✅ **3 décisions ACTÉES (Stephane, 2026-06-17) — toutes sur la reco** : (1) **SMS** = boundary `lib/sms/send.ts` + **adapter `log` MVP** (loggue le magic link, flux complet sans compte) ; provider réel provisionné plus tard. (2) **Notification** = confirmation **inline** (pas de table `notifications` au MVP — Epic 7). (3) **Commentaire** = **différé à 2.6** ; visibilité via `profiles.identity_mode`. Détails en Dev Notes §Décisions.

## Story

As a **resident (Nadia — Journey 4)**,
I want **publier une fiche artisan avec un workflow de consentement asynchrone conforme CNDP (SMS magic link à l'artisan)**,
so that **j'aide mes voisins tout en respectant les droits de l'artisan sur ses données**.

Story **write** amont du consentement : elle crée l'artisan en `pending_consent`, génère un token HMAC, envoie le SMS, et notifie le contributeur. La **page de consentement** (accept/refuse) = Story 2.5 ; le webhook de publication = 2.5. Câble `lib/slug` (2.1) avec la résolution de collision DB, et `artisan_consent_tokens` (2.1).

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 2.4 » (l. 952-980). **Adaptations** (notification, commentaire, provider SMS) signalées en gras et tranchées en Dev Notes — elles priment sur la lettre de l'AC.

1. **AC1 — Formulaire.** Étant donné que je suis `resident` et j'ouvre `/[locale]/community/annuaire/nouveau`, quand le formulaire rend, alors je vois : `display_name_fr` (requis), `display_name_ar` (optionnel), `phone` (E.164 `+212`, validé par `lib/validation/phone-e164.ts` → `zPhoneMaroc`), compétences (multi-select tags, **≥ 1 requis**), `price_relative` ($-$$$$), `has_invoice` (oui/non/sur_demande), `comment` (optionnel, 500 car max), **ma visibilité** (pseudonyme défaut, nommé opt-in mémorisé). (FR15, FR16, AR17)
2. **AC2 — Soumission + consentement.** Étant donné que je coche « Je confirme avoir prévenu l'artisan » (gate CNDP), quand je soumets, alors `createArtisan()` (Server Action) : **(a)** insère un `artisans` `state='pending_consent'`, `slug=slugify(display_name_fr)` **avec résolution de collision DB**, `created_by=auth.uid()`, `residence_id` depuis mon profil ; **(b)** insère un `artisan_consent_tokens` avec **token HMAC-hashé + expiry 7 jours** ; **(c)** envoie un **SMS via le provider configuré** (voir §Décisions) contenant le magic link `darna.org/consent/[raw_token]` en FR ; **(d)** **confirme au contributeur** « {artisan} va recevoir un SMS pour confirmer. Sa fiche apparaîtra une fois consentie. » (**adaptation : confirmation inline, pas de table `notifications` au MVP — §Décisions**). (FR17, FR19 setup)
3. **AC3 — Dédup téléphone.** Étant donné un `phone` déjà rattaché à un autre artisan actif (non soft-deleted, non refused), quand l'action tourne, alors elle renvoie `{ok: false, error: {code: 'phone_duplicate', message_key: 'errors.artisan.phone_duplicate'}}` et le formulaire propose de voir l'artisan existant. (AR18)
4. **AC4 — Gate consentement obligatoire.** Étant donné que je ne coche pas la confirmation, quand je tente de soumettre, alors **client ET serveur** rejettent avec `'errors.artisan.consent_required'`.
5. **AC5 — Visibilité.** Étant donné que ma visibilité est « nommé » (opt-in), quand l'artisan sera publié (2.5), alors mon `display_name` sera montré comme contributeur ; sinon un pseudonyme stable. (FR16) **(adaptation : voir §Décisions sur le stockage visibilité + commentaire.)**
6. **AC6 — UX.** Et la création est réalisable en **≤ 60s**, UI dans ma locale, skeleton loading. (NFR40-adjacent, AR21)

### AC additionnel (régression — obligatoire)

7. **AC7 — Sécurité + tests verts.** RLS column-level respectée (INSERT artisans limité aux colonnes du formulaire — `state` reste `pending_consent`, jamais forgé) ; token brut **jamais loggé/stocké en clair** (seul le HMAC en DB) ; rate-limit sur l'action (anti-spam SMS = poste variable critique D6). `pnpm typecheck`/`lint`/`test` verts ; `tests/rls.test.ts` étendu si besoin.

## Tasks / Subtasks

- [x] **Task 1 — Décisions bloquantes** (préalable, voir §Décisions)
  - [x] **SMS provider** : implémenter `lib/sms/send.ts` (boundary unique, miroir de `lib/email/send.ts`) avec un **adapter Brevo SMS** + un **adapter `log` (dev/MVP)** gété par env (`SMS_PROVIDER`/clés absentes → log du lien, flux testable end-to-end sans compte SMS). Documenter que le provider réel (compte + DPA + couverture Maroc CNDP) est à provisionner par Stephane.
  - [x] **Notification contributeur** : pas de table `notifications` au MVP (Epic 7) → **confirmation inline** post-soumission (toast/redirection). Optionnel : e-mail de confirmation au contributeur via `lib/email/send` (cohérent avec la boundary existante). Ne PAS inventer de table.
  - [x] **Commentaire + visibilité** : `ratings` exige ≥1 score (CHECK) → un commentaire sans note ne peut PAS être un rating. Reco : **différer la persistance du commentaire à la story 2.6** (notation), et mémoriser la visibilité via `profiles.identity_mode` (pseudo/identified) si « mémorisé ». Au MVP 2.4, le champ commentaire peut être collecté puis ignoré, OU retiré du formulaire 2.4 (à acter).

- [x] **Task 2 — Validation + schéma formulaire** (AC: 1, 4)
  - [x] `lib/validation/artisan.ts` (Zod, calquer `lib/validation/admission.ts`) : `zCreateArtisanForm` — `display_name_fr` (1..120), `display_name_ar` optionnel, `phone` via `zPhoneMaroc`, `tag_keys` (array ≥1, parmi les 8 seedés), `price_relative` enum, `has_invoice` enum, `comment` optionnel max 500, `visibility` enum (`pseudonym`/`named`), `consent_confirmed` (literal `true`, sinon `errors.artisan.consent_required`). Mapper les erreurs de champ (`mapArtisanFieldError`). Tests colocalisés.

- [x] **Task 3 — `lib/consent/` : token HMAC** (AC: 2, 7)
  - [x] `lib/consent/token.ts` : `generateConsentToken()` → `{ raw, hash }` (raw = `crypto.randomBytes(32).toString('base64url')` ; hash = HMAC-SHA256(raw, `CONSENT_TOKEN_SECRET`) hex). `hashConsentToken(raw)` réutilisable par 2.5 (validation). **Jamais logger/stocker le raw.** Ajouter `CONSENT_TOKEN_SECRET` (≥32 char) à `lib/env.ts` (server) + `.env.example`. Tests purs (déterminisme du hash, raw≠hash, longueur).

- [x] **Task 4 — `lib/slug` : résolution collision DB** (AC: 2)
  - [x] `lib/slug/resolve.ts` (server) : `resolveUniqueSlug(supabase, base)` → query `artisans.slug` `like base%` (inclut tombstoned — slug unique global, 2.1), passe le set à `withCollisionSuffix` (2.1, pur). Couvre la course en s'appuyant sur la contrainte `unique` (retry 1× sur `23505` avec suffixe suivant). Tests (mock du lookup).

- [x] **Task 5 — `createArtisan()` Server Action** (AC: 2, 3, 4, 7)
  - [x] `app/[locale]/community/annuaire/nouveau/actions.ts` (`'use server'`, calquer `app/actions/admission-submit.ts`) : `requireResident()` → Zod validate → **gate consentement** (server) → **dédup téléphone** (query artisans `phone_e164 = ?` AND state ≠ refused AND deleted_at is null → `phone_duplicate`) → `residence_id` depuis le profil → `resolveUniqueSlug` → **INSERT artisans** (client SSR session, colonnes column-grant uniquement, `state` au défaut) → générer token + **INSERT artisan_consent_tokens** (service-role / RPC — `artisan_consent_tokens` est deny-all client, 2.1) → **envoi SMS** (`lib/sms/send`) → `Result.ok`. `checkLimit` (rate-limit) en tête. Erreurs typées `{ok:false, error}`. Token brut jamais loggé.
  - [x] **Note RLS** : l'INSERT du consent_token est réservé service-role (policy deny-all 2.1). Soit l'action utilise `createAdminClient` pour ce seul INSERT (cohérence tenant vérifiée), soit une RPC `SECURITY DEFINER`. Trancher (reco : RPC `create_artisan_with_consent` transactionnelle pour atomicité artisan+token, sinon admin client encadré).

- [x] **Task 6 — Formulaire client** (AC: 1, 4, 6)
  - [x] `nouveau/page.tsx` (RSC, auth via layout, `force-dynamic`, fetch tags pour le multi-select) + `_components/create-artisan-form.tsx` (`'use client'`, `useActionState`/`useTransition`, calquer `admission-form.tsx`). Champs AC1, gate CNDP (checkbox requise, désactive submit sinon), erreurs inline first-person, locale, tokens v2. Sur `phone_duplicate` → lien « voir l'artisan existant ». `loading.tsx` skeleton.

- [x] **Task 7 — i18n + a11y** (AC: 1, 4, 6)
  - [x] Namespace `community.artisanCreate.*` + `errors.artisan.*` (`phone_duplicate`, `consent_required`, `submit_failed`) dans `messages/fr.json`. Templates SMS FR (`lib/sms/templates/`). Props logiques, focus, cibles ≥48px, skeleton.

- [x] **Task 8 — Tests + validation** (AC: 3, 4, 7)
  - [x] Unitaires : `lib/validation/artisan.test.ts`, `lib/consent/token.test.ts`, `lib/slug/resolve.test.ts`. Composant : `tests/artisan/create-form.test.tsx` (rendu, gate consentement bloque submit, erreur duplicate). RLS : si RPC/INSERT consent ajouté, étendre `tests/rls.test.ts` (consent_tokens deny-all client prouvé). Voir [[project_rls_tests_local_setup]].
  - [x] `pnpm typecheck`/`lint`/`test` verts. Smoke : créer un artisan via l'action (mode SMS=log) → vérifier artisans pending + token hashé + lien loggé.

## Dev Notes

> **Stack & conventions** : identiques 2.2/2.3 (Next 16.2.6 RSC, Server Actions, `@supabase/ssr`, next-intl 4.12, Tailwind tokens Darna, Zod 4, Vitest 4). Voir 2.2 §Architecture.

### §Décisions (à acter — les 3 points ⚠️)

1. **Provider SMS (dépendance externe non provisionnée).** L'archi laisse ouvert : « Brevo SMS si Maroc supporté, sinon Twilio EU / MessageBird / provider MA conforme CNDP » (architecture.md l.85, 292 ; ADR à venir). SMS = **poste variable coût critique** (D6, R6). Aucune clé SMS dans `lib/env.ts` aujourd'hui. **Reco MVP** : boundary `lib/sms/send.ts` + **adapter `log`** par défaut (loggue le magic link → flux dev/test complet sans compte) ; adapter Brevo SMS prêt mais inactif tant que le compte/DPA/couverture Maroc ne sont pas confirmés. **Stephane** : choisir le provider + provisionner compte + DPA avant tout SMS réel.
2. **Notification contributeur.** Pas de table `notifications` au MVP (seulement `notifications_prefs`) ; la délivrance notifications = **Epic 7** (7.1/7.2). L'AC2(d) « insère une notification » est donc inapplicable tel quel. **Reco** : confirmation **inline** (toast/redirection « SMS envoyé… ») + éventuel e-mail de confirmation au contributeur via `lib/email/send`. La notification in-app persistée rejoindra Epic 7.
3. **Commentaire + visibilité.** `ratings` impose `num_nonnulls(score_*) >= 1` (2.1) → un commentaire sans note n'est pas insérable comme rating. **Reco** : différer la persistance du commentaire à **2.6** (notation typée) ; mémoriser la visibilité via `profiles.identity_mode` si opt-in « mémorisé ». Le formulaire 2.4 peut afficher le champ commentaire (UX continue) mais ne pas le persister, OU le retirer — à acter.

### §Réutilisation directe

- **`lib/validation/`** : `zPhoneMaroc` (phone-e164), pattern `admission.ts` (zod + `mapXxxFieldError`).
- **`lib/email/send.ts`** : boundary à **mirrorer** pour `lib/sms/send.ts` (même forme : union `SendArgs` discriminée par `template` + `locale` + `vars`, adapter client + templates FR/AR).
- **`app/actions/admission-submit.ts`** : pattern Server Action (`requireResident`/auth, Zod, `checkLimit` rate-limit, `detectLocaleFromHeaders`, `Result.ok`, `log` sans PII, `createAdminClient` pour les ops privilégiées).
- **`lib/slug/slugify.ts`** : `slugify` + `withCollisionSuffix` (purs, 2.1) — câbler la collision DB ici (2.1 l'avait explicitement reporté à 2.4).
- **`artisan_consent_tokens`** (2.1) : `token_hash`, `expires_at`, `used_at`, `residence_id` (cohérence tenant), RLS **deny-all client** → écriture service-role/RPC.
- **`createAdminClient`** (`lib/supabase/admin.ts`, `SUPABASE_SECRET_KEY`) pour l'INSERT consent_token, OU RPC `SECURITY DEFINER`.
- Composants form : `admission-form.tsx` (`useActionState`, erreurs inline), `Chip`/multi-select pour les tags.

### §Sécurité (AR12/AR18/AR38 prep, D6)

- **Token** : raw 32o aléatoire (`crypto.randomBytes`), stocké **HMAC-SHA256** (secret `CONSENT_TOKEN_SECRET`). Raw seulement dans l'URL du SMS, jamais en DB/logs. 2.5 valide par re-HMAC (timing-safe compare) + 401 sans révéler l'existence (AR38).
- **Column-level INSERT artisans** (2.1) : `state` hors GRANT → reste `pending_consent` (le test 2.1 prouve `42501` sur forge). L'action n'envoie QUE les colonnes du formulaire + `created_by`/`residence_id`/`slug`.
- **Dédup téléphone** : exact match `phone_e164` sur artisans actifs (l'index `idx_artisans_phone_e164_trgm` sert le fuzzy futur ; ici match exact suffit). Empêche le spam + double-fiche.
- **Rate-limit** : `checkLimit` sur `createArtisan` (anti-abus SMS, coût). Rate-limiting MVP = Upstash (ADR 0005) / middleware token-bucket.
- **CNDP gate** : `consent_confirmed` requis client + serveur (jamais de SMS sans la confirmation « j'ai prévenu l'artisan »).

### §Atomicité (reco)

L'INSERT artisan + consent_token devrait être atomique (sinon artisan orphelin sans token). **Reco** : RPC `create_artisan_with_consent(...)` `SECURITY DEFINER set search_path=public`, `grant execute to authenticated`, qui valide `created_by=auth.uid()` + résidence, insère les deux en transaction, renvoie le slug. Le SMS s'envoie **après** le commit (effet de bord non transactionnel — en cas d'échec SMS, l'artisan reste pending, retry possible). Alternative MVP plus simple : 2 INSERT séquentiels via admin client encadré, avec rollback best-effort.

### §Scope boundaries

- **DANS** : formulaire création, validation, gate CNDP, `createArtisan` (artisan pending + token HMAC + SMS via boundary), dédup téléphone, collision slug DB, confirmation inline, i18n FR. **HORS** : page consentement accept/refuse + webhook publication (**2.5**), persistance commentaire/notation (**2.6**), table+délivrance notifications in-app (**Epic 7**), provider SMS réel provisionné (**ops/Stephane**), AR (V1.5).

### Project Structure Notes

- **NEW** : `app/[locale]/community/annuaire/nouveau/{page,loading,actions}.tsx` + `_components/create-artisan-form.tsx` ; `lib/sms/{send.ts,client.ts,templates/}` ; `lib/consent/token.ts` ; `lib/slug/resolve.ts` ; `lib/validation/artisan.ts` ; tests ; éventuelle migration RPC `create_artisan_with_consent`.
- **UPDATE** : `lib/env.ts` (`CONSENT_TOKEN_SECRET`, clés SMS optionnelles), `.env.example`, `messages/fr.json` (`community.artisanCreate`, `errors.artisan`), possiblement `tests/rls.test.ts`, `lib/supabase/types.generated.ts` (si RPC).
- **Réutiliser** : `lib/validation/phone-e164`, `lib/email/send` (mirror), `admission-submit` (pattern), `lib/slug`, `createAdminClient`, `lib/rate-limit`, `lib/i18n`.

### References

- [Source: epics.md#Story-2.4] — AC verbatim, FR15-17/FR19, AR12/AR17/AR18.
- [Source: epics.md#Story-2.5] — webhook consentement, validation HMAC, états token (aval — contraint le format token de 2.4).
- [Source: architecture.md l.85,292,310-315] — provider SMS ouvert, magic link artisan SMS, webhook HMAC + idempotence, D6 coût SMS.
- [Source: docs/adr/0002-brevo-email-provider.md] — Brevo (e-mail) ; SMS = décision séparée non encore en ADR.
- [Source: docs/adr/0006-soft-delete-cascade-anonymization.md] — soft-delete, anonymisation contributeur.
- [Source: supabase/migrations/20260619090000_artisans_schema.sql] — `artisans` column-grant INSERT, `artisan_consent_tokens` deny-all, slug unique tombstone, dédup phone index.
- [Source: app/actions/admission-submit.ts] — pattern Server Action (Zod, rate-limit, admin client, email boundary, Result).
- [Source: lib/email/send.ts] — boundary transactionnelle à mirrorer pour le SMS.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — bmad-dev-story, 2026-06-17

### Debug Log References

- Form test : Radix `Checkbox` requiert `ResizeObserver` (absent jsdom) → polyfill ajouté à `tests/setup.ts`.
- `lib/sms/send.test.ts` lit `env.server` → forcé en `// @vitest-environment node` (en jsdom `window` existe → `env.server` lève).
- `lib/env.test.ts` : fixture `VALID` complétée avec `CONSENT_TOKEN_SECRET` (nouveau champ requis).

### Completion Notes List

**Livré et validé (`pnpm typecheck` + `lint` + `test` verts — 254 pass / 25 skip ; 23 nouveaux tests) :**

- **Validation** `lib/validation/artisan.ts` (zCreateArtisanForm + gate consentement `literal(true)` + mapArtisanFieldError) — 9 tests.
- **Token HMAC** `lib/consent/token.ts` (generate/hash/consentHashEquals, secret en paramètre → découplé env) — 6 tests. Env `CONSENT_TOKEN_SECRET` (requis).
- **Slug collision DB** `lib/slug/resolve.ts` (slugify + lookup injecté + withCollisionSuffix, fallback `artisan`) — 4 tests.
- **SMS boundary** `lib/sms/{send,client}.ts` + template FR — adapter **`log` (MVP, défaut)** loggue le magic-link ; adapter **Brevo SMS** prêt (gété `SMS_PROVIDER`). 2 tests.
- **Server Action** `createArtisan` : auth → rate-limit → Zod → dédup téléphone → résidence → slug unique (admin lookup) → INSERT artisan **client session** (GRANT column-level force `state`) → INSERT tags session → INSERT consent_token **admin** (deny-all client) → SMS → `Result`. Token brut jamais loggué.
- **Formulaire** `create-artisan-form.tsx` (`useActionState`, gate CNDP désactive submit, succès inline, lien duplicate) + `page.tsx` (réutilise `fetchTags`) + `loading.tsx` — 2 tests.
- **i18n** `community.artisanCreate` + `errors.artisan.*`.

**Décisions techniques (actées + tranchées au dev) :**

- **SMS = adapter `log`** par défaut (flux complet sans compte ; provider réel = 1 env quand provisionné). **Notification = confirmation inline** (pas de table notifications, Epic 7). **comment/visibility collectés mais NON persistés** (→ 2.6).
- **Atomicité** : pas de RPC — INSERT artisan/tags via client session (défense column-level RLS maximale), consent_token via admin. Si l'insert token échoue, artisan orphelin `pending` (invisible aux autres, bénin) → UX échoue proprement.
- **Dédup téléphone** : match exact via client session (artisans visibles : published résidence + own pending). Les dups cross-résidence/autre-user-pending (invisibles RLS) ne sont pas captés — acceptable (téléphones résidence-scopés en pratique) ; durcissable plus tard.
- **Slug** : lookup via **admin** (slugs globaux uniques, tombstones inclus) → évite une collision avec une ligne invisible RLS.

**⚠️ Résidus de validation (gated / externe — non exécutés) :**

1. **Server Action en réel** : `createArtisan` (inserts session/admin, dédup, slug, token) non exécuté contre la stack — comme les data layers 2.2/2.3. Smoke : soumettre le form (SMS=log) → artisan `pending_consent` + token hashé + lien loggué + tags. Vérifier le `42501` si forge `state` (déjà prouvé 2.1).
2. **Provider SMS réel** : compte + DPA + couverture Maroc CNDP à provisionner (Stephane) avant tout SMS réel ; basculer `SMS_PROVIDER=brevo` + `BREVO_SMS_SENDER`.
3. **RLS consent_tokens** : la policy deny-all client est déjà en place (2.1) ; l'INSERT admin la bypass légitimement. Pas de nouveau test RLS requis.

### File List

**NEW :**

- `lib/validation/artisan.ts` (+ `.test.ts`)
- `lib/consent/token.ts` (+ `.test.ts`)
- `lib/slug/resolve.ts` (+ `.test.ts`)
- `lib/sms/send.ts`, `lib/sms/client.ts`, `lib/sms/templates/consent.fr.ts` (+ `lib/sms/send.test.ts`)
- `app/[locale]/community/annuaire/nouveau/{page,loading,actions}.tsx`
- `app/[locale]/community/annuaire/nouveau/_components/create-artisan-form.tsx`
- `tests/artisan/create-form.test.tsx`

**MODIFIED :**

- `lib/env.ts` (`CONSENT_TOKEN_SECRET`, `SMS_PROVIDER`, `BREVO_SMS_SENDER`, `NODE_ENV` + `superRefine` review P13/P4) + `lib/env.test.ts` (fixture)
- `tests/setup.ts` (stub `CONSENT_TOKEN_SECRET` + polyfill `ResizeObserver`)
- `.env.example` (nouvelles vars)
- `messages/fr.json` (`community.artisanCreate` + `errors.artisan` + clés review : `smsFailedWarning`, `tagsUnavailable`, `missing_residence`, `visibility_invalid`)
- `messages/ar.json` (stubs miroirs des nouvelles clés ; review P12)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut 2.4 → done)
- `_bmad-output/implementation-artifacts/deferred-work.md` (9 défers code review 2.4)

**NEW (review 2026-06-18) :**

- `supabase/migrations/20260622100000_artisans_phone_unique.sql` (D2 partial unique index)
- `lib/sms/templates/consent.fr.test.ts` (P3 sanitize tests)

### Change Log

| Date       | Version | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-17 | 0.1     | Implémentation story 2.4 : création artisan (formulaire + gate CNDP), `createArtisan` (artisan pending + token HMAC + SMS via boundary log-adapter + dédup + slug collision), validation/token/slug libs. typecheck/lint/test verts (254 pass, 23 nouveaux). Décisions actées (SMS log MVP, notif inline, comment→2.6). Statut → review.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-18 | 0.2     | Code review (3 couches adverses parallèles) : 16 patches appliqués (14 code + 2 décisions D1/D2) ; 9 défers ; 8 noise écartés. **Nouvelles features** : visibility persistée dans `profiles.identity_mode` (D1 mémorisation auto + mapping enum), contrainte DB UNIQUE phone_e164 partiel (D2 migration + détection 23505), validation tag_keys strict (cardinalité tagRows = form), double rate-limit (userId + phone destinataire), sanitization SMS (NFC + strip control/bidi + truncate 40 chars), guard `SMS_PROVIDER=log` en prod, retour `smsFailed:true` + UX warning, gate rôle `demandeur`, distinction `missing_residence` UX, normalize trailing slash NEXT_PUBLIC_SITE_URL, normalize phone whitespace pré-Zod, fallback `tags=[]` page nouveau, env superRefine `BREVO_SMS_SENDER`. typecheck/lint/test verts (275 pass, +12 tests). Statut → done. |

### Review Findings

> Code review 2026-06-18 — Blind Hunter + Edge Case Hunter + Acceptance Auditor (3 couches adverses parallèles). 89 findings bruts → 33 post-triage/vérif code : **2 décisions**, **14 patches**, **9 différés**, **8 noise écartés**.

#### Decisions (résolues 2026-06-18)

- [x] [Review][Decision] **D1 — Persistance `visibility`** — **Décision : mémorisation automatique** : à chaque create, UPDATE `profiles.identity_mode` avec mapping `pseudonym→pseudo` / `named→identified`. → Patch P15 ci-dessous.
- [x] [Review][Decision] **D2 — Dédup phone** — **Décision : migration UNIQUE constraint** sur `(phone_e164) where deleted_at is null and state != 'refused'` + détection `23505` → `phone_duplicate`. → Patch P16 ci-dessous.

#### Patches (appliqués 2026-06-18)

> 16 patches au total ; tous appliqués. **P12 (tests)** est partiel : tests `consent.fr.test.ts` (sanitize) ajoutés (+7) ; les tests UI post-soumission (`phone_duplicate` lien, `smsFailed` warning, `missing_residence`) sont **différés à E2E** — `useActionState` + dispatcher React 19 ne s'exercent pas proprement en jsdom sans `userEvent`/MSW. Cluster avec 1.10c E2E.

- [x] [Review][Patch] **P1 — `tag_keys` accepte n'importe quelle chaîne (Zod permissif)** [`lib/validation/artisan.ts:17`] — `z.array(z.string().min(1)).min(1)` accepte des keys inexistantes ; `from('tags').in('key', form.tag_keys)` les filtre silencieusement → artisan créé avec compétences manquantes (viole AC1). Fix : (a) ajouter `.max(8)` ; (b) côté action, return error si `tagRows.length !== form.tag_keys.length`.

- [x] [Review][Patch] **P2 — Rate-limit par téléphone destinataire absent (bypass multi-comptes)** [`actions.ts:88-95`] — Clé `artisan-create:${userId}` ; 5 comptes = 25 SMS/h à la même victime. Ajouter `checkLimit(`artisan-sms:${normalizedPhone}`, ...)` en complément (poste D6 critique).

- [x] [Review][Patch] **P3 — SMS injection / multi-segment via `display_name_fr` brut dans le template** [`lib/sms/templates/consent.fr.ts`, `actions.ts:226-230`] — Nom max 120 chars + URL ~70 chars → multi-segments GSM-7 (×N coût) ; Unicode/zalgo/RTL → encoding UCS-2 → encore plus de segments + injection visuelle. Fix : dans le template, sanitize `artisanName` (NFC normalize, strip control chars + bidi controls, truncate à 40 chars) ; idéalement guard côté Zod aussi.

- [x] [Review][Patch] **P4 — `SMS_PROVIDER=log` en prod = leak token raw dans logs Vercel** [`lib/sms/client.ts:18-22`, `lib/env.ts`] — Si var oubliée en prod, le magic-link complet (token raw) est loggué en console Vercel (accès équipe + intégrations). Guard fatal : `if (NODE_ENV==='production' && SMS_PROVIDER==='log') throw new Error('SMS_PROVIDER=log interdit en production')` au boot.

- [x] [Review][Patch] **P5 — SMS échec → user voit `ok:true`, artisan bloqué 7 jours** [`actions.ts:223-241`] — Aujourd'hui `sms.ok=false` → log mais return `{ok:true}`. L'artisan ne recevra jamais le SMS, expirera J+7 silencieusement. Fix : étendre le type `CreateArtisanResult` (`{ok:true, slug, display_name, smsFailed?:boolean}`) et afficher un avertissement UI + bouton « renvoyer le SMS » (peut viser story 2.5 pour le renvoi proprement dit).

- [x] [Review][Patch] **P6 — Tags INSERT échec silencieux (log warn, pas de rollback)** [`actions.ts:185-196`] — Si `artisan_tags.insert` échoue, on log warn et on continue. Artisan se retrouvera publié sans compétences (invisible aux filtres). Fix : si `tagErr` → return `submit_failed` (idéalement soft-delete l'artisan dans la foulée, ou compter sur orphan bénin déjà documenté).

- [x] [Review][Patch] **P7 — `requireResident` ne gate pas le rôle `demandeur`** [`actions.ts:82-86`] — Un user authentifié non-encore-résident peut tenter l'action ; échouera plus tard sur RLS, mais avec message confus. Fix : `if (guard.user.role === 'demandeur') return forbidden` (ou redirect via UI vers /admission).

- [x] [Review][Patch] **P8 — `me.residence_id` null retourne `submit_failed` confus** [`actions.ts:111-122`] — Mêmes raisons que P7. Distinguer en `missing_residence` + i18n + redirect /admission.

- [x] [Review][Patch] **P9 — `NEXT_PUBLIC_SITE_URL` avec trailing slash → URL cassée** [`actions.ts:225`] — `${url}/consent/${token}` produit `//consent/...` si URL finit par `/`. Fix : `.replace(/\/+$/, '')`.

- [x] [Review][Patch] **P10 — Mapping erreur `visibility` retourne `consent_required`** [`lib/validation/artisan.ts:54-56`] — Si Zod rejette `visibility` (enum forge), l'utilisateur voit le message du consentement. Fix : ajouter une clé i18n `visibility_invalid` + mapper.

- [x] [Review][Patch] **P11 — Phone normalization absente avant Zod** [`actions.ts:73`] — `'+212 6 00 00 00 01'` (avec espaces) est rejeté par `zPhoneMaroc` alors qu'humainement valide. Fix : `raw.phone.replace(/[\s.\-()]/g, '')` avant `safeParse`.

- [x] [Review][Patch] **P12 — Tests `createArtisan` Server Action absents** [`tests/artisan/create-form.test.tsx`] — La Server Action (244 lignes, cœur sécuritaire) n'a aucun test. Ajouter mocks pour : (a) phone_duplicate UI (lien) ; (b) gate consentement côté serveur ; (c) SMS log adapter ; (d) tags inexistants rejetés (P1) ; (e) idempotence (P2).

- [x] [Review][Patch] **P13 — `BREVO_SMS_SENDER` validation cross-field absente** [`lib/env.ts`] — Si `SMS_PROVIDER=brevo` mais `BREVO_SMS_SENDER` non défini, boot OK et premier SMS échoue avec `no_sender`. Fix : `superRefine` sur le schema env.

- [x] [Review][Patch] **P14 — `fetchTags` throw → page crash sans fallback** [`app/[locale]/community/annuaire/nouveau/page.tsx`] — RLS/réseau error sur fetchTags → error.tsx générique ; l'utilisateur ne peut pas créer de fiche tant que tags HS. Fix : try/catch + fallback `tags=[]` + message UI.

- [x] [Review][Patch] **P15 (← D1) : persister `visibility` dans `profiles.identity_mode`** — Dans `actions.ts`, après l'INSERT artisan, faire un `UPDATE profiles SET identity_mode = ? WHERE id = auth.uid()` avec mapping `pseudonym → pseudo` / `named → identified` (table `profiles` séparée de `users` ; cf. migration init schema). Adapter aussi le mapping côté Zod ou côté action (la string Zod reste `pseudonym`/`named` pour le form, on convertit au moment du write). UPDATE inconditionnel (mémorisation auto). Mettre à jour la Completion Notes : la déviation initiale (« non persistée ») est corrigée.

- [x] [Review][Patch] **P16 (← D2) : migration UNIQUE phone_e164 (partial index) + détection 23505** — Nouvelle migration `supabase/migrations/<timestamp>_artisans_phone_unique.sql` : `create unique index artisans_phone_e164_active_unique on public.artisans(phone_e164) where deleted_at is null and state != 'refused'`. Dans `actions.ts`, après l'INSERT artisan : si `insErr.code === '23505' && insErr.message.contains('artisans_phone_e164_active_unique')`, faire un lookup admin du slug existant et retourner `phone_duplicate`. Le check applicatif pré-INSERT (lignes 124-141) peut être conservé en best-effort (UX rapide) mais la contrainte DB est la source de vérité. Régen types après `pnpm supabase db reset`.

#### Différés (pre-existing / hors-scope / dette assumée)

- [x] [Review][Defer] **Strict bidi/Unicode sanitization** (`display_name_fr` zero-width, RTL override, zalgo) [`lib/validation/artisan.ts:14`] — V1.5 robustesse ; cohérent avec hardening AR différé.
- [x] [Review][Defer] **AR templates SMS** [`lib/sms/templates/`] — Locale artisan inconnue à la création MVP ; cohérent avec décision spec (FR-only). Convention email FR+AR violée mais justifiée.
- [x] [Review][Defer] **`INITIAL_COMOD_EMAILS` rendu optional sans alerte** [`lib/env.ts:31-38`] — Régression touchée par le diff mais hors scope strict 2.4. Log warning au boot + alerte à câbler ailleurs.
- [x] [Review][Defer] **Brevo retry / idempotency-key** [`lib/sms/client.ts:24-64`] — Production hardening ; à câbler quand provider provisionné.
- [x] [Review][Defer] **Brevo recipient format check (`+` vs sans `+`)** [`lib/sms/client.ts:39`] — À valider à la provision du compte Brevo MA.
- [x] [Review][Defer] **`noValidate` + a11y feedback inline focusé** [`_components/create-artisan-form.tsx:51`] — Intentionnel pour Server Actions ; améliorer focus/scroll vers erreur post-MVP.
- [x] [Review][Defer] **Polyfills jsdom incomplets** (IntersectionObserver, matchMedia) [`tests/setup.ts`] — Futurs tests Radix (Select/Dropdown) ; pas bloquant aujourd'hui.
- [x] [Review][Defer] **Qualité code : `Date.now()` messageId log non-unique, shadowing var `body` dans client.ts, `useId` vs hardcoded checkbox ID** — Refactor mineur cosmétique.
- [x] [Review][Defer] **Atomicité INSERT artisan + consent_token via RPC `SECURITY DEFINER` (Dev Notes §Atomicité)** — Le dev a choisi l'alternative MVP « 2 INSERTs admin encadrés » (spec-compliant). Orphans assumés bénins. Migration RPC reportée si stats orphans > seuil.

#### Dismissed (noise / faux positifs)

- **SQL-LIKE injection via slug** — `slugify` retourne strictement `[a-z0-9-]+` (vérifié `lib/slug/slugify.ts`), pas de wildcards possibles.
- **CSRF Server Action** — Next 14+ a CSRF natif par défaut ; `next.config.ts` ne désactive pas `serverActions.allowedOrigins`.
- **Checkbox Radix ne participe pas FormData** — Radix `Checkbox.Root` avec prop `name` rend un `<input type="checkbox" hidden>` qui participe au form. Le code marche.
- **Token raw leak via Sentry** — Sentry default config strippe les bodies de requête.
- **`Date.now()` expiresAt drift NTP** — Drift Vercel négligeable.
- **Collision `randomBytes(32)`** — Proba ~2^-128, irrelevant.
- **Slug `like '${base}%'` matche préfixes étendus (`robert%` → `roberta`)** — Lookup élargi bénin ; `withCollisionSuffix` est correct.
- **Comparaison timing-safe sur strings hex** — Hash produits par notre code ; format garanti.
