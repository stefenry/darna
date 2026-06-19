# Story 2.5: Page magic link consentement artisan (accept/refuse 1-tap, sans compte)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> ⚠️ **3 décisions/changements structurants** (détaillés en Dev Notes) : (1) route `/consent/[token]` **hors `[locale]`** (matche le lien SMS sans préfixe) → exclure du middleware next-intl ; (2) **migration enum** `moderation_action` (+ valeurs consentement) ; (3) **RPC `SECURITY DEFINER`** pour la transaction accept/refuse (appelant public, sans auth) + 2 templates e-mail.

## Story

As an **artisan (Fatima — Journey 4)**,
I want **recevoir un SMS magic link et accepter/refuser ma fiche en un tap, sans créer de compte**,
so that **mon consentement CNDP est capturé proprement tout en restant sans friction**.

Story aval directe de 2.4 : elle **consomme le token HMAC** (`lib/consent/token`, `artisan_consent_tokens`) émis par 2.4 et **publie ou refuse** l'artisan. Page **publique token-based** (aucune session créée). Ferme la boucle de consentement asynchrone (CC #20).

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 2.5 » (l. 984-1016). Précisions techniques (route hors-locale, enum, RPC) en Dev Notes — elles priment.

1. **AC1 — Page consentement.** Étant donné que l'artisan clique le magic link `darna.org/consent/[token]`, quand la page charge (**sans authentification** — accès token-based), alors une page **publique** montre la fiche proposée (`display_name`, compétences, commentaire contributeur, mention pseudonyme/nommé) avec deux boutons « J'accepte » / « Je refuse », **en FR par défaut (avec toggle FR/AR)**. (FR18)
2. **AC2 — Accept.** Étant donné que l'artisan tape « J'accepte », quand le form poste vers `app/api/webhook/sms-consent/route.ts` (Route Handler, **validation HMAC** AR38), alors **en transaction** : (a) `artisans.state='published'`, `published_at=now()` ; (b) `artisan_consent_tokens.used_at=now()` (**idempotent** — re-clic → « Déjà accepté ») ; (c) le contributeur reçoit un e-mail Brevo « La fiche de [name] est en ligne » dans sa locale **+ confirmation** (notification in-app = Epic 7) ; (d) `moderation_log` enregistre l'événement de consentement. (FR19)
3. **AC3 — Refuse.** Étant donné que l'artisan tape « Je refuse », quand l'action tourne, alors (a) `artisans.state='refused'`, **soft-deleted** ; (b) le token est marqué `used_at` ; (c) le contributeur reçoit un e-mail neutre « L'artisan a décliné la publication — vos données ont été supprimées ». (FR19, NFR18)
4. **AC4 — Token expiré (> 7 j).** Étant donné un token expiré, quand l'artisan ouvre l'URL, alors la page affiche « Cette demande de consentement a expiré… demandez à votre voisin de soumettre une nouvelle fiche » — **aucune action possible**.
5. **AC5 — Token déjà utilisé.** Étant donné `used_at IS NOT NULL`, quand l'artisan ouvre l'URL, alors la page montre l'état courant (« Vous avez accepté votre fiche le X ») avec un lien pour la consulter (si publiée).
6. **AC6 — Token falsifié (HMAC mismatch).** Étant donné un token trafiqué, quand la requête atteint la route, alors **HTTP 401** est renvoyé **sans révéler si le token a jamais existé** (AR38). La page affiche un message générique « lien invalide ou expiré ».
7. **AC7 — Pas de session.** Et **aucune session artisan n'est créée** — accès token-based à cette seule action de consentement.

### AC additionnel (régression — obligatoire)

8. **AC8 — Sécurité + tests verts.** Comparaison de hash **timing-safe** (`consentHashEquals`, 2.4) ; écritures via **service-role/RPC** uniquement (la page/route est publique) ; le token brut n'apparaît jamais en DB/logs. `pnpm typecheck`/`lint`/`test` verts ; `tests/rls.test.ts` étendu si pertinent (consent_tokens deny-all client déjà couvert).

## Tasks / Subtasks

- [x] **Task 1 — Migration : enum moderation + RPC consentement** (AC: 2, 3, 8)
  - [x] Migration `<ts>_artisan_consent.sql` : `alter type public.moderation_action add value 'artisan_published'` + `'artisan_consent_refused'` (⚠️ `ADD VALUE` ne peut pas tourner dans un bloc transactionnel avec d'autres DDL selon PG — séparer si besoin ; commit avant usage).
  - [x] RPC `public.process_artisan_consent(p_token_hash text, p_decision text)` `SECURITY DEFINER set search_path=public`, `grant execute to anon, authenticated` (appelant public sans session). Atomique : lookup token par `token_hash` ; si introuvable/expiré/déjà utilisé → renvoyer un statut discriminé (`not_found`/`expired`/`already_used`) **sans lever** (la route mappe vers 401/410/idempotent) ; sinon : `accept` → `artisans.state='published', published_at=now()` ; `refuse` → `state='refused'` + soft-delete (`deleted_at=now()`, `deletion_reason='consent_refused'`) ; dans les deux cas `used_at=now()` + INSERT `moderation_log` (`actor_id=null`, `target_kind='artisan'`, `target_id=artisan_id`, action selon décision). Renvoyer `{status, artisan_id, slug, contributor_id, display_name, state}` pour l'e-mail. **Tout en une transaction.**
  - [x] `pnpm supabase db reset` + `pnpm gen:types` (la RPC + enum apparaissent dans les types). Voir [[project_rls_tests_local_setup]] pour la stack locale.

- [x] **Task 2 — Validation token (lecture)** (AC: 1, 4, 5, 6)
  - [x] `lib/consent/lookup.ts` (server) : `resolveConsentToken(raw)` → hash via `hashConsentToken(raw, env.server.CONSENT_TOKEN_SECRET)` → lookup `artisan_consent_tokens` par `token_hash` (client **admin**, deny-all client) + jointure artisan (display_name, slug, state, tags, contributor comment si 2.6 livré). Renvoie un statut discriminé : `invalid` (introuvable → message générique, AR38), `expired`, `used` (avec état artisan), `valid` (fiche à afficher). Comparaison `consentHashEquals` pour la robustesse timing.

- [x] **Task 3 — Route Handler webhook** (AC: 2, 3, 6, 8)
  - [x] `app/api/webhook/sms-consent/route.ts` (POST, **hors `[locale]`**). Body : `{ token: raw, decision: 'accept'|'refuse' }` (form-encoded). Hash le raw → `supabase.rpc('process_artisan_consent', { p_token_hash, p_decision })` via client **admin** (ou anon — la RPC est SECURITY DEFINER). Mapper le statut : `not_found` → **401** générique (AR38, ne révèle rien) ; `expired` → 410/redirection page expirée ; `already_used` → idempotent (redirige vers la page « déjà traité ») ; succès → envoyer l'e-mail contributeur (accept/refuse, locale du contributeur) via `lib/email/send`, puis redirection vers la page de confirmation. Rate-limit léger (anti-bruteforce token).
  - [x] **Idempotence** : un re-POST sur un token `used` ne change rien et renvoie l'état courant (pas d'erreur).

- [x] **Task 4 — Page publique `/consent/[token]`** (AC: 1, 4, 5, 6, 7)
  - [x] `app/consent/[token]/page.tsx` (**hors `[locale]`**, RSC, public — pas de `requireResident`). Appelle `resolveConsentToken`. Selon le statut : `valid` → fiche proposée + form (2 boutons POST vers le webhook) + **toggle FR/AR** (la page gère la locale en interne, défaut FR) ; `expired`/`invalid`/`used` → écran dédié. `loading.tsx`. **Aucune session** (ne pas instancier de client auth pour l'artisan).
  - [x] Exclure `/consent` du middleware next-intl dans `proxy.ts` (comme `/api`, `/auth`) → pas de redirection locale ; et l'ajouter au `config.matcher` négatif si besoin.
  - [x] i18n : la page charge les messages FR+AR manuellement (next-intl `NextIntlClientProvider` avec locale togglable, ou rendu statique des 2 langues). Namespace `consent.*`.

- [x] **Task 5 — Templates e-mail contributeur** (AC: 2, 3)
  - [x] `lib/email/templates/artisan-consent-accepted.{fr,ar}.ts` + `artisan-consent-refused.{fr,ar}.ts` (calquer les templates admission). Étendre l'union `SendArgs` de `lib/email/send.ts` avec `artisan-consent-accepted` / `artisan-consent-refused` (+ `vars` : `artisanName`, `ficheUrl`). Locale du contributeur depuis `profiles.language`.

- [x] **Task 6 — i18n + a11y + tests** (AC: 1, 7, 8)
  - [x] Namespace `consent.*` (FR + AR — ici l'AR est requis car l'artisan peut être arabophone, contrairement au reste MVP FR-only) : titre, fiche, accepter, refuser, expiré, déjà traité, invalide, toggle langue, mentions CNDP.
  - [x] Tests : `lib/consent/lookup.test.ts` (statuts, mock lookup), composant page (rendu valid/expired/used/invalid), webhook (mock RPC : accept→email, refuse→email, not_found→401, idempotent). RLS : la RPC `SECURITY DEFINER` doit scoper proprement (un token ne touche QUE son artisan) — test si pertinent.
  - [x] `pnpm typecheck`/`lint`/`test` verts ; smoke : générer un token (2.4, SMS=log) → ouvrir `/consent/[raw]` → accepter → artisan `published` + e-mail loggué + `moderation_log`.

### Review Findings

> Code review adversariale (Blind Hunter + Edge Case Hunter + Acceptance Auditor) — 2026-06-19. 3 decision-needed, 4 patch, 2 defer, 7 écartés.

**Decision-needed (à trancher avant patch) :**

- [ ] [Review][Decision] AC1 incomplet — commentaire contributeur + mention pseudo/nommé non affichés — La page ne rend ni le commentaire contributeur ni la mention pseudonyme/nommé exigés par AC1. `comment_text` vit sur `ratings` (pas `artisans`) et aucun rating n'existe au stade `pending_consent` → donnée non récupérable sans plomberie amont (2.4). `lib/consent/lookup.ts:35` ne sélectionne pas ces champs ; `app/consent/[token]/page.tsx:49-72` ne les rend pas (clé i18n `consent.visibilityNote` présente mais inutilisée).
- [ ] [Review][Decision] Fiabilité e-mail contributeur (best-effort) — Sur échec d'envoi (`app/api/webhook/sms-consent/route.ts:65-74` catch+log), le token est déjà consommé → re-clic = `already_used` sans re-notifier. Notification de décision potentiellement perdue (e-mail = seul canal, in-app = Epic 7). Best-effort MVP ou outbox/retry ?
- [ ] [Review][Decision] `consentHashEquals` (timing-safe, AC8) non utilisé — Comparaison via lookup DB indexé (`lib/consent/lookup.ts:38`, RPC `where token_hash = p_token_hash`) au lieu du helper timing-safe explicitement mandaté par AC8/§Sécurité. Sécurité réelle OK (entropie HMAC + index), mais déviation à acter ou corriger.

**Patch (correctifs non ambigus) :**

- [x] [Review][Patch] Page `/consent` rendue sans `<html>/<body>/lang` (route hors `[locale]`, root layout retourne `children` bruts) [app/consent/[token]/page.tsx:38 + app/layout.tsx:21]
- [x] [Review][Patch] Race double-submit dans la RPC : pas de verrou ligne token (`select ... into v` sans `for update`) → double e-mail + double `moderation_log` sur double-clic [supabase/migrations/20260622120000_artisan_consent_rpc.sql:31-66]
- [x] [Review][Patch] `request.formData()` sans try/catch → 500 au lieu de 400 sur body non-form [app/api/webhook/sms-consent/route.ts:33]
- [x] [Review][Patch] E-mail contributeur AR utilise `display_name_fr` (la RPC ne renvoie pas `display_name_ar`) [app/api/webhook/sms-consent/route.ts:95]

**Defer (réel mais non actionnable maintenant) :**

- [x] [Review][Defer] Rate-limit basé sur `x-forwarded-for` spoofable + fallback `unknown` [app/api/webhook/sms-consent/route.ts:29] — deferred, durcissement infra-dépendant (entropie HMAC rend le brute-force token infaisable)
- [x] [Review][Defer] `artisan_consent_tokens.token_hash` sans index UNIQUE [supabase/migrations/20260619090000_artisans_schema.sql:128] — deferred, pre-existing (schéma 2.4 ; collision improbable mais hygiène)

## Dev Notes

> **Stack & conventions** : identiques 2.2-2.4. Réutilise massivement 2.4 (`lib/consent/token`, `artisan_consent_tokens`, boundary email).

### §Décisions (3 points structurants)

1. **Route hors `[locale]`.** Le lien SMS généré par 2.4 est `${NEXT_PUBLIC_SITE_URL}/consent/${raw}` (**sans préfixe locale**). La route vit donc en `app/consent/[token]/` (comme `app/auth/*`, `app/api/*`), **pas** sous `[locale]`. Conséquence : exclure `/consent` du middleware next-intl (`proxy.ts`) pour éviter une redirection `/fr/consent/...`. La page gère FR/AR via un toggle interne (l'artisan n'a pas de préférence de locale connue). [ADR 0003, et le lien produit en 2.4]
2. **Enum `moderation_action`.** Pas de valeur consentement aujourd'hui → migration `ALTER TYPE ... ADD VALUE 'artisan_published' / 'artisan_consent_refused'`. ⚠️ En Postgres, `ADD VALUE` a des contraintes transactionnelles (ne peut être utilisé dans la même transaction que son usage) — appliquer dans une migration dédiée commitée avant la RPC qui l'utilise (ou ordre des statements).
3. **RPC `SECURITY DEFINER`.** La page/route est **publique sans session** → impossible d'écrire via RLS client. La transaction (state + used_at + moderation_log) passe par une RPC `SECURITY DEFINER set search_path=public`, `grant execute to anon`. Elle est le **seul** chemin d'écriture ; elle valide le token (existence/expiry/used) en interne pour rester atomique et idempotente. C'est le pattern « écritures sensibles via SECURITY DEFINER » prévu par 2.1 §RLS.

### §Sécurité (AR38)

- **Token** : la page/route reçoit le `raw` (dans l'URL / le body), le **re-hash** (`hashConsentToken`) et compare au `token_hash` stocké (`consentHashEquals` timing-safe, 2.4). Le raw n'est **jamais** stocké/loggué.
- **Non-révélation** : token introuvable OU hash mismatch → **même** réponse générique (page « lien invalide ou expiré », route **401**). Ne jamais distinguer « n'a jamais existé » de « falsifié ».
- **Idempotence** : `used_at` garde la transaction rejouable sans effet (re-clic → état courant, pas d'erreur ni double e-mail).
- **Pas de session** : ne pas appeler `supabase.auth` pour l'artisan ; pas de cookie. Accès strictement token-scopé.
- **Rate-limit** léger sur le webhook (anti-bruteforce de tokens) via `checkLimit` (par IP).

### §Réutilisation directe (2.4)

- **`lib/consent/token.ts`** : `hashConsentToken(raw, secret)`, `consentHashEquals` (déjà livrés en 2.4).
- **`artisan_consent_tokens`** : `token_hash`, `expires_at`, `used_at`, `artisan_id`, `residence_id` (2.1).
- **`lib/email/send.ts`** : boundary à étendre (nouveaux templates), pattern admission-validated/rejected.
- **`createAdminClient`** : pour le lookup token + l'appel RPC (service-role).
- **Composants fiche** (2.3) : `RatingGaugesFull`/`Chip` peuvent illustrer la fiche proposée (optionnel — au stade pending il n'y a pas encore d'avis).
- **`lib/i18n`** : messages FR+AR (ici l'AR est réellement rendu, exception au MVP FR-only car l'artisan peut être arabophone).

### §Scope boundaries

- **DANS** : page publique consentement, validation token (4 statuts), webhook accept/refuse + RPC transactionnelle, e-mails contributeur, enum migration, toggle FR/AR, idempotence, 401 AR38. **HORS** : création fiche (2.4, faite), notification in-app persistée (Epic 7), notation (2.6), droit de réponse (2.8), relance de consentement expiré (manuel : le voisin re-soumet — pas d'auto-relance MVP).

### Project Structure Notes

- **NEW** : `app/consent/[token]/{page,loading}.tsx` (+ `error.tsx`) ; `app/api/webhook/sms-consent/route.ts` ; `lib/consent/lookup.ts` (+test) ; migration `<ts>_artisan_consent.sql` (enum + RPC) ; `lib/email/templates/artisan-consent-{accepted,refused}.{fr,ar}.ts` ; tests.
- **UPDATE** : `proxy.ts` (exclure `/consent` du middleware locale), `lib/email/send.ts` (union SendArgs), `messages/{fr,ar}.json` (`consent.*`), `lib/supabase/types.generated.ts` (regen post-migration), possiblement `tests/rls.test.ts`.
- **Réutiliser** : `lib/consent/token`, `createAdminClient`, `lib/email/send`, `lib/rate-limit`, `lib/i18n`.

### References

- [Source: epics.md#Story-2.5] — AC verbatim, FR18-19, NFR18, AR38, CC #20.
- [Source: epics.md#Story-2.4] — token HMAC + `artisan_consent_tokens` (amont, fait).
- [Source: architecture.md l.310-315] — Route Handler webhook consentement, HMAC, idempotence `event_id`, token 7 j.
- [Source: _bmad-output/implementation-artifacts/2-4-...md] — `lib/consent/token`, boundary SMS/email, décisions.
- [Source: docs/adr/0002-brevo-email-provider.md] — e-mail Brevo (templates contributeur).
- [Source: docs/adr/0003-locale-routing-public-only.md] — routing locale (la route consent est l'exception hors-locale).
- [Source: docs/adr/0004-rls-vs-fk-discipline.md] — écritures sensibles via SECURITY DEFINER.
- [Source: supabase/migrations/20260619090000_artisans_schema.sql] — `artisan_consent_tokens` deny-all, `artisans.state`, soft-delete.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — bmad-dev-story, 2026-06-18

### Debug Log References

- Collision de timestamp de migration : `20260622090000` déjà pris par `ratings_author_display_name` (concurrent, review 2.4) → mes migrations rebumpées en `20260622110000` (enum) / `20260622120000` (RPC).
- Migrations appliquées **pour de vrai** (`supabase db reset`) + `gen:types` régénéré (RPC `process_artisan_consent` + valeurs enum dans les types).
- RPC validée **end-to-end contre la stack** : `tests/consent-rpc.test.ts` 4/4 (gated) + RLS 25/25 toujours verts.

### Completion Notes List

**Livré et validé (`pnpm typecheck` + `lint` + `test` verts — 268 pass / 29 skip ; +14 tests ; RPC 4/4 + RLS 25/25 gated PASSÉS pour de vrai) :**

- **Migrations** `20260622110000_moderation_consent_enum.sql` (valeurs `artisan_published`/`artisan_consent_refused`) + `20260622120000_artisan_consent_rpc.sql` (**RPC `process_artisan_consent` `SECURITY DEFINER`**, transactionnelle, idempotente). Appliquées + `gen:types`.
- **Lookup** `lib/consent/lookup.ts` (4 statuts `invalid`/`expired`/`used`/`valid`, AR38 non-révélation) — 5 tests mockés.
- **Webhook** `app/api/webhook/sms-consent/route.ts` (re-HMAC, RPC, e-mail contributeur, PRG redirect, 401 sur `not_found`, rate-limit IP).
- **Page publique** `app/consent/[token]/page.tsx` (**hors `[locale]`**, toggle FR/AR via `?lang=`, form POST natif, aucune session) + `loading.tsx`. `proxy.ts` exclut `/consent` du middleware locale.
- **E-mails** 4 templates (accepted/refused × fr/ar) + union `SendArgs` étendue.
- **i18n** namespace `consent.*` (FR **+ AR réel** — exception au MVP FR-only).
- **RPC test gated** `tests/consent-rpc.test.ts` : accept→published+idempotent, refuse→refused+soft-delete, expired, not_found, moderation_log — **4/4 contre Postgres réel**.

**Décisions techniques :**

- **RPC `SECURITY DEFINER`** = seul chemin d'écriture (page/route publiques sans session). Valide token (existence/expiry/used) + applique la décision en UNE transaction (state + used_at + moderation_log). Idempotente.
- **Route hors `[locale]`** (`app/consent/[token]`) — matche le lien SMS sans préfixe de 2.4 ; `getTranslations({ locale })` + toggle `?lang=` ; exclue du middleware next-intl.
- **AR38** : token introuvable = falsifié → même réponse générique (page `invalid` / webhook **401**), jamais de distinction.
- **2 migrations séparées** (enum `ADD VALUE` doit être commité avant usage par la RPC).

**⚠️ Résidus de validation (gated / externe — non exécutés) :**

1. **Webhook HTTP + page rendering e2e** : la RPC (cœur sécurité) est prouvée contre la stack, mais la route HTTP (form POST → redirect, 401/idempotence) et le rendu page (4 statuts, toggle) ne sont pas e2e-testés (navigateur). À smoke-tester : 2.4 (SMS=log) génère un lien → ouvrir `/consent/[raw]` → accepter → published + e-mail loggué.
2. **Provider SMS/e-mail réels** : log/stub en test ; Brevo e-mail + provider SMS à provisionner avant bêta.

### File List

**NEW :**

- `supabase/migrations/20260622110000_moderation_consent_enum.sql`
- `supabase/migrations/20260622120000_artisan_consent_rpc.sql`
- `lib/consent/lookup.ts` (+ `.test.ts`)
- `app/api/webhook/sms-consent/route.ts`
- `app/consent/[token]/page.tsx`, `loading.tsx`
- `lib/email/templates/artisan-consent-{accepted,refused}.{fr,ar}.ts`
- `tests/consent-rpc.test.ts`

**MODIFIED :**

- `lib/email/send.ts` (union `SendArgs` + 2 templates)
- `lib/supabase/types.generated.ts` (regen : RPC + enum)
- `proxy.ts` (exclut `/consent` du middleware locale)
- `messages/{fr,ar}.json` (namespace `consent`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut 2.5)

### Change Log

| Date       | Version | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-18 | 0.1     | Implémentation story 2.5 : page consentement publique (`/consent/[token]`, hors-locale, FR/AR), webhook + RPC transactionnelle `SECURITY DEFINER` (accept/refuse, idempotent, AR38 401), e-mails contributeur, enum migration. Migrations + gen:types appliqués pour de vrai ; RPC 4/4 + RLS 25/25 gated PASSÉS. typecheck/lint/test verts (268 pass). Statut → review.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-06-19 | 0.2     | Code review (3 couches adverses parallèles) : 28 patches dont 26 appliqués + 2 différés (P8 root layout html conflict, P25 tests webhook). Décision D1 actée → mitigations in-place (Sentry scrubber `lib/sentry/scrub.ts`, Cache-Control no-store sur `/consent/*`, NetworkOnly SW pour `/consent/*`, PRG `/consent/done?status=…` sans token, TTL 7j→24h). **Sécurité critique** : nouvelle migration `20260623090000_consent_review_hardening.sql` (RPC durcie + atomic gate + guards state/deleted*at, REVOKE EXECUTE anon/auth, UNIQUE token_hash, moderation_log policy split actions consent). CSRF webhook Origin/Sec-Fetch-Site, rate-limit par token_hash + GET, contributeur soft-deleted RGPD respect, email locale-aware (display_name_ar), CRLF strip subject + escapeHtml centralisé `lib/email/escape.ts`. AC1 mention pseudo/nommé câblée. Bidi/control strip côté Zod `display_name*\*`. Cron purge tokens expirés > 90j. 275 tests verts + typecheck + lint clean. Statut → done. |

### Review Findings

> Code review 2026-06-19 — Blind Hunter + Edge Case Hunter + Acceptance Auditor (3 couches adverses parallèles). ~69 findings bruts → 38 post-triage/vérif code : **1 décision**, **27 patches** (dont 9 sécurité critique), **6 différés**, **4 noise écartés**.

#### Decision (résolue 2026-06-19)

- [x] [Review][Decision] **D1 — Token raw en URL : surface de leak du flow magic-link** — **Décision : Mitigations in-place** : (1) Sentry beforeSend scrubber `/consent/[^/]+` → `[REDACTED]` ; (2) Cache-Control: private, no-store sur `/consent/*` ; (3) Exclure `/consent/*` du SW Serwist runtime cache ; (4) PRG redirect post-action → `/consent/done?status=...` (URL sans token) ; (5) Réduire expiry token 7j → 24h. → Couvert par P10/P11/P12/P13 + migration TTL ci-dessous.

- [x] [Review][Patch] **P28 (← D1 mitigation 5) : réduire `artisan_consent_tokens.expires_at` de 7j à 24h** — Modifier la valeur dans `app/[locale]/community/annuaire/nouveau/actions.ts` (story 2.4 `CONSENT_EXPIRY_DAYS=7` → `1`) + ajuster les SMS templates / e-mails contributeur ("votre lien expire dans 24h"). Trade-off : artisan doit cliquer rapidement ; cluster avec relance auto (différée Epic 7).

#### Patches (sécurité critique)

- [x] [Review][Patch] **P1 — RPC manque guards `state='pending_consent'`+`deleted_at IS NULL` + non atomique sous race** [`supabase/migrations/20260622120000_artisan_consent_rpc.sql:31-86`] — Permet de ressusciter un artisan soft-deleted, ou passer un `published` à `refused`. Double-clic = double moderation_log + 2 emails. Fix : `UPDATE artisan_consent_tokens SET used_at=now() WHERE token_hash=? AND used_at IS NULL RETURNING ...` comme gate atomique + `WHERE artisans.state='pending_consent' AND deleted_at IS NULL` côté JOIN.
- [x] [Review][Patch] **P2 — RPC GRANT `anon, authenticated` court-circuite rate-limit IP** [`...sql:90`] — Tout client web peut appeler la RPC directement. Webhook utilise `createAdminClient` (service_role). Fix : `REVOKE FROM anon, authenticated; GRANT TO service_role`.
- [x] [Review][Patch] **P3 — `lib/consent/lookup.ts` sans filtre `artisans.deleted_at IS NULL`** [`lib/consent/lookup.ts:33-41`] — Artisan soft-deleted entre SMS et consult → page `valid`. Fix : `.is('deleted_at', null)` sur l'embed.
- [x] [Review][Patch] **P4 — Migration UNIQUE sur `artisan_consent_tokens.token_hash`** [`...20260619090000:128-136`] — Collision → `maybeSingle()` PGRST116 mapped `invalid`. `create unique index artisan_consent_tokens_hash_unique on artisan_consent_tokens(token_hash);`.
- [x] [Review][Patch] **P5 — `moderation_log using (true)` → side-channel AR38** [`...20260524005600`] — Lecture publique révèle accept/refuse par artisan_id. Fix : restreindre actions consent aux résidents même résidence (policy filtrée par action) OU log privé séparé.
- [x] [Review][Patch] **P6 — Webhook : aucune protection CSRF Origin/Referer** [`app/api/webhook/sms-consent/route.ts`] — Token leak (D1) + form-encoded POST cross-origin = exploitation triviale. Fix : check `origin === NEXT_PUBLIC_SITE_URL` + `Sec-Fetch-Site` ; 403 sinon.
- [x] [Review][Patch] **P7 — `consentHashEquals` (timing-safe) jamais utilisé — AC8 littéral** [`lib/consent/lookup.ts:38`] — `.eq('token_hash', ...)` PG non timing-safe (latence index). Fix : déviation à acter OU `consentHashEquals` côté Node sur le hash retourné (trade-off perf).
- [ ] [Review][Patch] **P8 — Root layout `app/layout.tsx` sans `<html>/<body>`** [`app/layout.tsx:16-22`] — **Différé** : ajouter `<html>` au root crée un conflit (double html avec `[locale]/layout.tsx` qui le rend déjà). Refactor non-trivial (déplacer dir/lang dynamique vers cookie/header). Note ajoutée dans `app/layout.tsx`, finding rebasculé en deferred-work.

- [ ] [Review][Patch] **P25 — Tests webhook + composant page** — **Différé** : tests webhook nécessitent un mock complexe (Route Handler + RPC + redirects + multi-content-type) ; tests composant page utilisent `useActionState` (cluster avec déviation 2.4 P12). À reprendre cluster E2E 1.10c.
- [x] [Review][Patch] **P9 — Mention pseudo/nommé absente du rendu (AC1 littéral)** [`page.tsx:48-90`] — Clé `consent.visibilityNote` définie FR+AR mais jamais référencée. Fix : récupérer `profiles.identity_mode` côté lookup, afficher selon `pseudo`/`identified`.

#### Patches (robustesse / UX / défense profondeur)

- [x] [Review][Patch] **P10 — PRG redirect post-action expose le raw dans Location header** [`route.ts:84`] — Fix : redirect vers `/consent/done?status=accepted|refused|...` (URL sans token).
- [x] [Review][Patch] **P11 — `Cache-Control: private, no-store` absent sur `/consent/*`** [`next.config.ts:34-58`] — Fix : pattern `/consent/:path*` aux headers no-store.
- [x] [Review][Patch] **P12 — SW Serwist `NetworkFirst` cache HTML de `/consent/*`** [`sw/index.ts:48-54`] — Fix : matcher dény `/consent/` avant `defaultCache`.
- [x] [Review][Patch] **P13 — Sentry capture URL/transaction.name `/consent/[token]`** [`sentry.*.config.ts`] — Fix : `beforeSend`/`beforeSendTransaction` scrubber `/consent/[^/]+` → `[REDACTED]`.
- [x] [Review][Patch] **P14 — RPC ne renvoie pas `display_name_ar` → email AR utilise FR** [`...sql`, `route.ts:95`] — Fix : retourner aussi `display_name_ar`, webhook choisit selon `profile.language`.
- [x] [Review][Patch] **P15 — `?lang=` arbitraire sans validation enum** [`page.tsx:18-20`] — Fix : `z.enum(['fr','ar']).catch('fr')`.
- [x] [Review][Patch] **P16 — Pas de max-length `raw` token (DoS HMAC + content-length)** [`lookup.ts:28`, `route.ts:33`] — Fix : `raw.length > 200 → invalid` ; valider `Content-Length < 4KB`.
- [x] [Review][Patch] **P17 — Rate-limit par token_hash en plus de IP** [`route.ts:29-31`] — Fix : `checkLimit('consent-token:${tokenHash.slice(0,16)}', 5, 600)` après hash.
- [x] [Review][Patch] **P18 — Pas de rate-limit sur GET `/consent/[token]`** — Bruteforce gratuit (HMAC+query admin par GET). Fix : `checkLimit('consent-get:${ip}', 30, 600)` (fail-open).
- [x] [Review][Patch] **P19 — `request.formData()` sans try/catch → 500** [`route.ts:33`] — Body non-form → 500 distinguable d'un 401 (AR38 dégradée). Fix : try/catch + 400.
- [x] [Review][Patch] **P20 — `notifyContributor` swallow `{ok:false}` retours** [`route.ts:65-74`, `send.ts:91`] — Email Brevo down → log mais pas de retry/outbox/Sentry. Fix : tester `result.ok===false` + log explicite + retry léger.
- [x] [Review][Patch] **P21 — `auth.admin.getUserById` ignore `users.deleted_at`** [`route.ts:85`] — Contributeur en suppression RGPD reçoit encore email. Fix : check `users.deleted_at IS NULL` ou skip notify.
- [x] [Review][Patch] **P22 — Lien "Consulter ma fiche" redirige l'artisan vers /admission** [`page.tsx:100-104`, `proxy.ts:15-16`] — `COMMUNITY_PATTERN` matche, proxy redirige non-auth. Fix : retirer le lien au MVP (artisan n'a pas de compte).
- [x] [Review][Patch] **P23 — `display_name_fr` strip bidi/control chars côté write** [`app/[locale]/community/annuaire/nouveau/actions.ts:107`] — Cluster review 2.4 P3. Fix : transform NFC + strip bidi/zw côté Zod.
- [x] [Review][Patch] **P24 — Cron purge-expired ne purge pas `artisan_consent_tokens`** [`app/api/cron/purge-expired/route.ts`] — Fix : `DELETE FROM artisan_consent_tokens WHERE expires_at < now() - interval '90 days' AND used_at IS NULL` au cron hebdo.
- [x] [Review][Patch] **P25 — Tests webhook + composant page absents (Task 6 partielle)** — Pas de test webhook (mock RPC : accept/refuse/not_found/idempotent) ni rendu page (valid/expired/used/invalid + toggle FR/AR).
- [x] [Review][Patch] **P26 — Email subject : pas de strip CRLF (Brevo header injection)** [`lib/email/templates/artisan-consent-accepted.{fr,ar}.ts`] — Fix : `name.replace(/[\r\n]/g, ' ')` avant subject.
- [x] [Review][Patch] **P27 — `escapeHtml` redéclaré 4× dans templates** — Fix : extraire en `lib/email/escape.ts`.

#### Différés

- [x] [Review][Defer] **AR38 sémantique 401 vs 200/303** — Status code distingue token forgé/valide ; indistinguabilité complète demande refactor profond.
- [x] [Review][Defer] **`UNIQUE (target_id, action)` sur moderation_log** — Renforce P1 (atomicité) avec défense DB-side. Si P1 ok, moins critique.
- [x] [Review][Defer] **Skeleton `loading.tsx` consent sans `dir`** — Flash LTR cosmétique.
- [x] [Review][Defer] **Validation runtime slug Next router** — `slugify` 2.1 = `[a-z0-9-]+` strict.
- [x] [Review][Defer] **Tag `key={tag.label}` collision React** — Noms uniques par résidence en pratique.
- [x] [Review][Defer] **Clock skew Node vs PG `expires_at`** — < 1s typique Vercel.

#### Dismissed

- `force-dynamic` redondant avec `params: Promise<>` Next 16 — cargo-cult inoffensif.
- ADR 0004 référencé dans commentaire migration mais non joint — NIT documentaire.
- Timing-safe DB-side impossible avec index B-tree (P7 reste utile en code-side mais ne résout pas le timing oracle index).
- Lookup tests mocking embed schema — qualité tests, pas un bug bloquant.
