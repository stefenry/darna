# Story 2.6: Notation typée multi-axes + commentaire pseudo/identité

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> ⚠️ **3 points structurants** (détaillés en Dev Notes) : (1) **couche applicative pure** — la table `ratings`, ses RLS (insert/update-own), ses grants colonne, la vue `artisan_rating_aggregates` et les composants `RatingGauge`/`RatingGaugesFull` **existent déjà** (2.1/2.2/2.3) ; 2.6 ne crée **aucune migration**. (2) **Upsert par select-then-branch** (pas `.upsert()` brut) car les grants colonne INSERT ≠ UPDATE. (3) **Pseudonyme stable** (FR16) à créer (`lib/artisans/pseudonym.ts`) — aujourd'hui tous les avis pseudonymes affichent un label plat « Un voisin ».

## Story

As a **résident (Yassine post-appel — Journey 1)**,
I want **noter un artisan publié sur 4 axes typés (1-5 ou « Non applicable »), avec commentaire optionnel et choix de visibilité**,
so that **mes voisins bénéficient d'un retour différencié sans que je me sente exposé**.

Story aval de 2.3 (fiche artisan) : elle ajoute le **chemin d'écriture** (form + Server Action) par-dessus un schéma, des RLS et un affichage déjà livrés. Ferme la boucle « consultation → contribution » du Journey 1. Le **retrait** d'une note relève de 2.7 ; 2.6 couvre **création + mise à jour** (la contrainte `unique(artisan_id, user_id)` fait du re-vote une mise à jour, pas un doublon).

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 2.6 » (l. 1020-1052). FR20/FR13/FR16/FR21-setup, NFR40/NFR40b. Précisions techniques (upsert, pseudonyme, mapping enum) en Dev Notes — elles priment.

1. **AC1 — Form de notation.** Étant donné un artisan **publié** dont j'ouvre la fiche, quand je tape « Noter cet artisan », alors un form s'ouvre avec **4 axes** (Dépannage / Petits travaux / Travail soigné / Urgences), chacun en sélecteur **1-5 étoiles** ou **« Non applicable »** (je ne note que les axes dont j'ai l'expérience). (FR20)
2. **AC2 — Soumission + persistance.** Étant donné que je note « Dépannage 5/5 » et laisse les 3 autres axes en « Non applicable », quand je soumets, alors une ligne `ratings` est créée avec `score_depannage=5`, les autres `NULL`, `visibility` défaut = réglage profil (`pseudonym`), `comment_text` optionnel **max 500 car.**, `user_id=auth.uid()`, `residence_id` = résidence du contributeur.
3. **AC3 — Agrégation par axe.** Étant donné que plusieurs résidents notent un artisan, quand je consulte la fiche, alors l'agrégation par axe montre **moyenne + count** (ex. « Dépannage 4.5 (4) ») — les notes `NULL` sont **exclues** des moyennes. (FR13)
4. **AC4 — Visibilité pseudonyme (défaut).** Étant donné `visibility='pseudonym'` pour ma note, quand d'autres résidents voient mon commentaire, alors ils voient **« Voisin anonyme »** + un **pseudonyme dérivé par hash stable** (cohérent pour toutes mes contributions pseudonymes sur cet artisan). (FR16)
5. **AC5 — Visibilité nommée (opt-in).** Étant donné `visibility='named'` (opt-in), quand d'autres résidents voient mon commentaire, alors mon **`display_name`** est affiché (pas le n° de villa — voir Dev Notes §Décisions).
6. **AC6 — Idempotence (1 note/(artisan,user)).** Étant donné que j'ai déjà noté cet artisan, quand j'ouvre le form, alors ma note existante est **pré-remplie** et le CTA devient **« Mettre à jour »** (une seule note par (artisan, contributeur) — re-vote = UPDATE). (FR21-setup)
7. **AC7 — Perf & UX.** Et le form est réalisable en **≤ 30 s** par Aïcha (NFR40) avec **skeleton loading** et feedback **immédiat** à la soumission (toast « Note enregistrée », pas de double-validation — NFR40b « Geste = WhatsApp »).

### AC additionnel (régression — obligatoire)

8. **AC8 — Sécurité + intégrité + tests verts.** Écriture via **client session** uniquement (RLS `ratings_resident_insert`/`ratings_resident_update_own` + grants colonne sont l'enforcement réel — NFR21 vérif serveur) ; **≥ 1 axe noté** validé **client ET serveur** (miroir du CHECK DB `ratings_at_least_one_score_check`) ; commentaire ≤ 500 car. validé Zod ; jamais d'écriture sur `author_display_name`/`deleted_*` (non-grantés, posés par trigger). `visibility` choisie **mémorisée** sur `profiles.identity_mode` (FR16 opt-in mémorisé). `pnpm typecheck`/`lint`/`test` verts ; `tests/rls.test.ts` étendu (update-own, dup-rating, CHECK ≥1 axe).

## Tasks / Subtasks

- [x] **Task 1 — Schéma Zod + mapping erreurs** (AC: 1, 2, 8)
  - [x] `lib/validation/rating.ts` : `zRatingForm` = 4 axes `z.coerce.number().int().min(1).max(5).optional()` (`score_depannage`…`score_urgences`) + `.refine(num_nonnulls ≥ 1, …)` (miroir CHECK DB `ratings_at_least_one_score_check`) ; `comment` via `zOptionalText(500)` (réutiliser le helper de `lib/validation/artisan.ts`) ; `visibility z.enum(['pseudonym','named'])`. Exporter un `RATING_FIELD_ERROR_KEYS` typé (const array) + `mapRatingFieldError(path)` → clé i18n `errors.rating.*` (lire **uniquement** le `path` Zod, jamais le message natif — AR17). Réutiliser/relocaliser le const `VISIBILITY` de `lib/validation/artisan.ts:9`.
  - [x] `lib/validation/rating.test.ts` : ≥1 axe requis, borne 1-5, comment >500 rejeté, visibility enum.

- [x] **Task 2 — Pseudonyme stable (FR16)** (AC: 4)
  - [x] `lib/artisans/pseudonym.ts` : `pseudonymSuffix(userId: string, artisanId: string): string` = `crypto.createHash('sha256').update(`${userId}:${artisanId}`).digest('hex')` → **4 premiers car. uppercase** (ex. `A3F2`). Déterministe, **server-only** (`user_id` jamais exposé client). Pas de secret requis (UUID non devinable, hash one-way ; le but FR16 = stabilité/cohérence, pas secret). Gérer `userId === null` (notes anonymisées purge RGPD, ADR 0006) → renvoyer `null` → label « Voisin supprimé » (clé existante `fr.json:356`).
  - [x] `lib/artisans/pseudonym.test.ts` : même (user,artisan) → même suffixe ; (user,artisan) différents → suffixes différents ; null → null.

- [x] **Task 3 — Server Action `submitRating`** (AC: 2, 6, 8)
  - [x] `app/[locale]/community/artisan/[slug]/noter/actions.ts` (`'use server'`). Signature `(_prev: RatingState, formData: FormData) => Promise<RatingState>` (compatible `useActionState`). Union discriminée `RatingState = { ok:true } | { ok:false; idle?:true; error:{ code; field?; message_key } }` + const `RATING_INITIAL = { ok:false, idle:true }`. Codes : `validation | rate_limited | unauthenticated | forbidden | artisan_not_found | submit_failed`.
  - [x] Garde : `requireResident()` d'abord (renvoie `forbidden`/`errors.forbidden` si pas de session — **ne gate PAS le rôle**, cf. `lib/auth/require-resident.ts`), **puis** check explicite `users.role in ('resident','co_mod')` + `residence_id` non-null (source de `residence_id`, **jamais** du form). Rate-limit `checkLimit('rating-submit:${userId}', 10, 600)`.
  - [x] `zRatingForm.safeParse` → mapping field error. Résoudre l'`artisan_id` depuis le `slug` (param de route) via client session (`artisans` published, même résidence — RLS protège). Si introuvable → `artisan_not_found`.
  - [x] **Upsert par select-then-branch** (PAS `.upsert()` brut — grants colonne INSERT ≠ UPDATE, cf. §Décisions) : `select id from ratings where artisan_id=? and user_id=auth.uid()` (client **session**) ; si existe → `update(score_*, comment_text, visibility)` ; sinon → `insert(artisan_id, user_id, residence_id, score_*, comment_text, visibility)`. **Client session uniquement** (RLS + grants = enforcement). `NULL` explicite sur les axes « Non applicable ». Sur erreur DB : `log({event:'rating.submit_failed', …})` + `submit_failed`.
  - [x] **Mémoriser la visibilité** : `update profiles set identity_mode = mapVisibilityToIdentityMode(visibility)` (réutiliser le helper de 2.4 `actions.ts`, `'named'→'identified'`, sinon `'pseudo'`). Échec bénin → warn-log, ne bloque pas (cf. 2.4 D1).
  - [x] `revalidatePath('/[locale]/community/artisan/[slug]')` après commit (re-lecture vue agrégats + commentaires). Retour `{ ok:true }`.
  - [x] Test unitaire node (`// @vitest-environment node`) : mock `requireResident` + `createClient` (chaîne `.select().eq()`, `.insert()`, `.update()`) + `logger` (calquer `tests/profil/profile-actions.test.ts`). Couvrir : insert nouveau, update existant, validation KO, rate-limit KO.

- [x] **Task 4 — Data layer : prefill + user_id pour pseudonyme** (AC: 4, 6)
  - [x] `app/[locale]/community/artisan/[slug]/data.ts` : ajouter `fetchMyRating(artisanId)` (client session, `select score_*, comment_text, visibility from ratings where artisan_id=? and user_id=auth.uid()` `.maybeSingle()`) pour pré-remplir le form ; `cache()` comme les autres lecteurs.
  - [x] Étendre le `select` de `fetchArtisanComments` pour inclure `user_id` (lisible via RLS même-résidence) ; pour chaque commentaire `visibility==='pseudonym'`, calculer le suffixe via `pseudonymSuffix(user_id, artisan_id)` **côté serveur** et le passer au composant. `visibility==='named'` → `author_display_name` (colonne matérialisée par trigger, déjà sélectionnée). **Préserver** : `cache()`, `force-dynamic`, dérivation `isOwner`, mapping `toAxisScores`.

- [x] **Task 5 — Page de notation dédiée + `<RateForm>`** (AC: 1, 2, 6, 7)
  - [x] `app/[locale]/community/artisan/[slug]/noter/page.tsx` (RSC, **dédiée** — pas de modal/bottom-sheet, bannis MVP). Garde résident, résout l'artisan + `fetchMyRating` (prefill), passe `existingRating` au form. `<AppHeader>` (chevron retour + « Noter {prénom} »). `loading.tsx` (skeleton, pas spinner — AR21). `generateMetadata` `robots:{index:false}`.
  - [x] `_components/rate-form.tsx` (`'use client'`) : 4 `<RateAxisBlock>` (états `unset`/`rated`/`na` — étoiles `neutral-300`/`accent-600`/dim 0.35) avec toggle « Non applicable »⇄« Réactiver » ; `<CommentSection>` (textarea borderless `bg-soft`, label « Commentaire (facultatif) », placeholder, **compteur `{n} / 500`**) ; `<VisibilityToggle>` (Radix `<Switch>` « Signer en mon nom », défaut OFF = pseudonyme, desc « Par défaut tu apparais en "Voisin anonyme" ») ; CTA sticky bas (`<StickyBottomBar>` + `env(safe-area-inset-bottom)`) « Publier ma note » / « Mettre à jour » si `existingRating`.
  - [x] `useActionState(submitRating, RATING_INITIAL)`. **≥ 1 axe** gate client (CTA disabled sinon) **+** serveur. a11y : chaque axe `<fieldset><legend class=sr-only>`, étoiles `<button role="radio">` dans `<div role="radiogroup">`, **annonce ARIA live au tap** ; **touch target étoiles ≥ 48 px** (NFR36 prime sur le mockup à 46). `noValidate aria-busy`. Sur `state.ok` : toast sonner « Note enregistrée » + `router.replace` vers la fiche (revalidée). Optionnel : `useOptimistic` pour un feedback instantané (premier usage du repo — voir §Décisions).
  - [x] Test rendu (jsdom, `<NextIntlClientProvider>`, mock action) : présence 4 axes + comment + toggle ; CTA disabled si 0 axe. (Flux post-submit `useActionState` → **E2E 1.10c**, limite jsdom connue.)

- [x] **Task 6 — CTA « Noter cet artisan » sur la fiche** (AC: 1, 6)
  - [x] `app/[locale]/community/artisan/[slug]/page.tsx` : insérer le CTA entre `<RatingGaugesFull>` et `<CommentsList>` (l. ~48-49). `<Link>` vers `…/[slug]/noter`. Libellé « Noter cet artisan » (nouveau) / « Modifier ma note » si `fetchMyRating` non-null. **Préserver** : validation locale, `notFound()`, composition RSC, `CallButton` sticky.

- [x] **Task 7 — i18n `community.artisanRate` + `errors.rating`** (AC: 1, 4, 5, 7)
  - [x] `messages/fr.json` : namespace `community.artisanRate` (intro « Note seulement les axes que tu as testés. … », « Non applicable », « Réactiver », « Commentaire (facultatif) », placeholder, « Signer en mon nom », « Par défaut tu apparais en "Voisin anonyme" », « Publier ma note », « Mettre à jour », titre page « Noter {name} », CTA fiche « Noter cet artisan »/« Modifier ma note », toast « Note enregistrée », **pseudonyme « Voisin anonyme #{suffix} »**). Réutiliser `community.annuaire.axes` (labels axes) + `community.annuaire.gauge`. `errors.rating.*` (au moins « ≥1 axe », « comment trop long », « rate_limited », « forbidden »).
  - [x] `messages/ar.json` : mêmes clés en **stub** (structure parallèle — MVP FR-only, AR différé V1.5). Tonalité FR : tutoiement, pas de jargon « rating »/« score ».

- [x] **Task 8 — Pseudonyme stable à l'affichage** (AC: 4, 5)
  - [x] `app/[locale]/community/artisan/[slug]/_components/comments-list.tsx` : remplacer `comment.authorName ?? t('anonymousAuthor')` (label plat actuel « Un voisin ») par : `named` → `author_display_name` ; `pseudonym` → « Voisin anonyme #{suffix} » (suffixe calculé en Task 4) ; `user_id null` → « Voisin supprimé ». **Préserver** : layout, format date relative, chips score par axe.

- [x] **Task 9 — Tests RLS étendus** (AC: 8)
  - [x] `tests/rls.test.ts` (suite gated `SUPABASE_LOCAL_TEST`) — étendre le block « RLS artisans / ratings (AC8) » : (a) **update-own** réussit (re-vote) ; (b) update d'une note d'autrui → `42501` (`ratings_resident_update_own`) ; (c) 2ᵉ insert même `(artisan,user)` → `23505` (prouve la nécessité du select-then-branch) ; (d) insert avec 0 axe → violation `ratings_at_least_one_score_check`. Réutiliser `publishedArtisanId`/`makeResident` déjà seedés en `beforeAll`.

## Dev Notes

> **Stack & conventions** : identiques 2.2-2.5 (Next.js 16 App Router RSC + Server Actions, Supabase session-client + RLS, next-intl, Zod, Vitest). **2.6 est une story applicative** posée sur un DB entièrement prêt.

### §Décisions (points tranchés)

1. **Aucune migration.** `ratings` (4 axes, `comment_text`, enum `rating_visibility`, `unique(artisan_id,user_id)`, CHECK ≥1 axe), ses RLS (`ratings_resident_select_residence`/`_insert`/`_update_own`), ses grants colonne, le trigger `set_rating_author_display_name` (SECURITY DEFINER, snapshot `users.display_name`) et la vue `artisan_rating_aggregates` (`security_invoker`) **existent** (migrations `20260619090000`, `20260620090000`, `20260622090000`). `types.generated.ts` couvre déjà toutes les colonnes → **pas de `gen:types`** sauf changement de schéma (aucun prévu).
2. **Upsert = select-then-branch, PAS `.upsert()` brut.** Les grants colonne diffèrent : INSERT grante `(artisan_id, user_id, residence_id, score_*, comment_text, visibility)`, UPDATE grante seulement `(score_*, comment_text, visibility, updated_at)`. Un `.upsert(onConflict)` PostgREST emprunte le chemin UPDATE sur conflit et peut heurter le mismatch de grants. → `select` l'existant puis `insert` **ou** `update` explicitement. Le form connaît déjà `existingRating` (prefill) mais la décision serveur ne s'y fie pas (re-check).
3. **Mapping enum visibilité.** `ratings.visibility` = `'pseudonym'|'named'` ; `profiles.identity_mode` = `'pseudo'|'identified'`. Vocabulaires distincts → réutiliser `mapVisibilityToIdentityMode` (2.4). Défaut du form = lecture de `profiles.identity_mode` (`identified→named`, sinon `pseudonym`). À la soumission, **réécrire** `identity_mode` (FR16 « opt-in mémorisé », cohérent avec 2.4 D1).
4. **Byline nommée = `display_name` seul** (pas de n° villa). La spec UX laisse le format nommé indéfini ; le n° de villa n'est spécifié que pour le greeting accueil. Afficher la villa sur un avis public expose davantage → **`author_display_name` seul** (colonne déjà matérialisée par trigger). [tranché — gap UX #1]
5. **Form = page dédiée**, pas modal/bottom-sheet (bannis MVP, spec UX § Modal Patterns). Route `…/[slug]/noter`. Optimistic UI : la contrainte réelle = feedback immédiat + **pas de double-validation** (NFR40b). Implémentation : `useActionState` → sur succès, toast + `router.replace` vers la fiche **revalidée** (`revalidatePath`). `useOptimistic` (1er usage repo) est **optionnel** pour un aperçu instantané ; ne pas bloquer la story dessus. [tranché — gaps UX #5]
6. **Étoiles ≥ 48 px** (NFR36) — le mockup à 46 px est un prototype visuel, la règle a11y prime. [tranché — gap UX #3]
7. **Scope** : 2.6 = **création + mise à jour** (upsert). Le **retrait** (soft-delete) d'une contribution = **2.7**. État vide « 0 note » de la fiche : déjà géré (4 jauges `NA` via `RatingGaugesFull`) + CTA « Noter cet artisan » toujours présent — pas de copy supplémentaire. [tranché — gaps UX #2, #4]

### §Sécurité (NFR21 / AR17)

- **Écriture client session uniquement.** RLS `ratings_resident_insert` exige `user_id=auth.uid()` + résidence cohérente + `exists(artisan published, non-deleted, même résidence)` → un INSERT forgé/cross-résidence/artisan-pending est rejeté `42501`. **Ne jamais** passer par `createAdminClient` pour l'écriture.
- **Garde rôle explicite** : `requireResident()` ne gate PAS le rôle → re-checker `role in ('resident','co_mod')` pour une UX d'erreur propre (le RLS reste l'enforcement dur).
- **Colonnes non-grantées** : ne jamais tenter d'écrire `author_display_name` (trigger) ni `deleted_*` (modération/service).
- **Validation** : ne lire que le `path` Zod pour mapper l'erreur i18n, jamais le message natif (AR17). `≥1 axe` et `comment ≤500` validés client **et** serveur.
- **Pseudonyme** : suffixe calculé **server-side** ; `user_id` jamais sérialisé vers le client.

### §Réutilisation directe (ne PAS réinventer)

- **DB/RLS/grants/vue agrégats** : `supabase/migrations/20260619090000_artisans_schema.sql` (ratings + policies + grants l.91-311), `20260620090000_artisan_rating_aggregates.sql` (vue), `20260622090000_ratings_author_display_name.sql` (trigger).
- **Affichage** : `RatingGauge` (`app/[locale]/community/annuaire/_components/rating-gauge.tsx`), `RatingGaugesFull` (`…/artisan/[slug]/_components/rating-gauges-full.tsx`), `RATING_AXES`/`toAxisScores` (`lib/artisans/rating.ts`). **Intacts** — le form fournit l'écriture, la fiche lit la vue.
- **Form template** : `app/[locale]/community/annuaire/nouveau/_components/create-artisan-form.tsx` (`useActionState`, `useId`, rendu erreurs `role="alert"`, namespaces `useTranslations('…')` + `('errors')`, pending) + son action `…/nouveau/actions.ts` (garde, Zod, `checkLimit`, `log`, union résultat, `mapVisibilityToIdentityMode`). Radios visibilité (`name="visibility"`, `pseudonym` defaultChecked / `named`) **réutilisables tels quels**.
- **Helpers** : `requireResident` (`lib/auth/require-resident.ts`), `checkLimit` (`lib/rate-limit.ts`, fail-open), `log` (`lib/logger.ts`), `createClient` (`lib/supabase/server.ts`), `zOptionalText`/`VISIBILITY` (`lib/validation/artisan.ts`).
- **Composants UI** : `<AppHeader>`, `<StickyBottomBar>` (safe-area), `<Switch>` Radix, `<Textarea>`, toast sonner, `<Button size="lg">`.
- **i18n existant** : `community.annuaire.axes` (labels 4 axes), `community.annuaire.gauge` (na/voters/valueText).
- **Tests** : `tests/artisan/create-form.test.tsx` (rendu form jsdom + mock action), `tests/profil/profile-actions.test.ts` (action node + mocks Supabase chaînés), `tests/rls.test.ts` block « ratings (AC8) » (seeds `beforeAll`).

### §Gotchas (appris des stories 2.2-2.5)

- `useActionState` + React 19 ne s'exécute pas proprement post-submit en jsdom → tests de rendu seulement, flux complet en **E2E 1.10c**.
- PostgREST sérialise `numeric`/`bigint` en **strings** → toujours coercer via `toAxisScores` (ne pas re-parser à la main).
- Sessions RLS de test : `storageKey` distinct par user sinon clobber (cf. `rls.test.ts` l.22-40).
- `ar.json` doit rester **structurellement parallèle** à `fr.json` même en stub (MVP FR-only, arabe V1.5).
- L'axe « Non applicable » écrit `NULL` (pas `0`) — le CHECK exige `num_nonnulls ≥ 1`.

### Project Structure Notes

- **NEW** : `app/[locale]/community/artisan/[slug]/noter/{page,loading}.tsx`, `…/noter/actions.ts`, `…/noter/_components/rate-form.tsx` ; `lib/validation/rating.ts` (+ `.test.ts`) ; `lib/artisans/pseudonym.ts` (+ `.test.ts`) ; test action node.
- **UPDATE** : `app/[locale]/community/artisan/[slug]/data.ts` (`fetchMyRating` + `user_id` au select comments + pseudonyme), `…/[slug]/page.tsx` (CTA), `…/_components/comments-list.tsx` (pseudonyme stable), `messages/{fr,ar}.json` (`community.artisanRate` + `errors.rating`).
- **AUCUNE** migration ; **AUCUN** `gen:types` (sauf changement schéma imprévu).
- Conventions chemin : route en kebab (`noter`), composants en `_components/`, validation en `lib/validation/`, helpers métier en `lib/artisans/`.

### References

- [Source: epics.md#Story-2.6] — AC verbatim (l.1020-1052), FR13/FR16/FR20/FR21-setup.
- [Source: prd.md] — FR13 (l.903), FR16 (l.906), FR20 (l.910), FR21 (l.911), NFR21 (l.1000), NFR40 (l.1028), NFR40b (l.1029).
- [Source: ux-design-specification.md] — `<RatingForm>` (l.1062-1074), `<RatingGauge>` (l.1039-1060), tokens v2 jauges (l.638-688), a11y radiogroup/meter (l.1058/1072), bench Aïcha U1 (l.1074/1472), bottom-sheet banni (l.1276).
- [Source: ux-design-directions.html] — mockup form notation (l.1245-1334 : axes, NA/Réactiver, comment 500, VisibilityToggle, CTA), agrégats fiche « 4.5 (4) » (l.1163-1187).
- [Source: architecture.md] — Server Actions mutations (l.309), optimistic UI notation (l.554), RLS avant écriture (l.367), naming `ratings_resident_insert` (l.391-392), Journey 2 rate-form (l.1238).
- [Source: supabase/migrations/20260619090000_artisans_schema.sql] — `ratings` + RLS + grants + CHECK + unique (l.91-311).
- [Source: supabase/migrations/20260620090000_artisan_rating_aggregates.sql] — vue agrégats `security_invoker`.
- [Source: supabase/migrations/20260622090000_ratings_author_display_name.sql] — trigger `author_display_name`.
- [Source: app/[locale]/community/annuaire/nouveau/actions.ts] — template Server Action (garde, Zod, rate-limit, `mapVisibilityToIdentityMode`, log).
- [Source: app/[locale]/community/artisan/[slug]/{page,data}.ts] — fiche + data layer (agrégats, comments, isOwner).
- [Source: profiles — supabase/migrations/20260524005559_init_schema.sql:57] — `identity_mode` (`pseudo`/`identified`), défaut `pseudo`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — bmad-dev-story, 2026-06-19

### Debug Log References

- Tests RLS gated exécutés **pour de vrai** contre la stack Supabase locale (REST 54321 up) : `pnpm test:rls` → **29/29 PASS** (25 pré-existants + 4 nouveaux 2.6 : update-own, déni cross-user, conflit unique `23505`, CHECK `ratings_at_least_one_score_check` `23514`). Clés d'env récupérées via `supabase status -o env` ([[project_rls_tests_local_setup]]).
- Suite complète (non-gated) : **298 pass / 33 skip**, +30 vs baseline 2.5 (268). typecheck + lint (0 erreur) verts.
- Aucune migration (DB ratings/RLS/grants/vue agrégats déjà livrés 2.1-2.3) → pas de `gen:types`.

### Completion Notes List

**Livré et validé (typecheck + lint + `test` 298/33 verts ; RLS 29/29 contre Postgres réel) :**

- **Validation** `lib/validation/rating.ts` (`zRatingForm` : 4 axes 1-5 optionnels + refine ≥1 axe, comment ≤500, visibility enum ; `mapRatingFieldError`) — 8 tests.
- **Pseudonyme FR16** `lib/artisans/pseudonym.ts` (`pseudonymSuffix` SHA-256 stable 4 hex, server-only, null si anonymisé) — 5 tests.
- **Server Action** `app/[locale]/community/artisan/[slug]/noter/actions.ts` (`submitRating`) : garde résident + rôle, rate-limit `rating-submit:${userId}` 10/600s, **upsert select-then-branch** (insert/update via client session, RLS+grants), axes NA → `NULL`, mémorisation `identity_mode`, `revalidatePath` fiche — 8 tests unitaires (mocks Supabase).
- **Data layer** `…/[slug]/data.ts` : `fetchMyRating` (prefill), `fetchMyDefaultVisibility` (profil), `user_id` ajouté au select commentaires + suffixe pseudonyme côté serveur.
- **Page dédiée** `…/[slug]/noter/{page,loading}.tsx` + **form** `_components/rate-form.tsx` (4 axes étoiles/NA, commentaire compteur 500, toggle visibilité, `useActionState`, gate ≥1 axe client, a11y radiogroup/radio + ARIA live, étoiles ≥48px) — 3 tests de rendu.
- **CTA fiche** `…/[slug]/page.tsx` : « Noter cet artisan » / « Modifier ma note » (selon `fetchMyRating`).
- **Affichage pseudonyme** `…/_components/comments-list.tsx` : nommé → display_name ; pseudonyme → « Voisin anonyme #XXXX » stable ; anonymisé → « Voisin supprimé ». Test fiche mis à jour.
- **i18n** `community.artisanRate` + `errors.rating` + `community.artisan.comments.{pseudonym,deletedAuthor,rateUpdate}` (FR + stubs AR parallèles).
- **Tests RLS** `tests/rls.test.ts` +4 (gated) PASSÉS contre Postgres réel.

**Décisions techniques (story spec §Décisions) appliquées :**

- Upsert **select-then-branch** (pas `.upsert()` — grants colonne INSERT ≠ UPDATE).
- Byline nommée = `display_name` seul (pas de villa). Form = **page dédiée** `/noter`. Étoiles ≥48px (NFR36). État 0-note = 4 jauges NA existantes + CTA.
- `useOptimistic` **non retenu** : feedback immédiat assuré par panneau succès inline + `revalidatePath` (cohérent pattern 2.4 ; pas de double-validation NFR40b). Aucune dépendance ajoutée (pas de sonner).

**⚠️ Résidus de validation (gated / externe) :**

1. **Flux post-soumission `useActionState`** (succès inline, rendu erreurs) non e2e-testé (limite jsdom connue, cf. 2.4) → cluster **E2E 1.10c**.
2. **Bench Aïcha NFR40 (≤30s)** : non chronométré (validation pré-bêta avec proxy Aïcha, U1).

### File List

**NEW :**

- `lib/validation/rating.ts` (+ `.test.ts`)
- `lib/artisans/pseudonym.ts` (+ `.test.ts`)
- `app/[locale]/community/artisan/[slug]/noter/actions.ts`
- `app/[locale]/community/artisan/[slug]/noter/page.tsx`, `loading.tsx`
- `app/[locale]/community/artisan/[slug]/noter/_components/rate-form.tsx`
- `tests/artisan/rate-action.test.ts`, `tests/artisan/rate-form.test.tsx`

**MODIFIED :**

- `app/[locale]/community/artisan/[slug]/data.ts` (`fetchMyRating`, `fetchMyDefaultVisibility`, `user_id` + pseudonyme)
- `app/[locale]/community/artisan/[slug]/page.tsx` (CTA notation)
- `app/[locale]/community/artisan/[slug]/_components/comments-list.tsx` (pseudonyme stable)
- `messages/fr.json`, `messages/ar.json` (`community.artisanRate`, `errors.rating`, comments.\*)
- `tests/artisan/artisan-fiche.test.tsx` (fixtures pseudonyme)
- `tests/rls.test.ts` (+4 tests ratings write-path)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut 2.6)

### Change Log

| Date       | Version | Description                                                                                                                                                                                                                                                                       |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-19 | 0.1     | Création story 2.6 (context engine). Story applicative pure sur DB prêt. Status → ready-for-dev.                                                                                                                                                                                  |
| 2026-06-19 | 0.2     | Implémentation 2.6 : form notation 4 axes/NA, Server Action upsert select-then-branch, pseudonyme stable FR16, mémorisation identity_mode, CTA fiche, i18n, +4 tests RLS. typecheck/lint verts ; test 298/33 ; RLS 29/29 contre Postgres réel. Aucune migration. Status → review. |

### Review Findings

> Code review adversariale (3 couches : Blind Hunter / Edge Case Hunter / Acceptance Auditor) — 2026-06-19. 1 decision-needed, 3 patch, 2 defer, 13 dismissed (faux positifs / déjà gérés / décisions documentées). Cœur sécurité/intent (upsert select-then-branch, user_id jamais sérialisé, byline display_name seul, NA→NULL, ≥1 axe client+serveur, AR17, role/residence depuis users) **vérifié conforme**.

- [x] [Review][Decision] Entropie du suffixe pseudonyme (4 hex → collisions) — **RÉSOLU (2026-06-19) : garder 4 hex**, compromis spec accepté (risque collision ~1 % à 40 noteurs/artisan, négligeable pour 150 villas). Revisiter en V1.5 si l'échelle grandit. `pseudonymSuffix` tronque SHA-256 à 4 hex (65 536 valeurs) ; la spec mandate explicitement 4 car. (§Task 2). [`lib/artisans/pseudonym.ts:14`]
- [x] [Review][Patch] Robustesse upsert select-then-branch — l'erreur du SELECT existant n'est pas capturée (`const { data: existing }` sans `error`) → un SELECT en échec prend la branche INSERT sur une ligne existante = `23505` surfacé en `submit_failed` générique ; et un double-submit concurrent (race) n'est pas mappé en update. Capturer l'erreur SELECT + traiter `23505` comme fallback UPDATE. [`app/[locale]/community/artisan/[slug]/noter/actions.ts:135-149`]
- [x] [Review][Patch] Helper `mapVisibilityToIdentityMode` dupliqué — défini à l'identique dans `noter/actions.ts:49` ET `nouveau/actions.ts:81`. Task 3 demandait de **réutiliser** le helper 2.4. Extraire dans un module partagé (ex. `lib/validation/artisan.ts` ou `lib/artisans/`) et importer aux deux endroits. [`app/[locale]/community/artisan/[slug]/noter/actions.ts:49`]
- [x] [Review][Patch] CTA notation non-sticky — Task 5 spécifiait un CTA sticky bas (`StickyBottomBar` + `env(safe-area-inset-bottom)`). Le bouton « Publier ma note » est en flux (aucun `sticky`/safe-area dans `rate-form.tsx`). Sur form long (4 axes + commentaire + toggle) le CTA n'est pas épinglé. Aligner sur le pattern sticky existant (`CallButton` fiche). Touch targets ≥48px OK. [`app/[locale]/community/artisan/[slug]/noter/_components/rate-form.tsx:197`]
- [x] [Review][Defer] Scope bleed Story 2.7 dans le diff 2.6 — `actions.ts` contient `retractOwnRating`/`retractOwnComment` (RPC `retract_own_rating`/`retract_own_comment`, migration `20260624090100_artisan_self_actions.sql` présente) alors que 2.7 est `ready-for-dev`. Non appelé par l'UI 2.6 (inoffensif), mais le working tree 2.6 est contaminé. Confirmer que le split 2.6/2.7 est intentionnel avant de commiter. [`app/[locale]/community/artisan/[slug]/noter/actions.ts:187-249`] — deferred
- [x] [Review][Defer] Pas de CHECK DB sur longueur `comment_text` — la colonne est `text` nu ; la borne ≤500 vit uniquement dans Zod (UTF-16 units) + `maxLength` client. Aucun garde-fou défense-en-profondeur DB. Nécessite une migration → hors scope 2.6 (no-migration). [`supabase/migrations/20260619090000_artisans_schema.sql`] — deferred, nécessite migration

### Review Findings (pass 2 — 2026-06-20)

> Code review 2026-06-20 (3 couches adverses : Blind / Edge Case / Acceptance) — ~48 findings bruts → 19 post-triage : **1 décision**, **9 patches**, **4 différés**, **5 noise écartés**. Confirme les findings pass 1 (race upsert, helper dupliqué, CTA non-sticky) + ajoute 7 nouveaux trouvés en croisant les 3 angles + leçons reviews 2.4-2.5-2.7.

#### Décision (à trancher)

- [x] [Review][Decision] **D1 — Pseudonyme `createHash('sha256')` vs `createHmac` avec secret** [`lib/artisans/pseudonym.ts:11-21`] — Spec §Task 2 mandate « HMAC-SHA256 », implémentation livre `createHash('sha256')` sans secret. Conséquence : un co_mod (ou service-role ops) qui a accès aux `users.id` peut **rétro-calculer offline** le suffixe de chaque (user, artisan) en quelques secondes → mapper chaque commentaire pseudonyme à son auteur. FR16 littéral cassé dans le modèle de menace co_mod. Options : (a) **HMAC avec secret env** `PSEUDONYM_SECRET` (≥32 chars random, défense en profondeur ; le co_mod garde l'accès via service-role mais le secret n'est pas trivialement énumérable hors prod) ; (b) **HMAC avec `CONSENT_TOKEN_SECRET` réutilisé** (zéro nouvelle env, mais conceptuellement mélange deux purposes) ; (c) **Accept-as-is + documenter** (le co_mod a déjà accès au mapping via la DB directement — le secret n'apporte que défense contre fuites partielles de hash).

#### Patches (nouveaux — au-delà du pass 1)

- [x] [Review][Patch] **P5 — `comment` non sanitizé (bidi/control chars, leçon 2.4 P3 / 2.5 P23)** [`lib/validation/rating.ts:28`] — `z.string().trim().max(500)` ne strip pas U+202E (RTL override), U+200E/U+200F, zero-width, control ASCII. Un commentaire malveillant peut afficher visuellement un faux byline (inversion) ou cacher du contenu. Fix : appliquer `sanitizeName`-like transform via `lib/validation/sanitize.ts` (helper extrait 2.5 P23) au champ `comment`.

- [x] [Review][Patch] **P6 — Self-rating possible (créateur note sa propre fiche)** [`app/[locale]/community/artisan/[slug]/noter/actions.ts`, `app/[locale]/community/artisan/[slug]/page.tsx:60-66`] — Un user qui a créé un artisan peut noter sa propre fiche (RLS `ratings_resident_insert` ne filtre pas `created_by != user_id`). Biaise les agrégats résidence (NFR confiance/intégrité). Fix : (a) gate `artisan.created_by === userId → forbidden` côté `submitRating` action ; (b) hide le CTA "Noter cet artisan" sur la fiche quand `artisan.isOwner` ; (c) optionnel : policy RLS DB `ratings_resident_insert with check user_id != (select created_by from artisans where id = artisan_id)`.

- [x] [Review][Patch] **P7 — Rate-limit pas par-artisan** [`actions.ts:30-31`] — `checkLimit('rating-submit:${userId}', 10, 600)` cape 10 ratings/10min globalement. Mais un user peut spam-update sa note sur LA MÊME fiche (révise oui-non-oui-non) → pollution `updated_at` flap + pression sur la vue agrégats. Fix : ajouter `checkLimit('rating-update:${userId}:${artisanId}', 3, 600)` après lookup artisan.

- [x] [Review][Patch] **P8 — `profile.update` (identity_mode) fail swallowed silencieusement** [`actions.ts:167-180`] — Si `profiles.identity_mode` update échoue (race, RLS edge), `profileErr` logué en warn et `ok: true` retourné. La mémorisation FR16 est silencieusement cassée : au prochain re-vote, `fetchMyDefaultVisibility` retombe sur le défaut. UX casse sans signal. Fix : (a) surface l'échec via `result.profileMemorizeFailed: boolean` côté UI (affiche un avertissement discret) ; (b) ou retry inline une fois ; (c) accepter mais ajouter télémétrie alerte si récurrent.

- [x] [Review][Patch] **P9 — `RetractControls` state `confirmRating` pas reset + erreur invisible après échec** [`_components/rate-form.tsx:225-296`] — RPC échoue (réseau, RLS edge) → `ratingState.ok=false` mais `confirmRating` reste `true`. Aucun affichage de l'erreur (pas de bloc `{error && ...}` dans `RetractControls`). User re-clique sans savoir. Fix : `useEffect(() => { if (state.error) setConfirmRating(false) }, [state.error])` + render `{state.error && <ErrorBanner/>}` dans le composant.

- [x] [Review][Patch] **P10 — Toggle NA UX : réactiver sans pré-fill scores** [`_components/rate-form.tsx:113-118, 343-349`] — User réactive un axe NA → étoiles cliquables mais `scores[axis]=null`, aucune étoile cochée. `canSubmit` reste true si ≥1 autre axe noté → user peut soumettre sans préciser l'axe réactivé (qui reste NA en DB). Fix : (a) au réactiver, soit pré-fill `scores[axis]=3` (médian) avec hint UI ; (b) afficher un message « ✋ Précisez votre note » jusqu'à click étoile ; (c) le retirer du payload final si pas noté (équivaut à pas avoir cliqué Réactiver — UX minimum surprise).

- [x] [Review][Patch] **P11 — `VISIBILITY` const dupliqué (Task 1 directive)** [`lib/validation/rating.ts:7` + `lib/validation/artisan.ts:10`] — Task 1 mandate « Réutiliser/relocaliser le const VISIBILITY de `lib/validation/artisan.ts:9` ». 2.6 a redéfini un alias parallèle (`RATING_VISIBILITY = ['pseudonym', 'named'] as const`). Fix : importer `VISIBILITY` de `artisan.ts`, supprimer la duplication.

- [x] [Review][Patch] **P12 — Toggle "Non applicable" sans `aria-pressed` + sous `min-h-touch`** [`_components/rate-form.tsx:133-139`] — `<button>` sans `aria-pressed` (SR ne sait pas l'état) ; touch cible ~28px (px-3 py-1 text-xs) — NFR36 mandate ≥48px. Fix : `aria-pressed={isNa}` + `min-h-touch` class.

- [x] [Review][Patch] **P13 — `errors.rating.*` i18n keys présence non vérifiée** [`lib/validation/rating.ts:53-58`] — Codes utilisés : `at_least_one_axis`, `score_invalid`, `comment_too_long`, `visibility_invalid`, `submit_failed`, `artisan_not_found`. Vérifier que `messages/fr.json` et `ar.json` les contiennent (stubs AR comme convention). Si manquant : next-intl 4 lève en strict.

#### Différés

- [x] [Review][Defer] **Bidi inversion sur `#A3F2` suffixe latin en mode AR (Intl.DateTimeFormat chiffres arabes)** [`comments-list.tsx:14-23`] — En locale AR, le rendu mixte (chiffres arabes ٠١٢ + suffix `#A3F2` ASCII + commentaire AR) peut s'inverser sans `<bdi>` wrapper. Cluster V1.5 AR-aware (déjà différé reviews 2.3/2.4).
- [x] [Review][Defer] **`commentLen` UTF-16 vs visual chars** [`rate-form.tsx:177-182`] — Compteur affiche code units (emoji famille = 11) au lieu de graphèmes. Cohérent avec Zod (même base) mais affichage trompeur. Fix demanderait `Intl.Segmenter`. Bénin MVP.
- [x] [Review][Defer] **Slug non-validé côté Server Action** [`actions.ts:60`] — `slug?.trim()` seul, pas de regex `/^[a-z0-9-]+$/`. RLS exact match protège, mais `revalidatePath` peut louper la cible si slug Unicode différent. Cluster défense en profondeur, non bloquant.
- [x] [Review][Defer] **`rating_id` hidden input bypassable côté DOM** [`rate-form.tsx:260`, `actions.ts:208-225`] — RPC `retract_own_rating` SECURITY DEFINER vérifie `user_id = auth.uid()` (confirmé `20260626090000_review_2_7_hardening.sql`). Bypass DOM inoffensif côté DB.

#### Dismissed

- `fetchMyRating` cache key sans userId : `cache()` React = per-request, RSC = one-user-per-request → bénin.
- `fetchArtisanResponses` no cache : Story 2.8 (hors scope 2.6).
- `requireResident` redondant avec re-check role : pattern leçon 2.4 P7 documenté ; le helper sera refactor.
- `score_invalid` mappé génériquement par axe : trade-off conscient (4 axes, message commun).
- `setAnnounce` overwrite SR queue : comportement standard `aria-live="polite"`, pas un finding.
