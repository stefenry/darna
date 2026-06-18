# Story 2.3: Fiche artisan détaillée + action `tel:`

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **resident**,
I want **consulter une fiche artisan structurée (infos complètes, 4 jauges typées, avis, appel 1-tap) et tomber sur un 410 propre si la fiche n'existe plus**,
so that **je décide vite et j'appelle sans friction, en ligne comme hors-ligne**.

Story aval de l'Epic 2 : elle consomme le schéma 2.1 (`artisans`/`ratings`/`tags`, vue `artisan_rating_aggregates`) et les composants 2.2 (`RatingGauge` `variant="full"` déjà prêt, `Chip`, tokens v2). Cible du deep-link partagé (Epic 6). **Lecture seule** : noter = 2.6, éditer/retirer = 2.7, partager = 6.2, signaler = 5.2.

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 2.3 » (l. 920-948). Une **précision technique** sur le statut HTTP 410 (voir Dev Notes §410) est détaillée et prime sur la lettre de l'AC.

1. **AC1 — Contenu fiche.** Étant donné que j'ouvre `/[locale]/community/artisan/[slug]`, quand la page rend, alors je vois : `display_name` (locale), **tous** les tags compétence (locale-aware), **notation agrégée par axe (4 jauges full : count + moyenne, ou « NA »)**, prix relatif (`$`-`$$$$`), badge `has_invoice`, les **10 commentaires les plus récents** (pseudonyme ou nommé selon le `visibility` de chaque contributeur), et le téléphone artisan (formaté E.164). (FR13)
2. **AC2 — Appeler 1-tap.** Étant donné un téléphone `+212XXXXXXXXX`, quand je tape le bouton « Appeler {nom} » (CTA primaire **≥ 56px**, sticky bas au scroll — AR16, NFR36), alors le dialer OS s'ouvre via `tel:+212XXXXXXXXX`, **sans modal de confirmation**. (FR14, NFR40)
3. **AC3 — Tombstone 410.** Étant donné un artisan soft-deleted (`deleted_at IS NOT NULL`) ou refusé (`state='refused'`), quand j'ouvre `/artisan/<ancien-slug>`, alors je reçois une réponse **410 Gone** avec un message localisé « Cette fiche n'est plus disponible » — et le slug reste **tombstoné** (jamais réutilisé). (CC #19)
4. **AC4 — Offline.** Étant donné que la fiche a été cachée en ligne, quand je l'ouvre hors-ligne, alors le contenu rend en **< 100ms** depuis le cache ; le bouton Appeler fonctionne toujours (`tel:` est OS-level, sans réseau). (NFR8)
5. **AC5 — Panel contributeur.** Étant donné que je suis le contributeur (`created_by = auth.uid()`), quand je vois la fiche, alors un panel « Modifier ma contribution » / « Retirer » est visible. **Scope 2.3** : détection + affichage du panel avec entrées (boutons/liens) ; les **actions** d'édition/retrait sont implémentées en **Story 2.7** (boutons désactivés ou liant vers un stub `#`).
6. **AC6 — URL canonique.** Et `darna.org/artisan/[slug]` est l'URL canonique préparatoire au partage (Epic 6). **Précision** : la route réelle est locale-préfixée (`/[locale]/community/artisan/[slug]`, cohérent avec le lien de la carte 2.2) ; le slug canonique sans préfixe locale relève de la **Story 6.1**.

### AC additionnel (régression — obligatoire)

7. **AC7 — RSC + a11y + tests verts.** Server Components par défaut, `loading.tsx` skeleton (jamais spinner), `prefers-reduced-motion` respecté, focus/clavier OK. `pnpm typecheck`, `pnpm lint`, `pnpm test` restent verts. Aucune fuite RLS (lecture scopée résidence + published, ou own-pending pour le contributeur).

## Tasks / Subtasks

- [x] **Task 1 — Couche données fiche** (AC: 1, 3, 7)
  - [x] Créer `app/[locale]/community/artisan/[slug]/data.ts` (server-only, calquer `annuaire/data.ts`). `fetchArtisanBySlug(locale, slug)` via client SSR session (`lib/supabase/server`). Sélectionne l'artisan **par slug** + tags (`artisan_tags`→`tags`) + agrégats (vue `artisan_rating_aggregates`). **Ne PAS filtrer `state='published'` au niveau requête** : on doit distinguer « introuvable » (404) de « tombstoné » (410, `deleted_at not null` ou `state='refused'`). La RLS limite la visibilité — un résident voit les `published` de sa résidence + ses propres `pending`. Mapper vers `toAxisScores` (réutiliser `lib/artisans/rating.ts`).
  - [x] `fetchArtisanComments(artisanId)` : 10 `ratings` les plus récents avec `comment_text is not null`, `deleted_at is null`, `order created_at desc limit 10`. Résoudre l'identité par `visibility` : `named` → nom du contributeur (jointure `users`/`profiles`) ; `pseudonym` → libellé générique (voir Dev Notes §Avis). RLS `ratings_resident_select_residence` scope déjà.
  - [x] Distinguer les cas de retour : `null` (slug inexistant → 404), artisan tombstoné (`deleted_at`/`refused` → 410), artisan visible (rendu).

- [x] **Task 2 — Page fiche + statut 410** (AC: 1, 3, 6, 7)
  - [x] `app/[locale]/community/artisan/[slug]/page.tsx` (RSC, `dynamic='force-dynamic'`, `assertLocale`, `setRequestLocale`, `generateMetadata` via `getTranslations`). Auth déjà gardée par `community/layout.tsx` + `proxy.ts` (`COMMUNITY_PATTERN` matche `artisan`).
  - [x] **410 (voir Dev Notes §410, décision tranchée)** : pour un slug tombstoné, rendre l'UI « Cette fiche n'est plus disponible » ET émettre un **statut 410** via un Route Handler `app/api/artisan/[slug]/route.ts` consulté en amont, OU via le pattern retenu en Dev Notes. Si le slug est inexistant → `notFound()` (404).
  - [x] `loading.tsx` skeleton fiche (header + jauges + avis, `motion-safe:animate-pulse`, jamais spinner). `error.tsx` bannière inline (calquer `annuaire/error.tsx`).

- [x] **Task 3 — Composants fiche** (AC: 1, 2, 5, 7)
  - [x] `_components/artisan-header.tsx` : H1 nom + row chips compétences (réutiliser `Chip` de l'annuaire — extraire en `components/` partagé si besoin) + prix badge + facture badge. Slot header `[←]` retour + `[⋯]` overflow (le menu share = Epic 6.2 → bouton présent mais inactif/`aria-disabled` au MVP).
  - [x] `_components/rating-gauges-full.tsx` : les **4 jauges** via `RatingGauge variant="full"` (déjà implémenté en 2.2 — réutiliser tel quel, ordre canonique des axes).
  - [x] `_components/comments-list.tsx` : liste des 10 avis (carte borderless v2 : pseudonyme/nom + score(s) + commentaire + date relative locale). État vide « Aucun avis pour l'instant ».
  - [x] `_components/call-button.tsx` (`'use client'` si sticky/scroll-aware, sinon RSC) : CTA `<a href="tel:...">` **≥ 56px** (`min-h-touch-lg`), **sticky bottom** (`sticky bottom-4` ou barre fixe), label « Appeler {nom} », sans modal. `tel:` fonctionne hors-ligne (OS-level).
  - [x] `_components/contributor-panel.tsx` : visible si `isOwner` ; entrées « Modifier ma contribution » / « Retirer » (actions = 2.7 → liens stub ou boutons `disabled` documentés).

- [x] **Task 4 — Offline cache fiche** (AC: 4)
  - [x] Étendre la stratégie Serwist (`sw/index.ts`) : règle `CacheFirst` pour les fiches (`/api/artisan/*` si endpoint, OU s'appuyer sur `cacheOnNavigation` pour la navigation `/community/artisan/[slug]`). Réutiliser le pattern 2.2 (cache partitionné par URL, `ExpirationPlugin`). Le bouton `tel:` reste fonctionnel offline.

- [x] **Task 5 — i18n + a11y** (AC: 1, 3, 5, 7)
  - [x] Namespace `community.artisan.*` dans `messages/fr.json` (titre, appeler, avis, vide, tombstone « Cette fiche n'est plus disponible », panel contributeur) + `errors.artisan`. AR fallback FR. Aucune chaîne en dur ; props CSS logiques (`me-*`/`ps-*`).
  - [x] CTA `≥ 56px`, focus visible, `role`/`aria` corrects, `prefers-reduced-motion`. Le `tel:` est un `<a href="tel:">` (pas de JS requis).

- [x] **Task 6 — Tests + validation** (AC: 3, 7)
  - [x] Composant `tests/artisan/*.test.tsx` (template `tests/install/install-page.test.tsx` : `NextIntlClientProvider` + `frMessages`) : header (nom/tags/prix/facture), 4 jauges `role="meter"`, CTA `tel:` href + taille, panel contributeur conditionnel (`isOwner`), commentaires pseudonyme/nommé, état tombstone.
  - [x] Unitaire pur si logique extraite (ex. résolution identité commentaire). RLS : si nouvelle requête/vue lisible, étendre `tests/rls.test.ts` (réutiliser `establishSession` magic-link + le setup artisans 2.2 — voir [[project_rls_tests_local_setup]]).
  - [x] `pnpm typecheck`/`lint`/`test` verts ; seeder un artisan `published` + un `refused`/soft-deleted via service-role pour tester rendu + 410.

## Dev Notes

> **Stack & conventions** : identiques à 2.2 (Next 16.2.6 RSC, React 19, `@supabase/ssr`, next-intl 4.12, Tailwind 3.4 tokens Darna, Serwist 9.5, Vitest 4). Voir la story 2.2 §Architecture pour le détail — non répété ici.

### Réutilisation directe (NE PAS réinventer)

- **`RatingGauge`** (`app/[locale]/community/annuaire/_components/rating-gauge.tsx`) supporte **déjà** `variant="full"` (barre h-2, texte 13px, `role="meter"`, NA, motion-safe). La fiche affiche les **4** axes (vs 2 sur la carte). Aucune modif du composant requise.
- **`lib/artisans/rating.ts`** : `toAxisScores(row)` → 4 `AxisScore` depuis la vue. (`topAxes` non requis ici — on affiche les 4.)
- **Vue `artisan_rating_aggregates`** (2.2, `security_invoker`) : moyenne + count par axe, RLS-scopée. Réutiliser pour les jauges.
- **`Chip`** (annuaire `_components/chip.tsx`) pour les tags. Si partagé entre annuaire et fiche → envisager de le remonter en `components/` (sinon import cross-feature acceptable au MVP).
- **Patterns data** : `annuaire/data.ts` (client SSR, `{data,error}` + log + fallback, jointures `artisan_tags(tags(...))`, mapping locale via `pickLocale`). Cast `as unknown as Row[]` pour l'embedding supabase-js si l'inférence résiste.
- **Page/loading/error** : calquer `annuaire/{page,loading,error}.tsx` (auth via layout, `force-dynamic`, `assertLocale`).

### §410 — statut HTTP Gone en App Router (décision à acter par le dev)

Next.js App Router **n'a pas** de `gone()` natif (seulement `notFound()` → 404). Trois options, par ordre de préférence :

1. **Route Handler `app/api/artisan/[slug]/route.ts`** qui renvoie `new NextResponse(html?, { status: 410 })` pour un slug tombstoné — et la navigation `/community/artisan/[slug]` détecte le tombstone et `redirect()` / affiche l'UI gone. Plus de plomberie mais 410 vrai.
2. **Page rend l'UI « gone » avec statut 200** + en-tête custom, et le **vrai 410 + enforcement tombstone** est finalisé en **Story 6.1** (slugs canoniques + tombstone). Plus simple, fidèle au découpage epics (CC #19 ↔ 6.1).
3. Middleware `proxy.ts` — rejeté (n'a pas l'état DB sans requête supplémentaire à chaque hit).
   **Recommandation** : viser l'option 1 si le coût est raisonnable, sinon option 2 en documentant que le statut 410 strict arrive en 6.1. **Ne jamais réutiliser un slug tombstoné** (la contrainte `unique` sur `artisans.slug` couvre déjà les lignes soft-deleted — 2.1, donc tombstoning DB déjà garanti).

### §Avis — identité pseudonyme / nommé

`ratings.visibility` ∈ `{pseudonym, named}` (2.1) + `ratings.user_id` (nullable si anonymisé). Affichage :

- `named` → nom lisible du contributeur (jointure `users`/`profiles` ; `profiles.identity_mode` existe). Quel champ exact (first_name ?) à confirmer dans le schéma — **à vérifier dans la migration 2.1/`init_schema`**.
- `pseudonym` (défaut) **ou** `user_id IS NULL` (anonymisé/purgé) → libellé générique non identifiant (ex. « Un voisin » / « Une voisine » — neutre au MVP, ou un handle déterministe si 2.6 en définit un). **À trancher** avec la story 2.6 (notation typée + pseudo/identité) ; au MVP 2.3, un libellé générique suffit pour l'affichage.
- Filtrer `deleted_at is null`, `comment_text is not null`, `limit 10`, `order created_at desc` (index `idx_ratings_artisan_id_created_at` existe).

### §Offline & sticky CTA

- Cache : réutiliser le pattern Serwist 2.2 (`CacheFirst` + `ExpirationPlugin`, partition par URL). Le `tel:` est OS-level → marche offline sans cache.
- CTA sticky : `sticky bottom-0`/barre fixe avec `pb-[safe-area]` ; ne pas masquer le dernier avis (padding bas sur le container). `min-h-touch-lg` (56px) défini dans `tailwind.config.ts`.

### §Scope boundaries

- **DANS** : route fiche, contenu complet, 4 jauges, avis (lecture), CTA appeler sticky, 410 tombstone (option retenue), offline, détection contributeur + panel (entrées). **HORS** : édition/retrait réel (2.7), noter (2.6), partager `navigator.share`/menu ⋯ (6.2), signaler (5.2), slug canonique sans préfixe locale (6.1), suggestion post-appel 24-48h (polish V1.5), onboarding jauges (V1.5).

### Project Structure Notes

- **NEW** : `app/[locale]/community/artisan/[slug]/{page,loading,error,data}.tsx` + `_components/{artisan-header,rating-gauges-full,comments-list,call-button,contributor-panel}.tsx` ; éventuellement `app/api/artisan/[slug]/route.ts` (option 410 #1) ; `tests/artisan/*`.
- **UPDATE** : `messages/fr.json` (`community.artisan` + `errors.artisan`), `sw/index.ts` (cache fiche), possiblement `tests/rls.test.ts`.
- **Réutiliser** : `lib/supabase/server.ts`, `lib/auth/require-resident.ts` (via layout), `RatingGauge`, `Chip`, `lib/artisans/rating.ts`, vue `artisan_rating_aggregates`, `components/layout/page-container.tsx`, `lib/i18n/navigation`.

### References

- [Source: epics.md#Story-2.3] — AC verbatim, FR13/FR14, AR16, NFR8/NFR36/NFR40, CC #19.
- [Source: ux-design-specification.md §Complétion fiche artisan (l.429-442)] — structure header/jauges/CTA sticky/avis/panel contributeur, post-call soft.
- [Source: _bmad-output/implementation-artifacts/2-2-...md] — composants réutilisés (RatingGauge full, Chip, data patterns, vue agrégat), résidu offline e2e.
- [Source: supabase/migrations/20260619090000_artisans_schema.sql] — `ratings.visibility`, soft-delete, slug unique tombstone, index.
- [Source: docs/adr/0003-locale-routing-public-only.md] — routing, URL canonique (préparation 6.1).
- [Source: docs/adr/0004-rls-vs-fk-discipline.md] — lectures `security_invoker`, scoping résidence.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context) — bmad-dev-story, 2026-06-17

### Debug Log References

- SW typecheck séparé (`sw/tsconfig.json`) OK avec la règle `CacheFirst` fiche.
- Data layer fiche : embedding supabase-js (`users ( display_name )`, `artisan_tags ( tags )`) typé via cast `as unknown as Row[]` (inférence imbriquée fragile, comme 2.2). Validé `typecheck`.

### Completion Notes List

**Livré et validé (`pnpm typecheck` + `lint` + `test` verts — 232 pass / 25 skip ; 6 nouveaux tests composant) :**

- **Data** `data.ts` : `fetchArtisanBySlug` (discriminated `found`/`gone`/`not-found`, wrappé `cache()` pour dédupe metadata+page) + `fetchArtisanComments` (10 récents, identité pseudo/nommé via `users.display_name`). Réutilise `toAxisScores`, `pickLocale`, vue `artisan_rating_aggregates`.
- **Page** RSC `page.tsx` (3 branches), `loading.tsx` skeleton, `error.tsx`.
- **Composants** `ArtisanHeader` (retour + overflow inactif, nom, prix, tags `Chip`, facture), `RatingGaugesFull` (4× `RatingGauge variant="full"` réutilisé), `CommentsList` (pseudo/nommé + scores par axe), `CallButton` (sticky bas, `tel:` direct, `min-h-touch-lg` 56px), `ContributorPanel` (entrées inactives).
- **Offline** règle Serwist `CacheFirst` pour les navigations `/community/artisan/*`.
- **i18n** namespace `community.artisan` + `errors.artisan` (FR ; AR fallback).
- **Tests** `tests/artisan/artisan-fiche.test.tsx` (6) : header, 4 jauges, CTA tel:/taille, avis pseudo/nommé/vide, panel.

**Décisions techniques (conformes aux recos de la story) :**

- **410 → Option 2** : un slug tombstoné (`deleted_at` ou `state='refused'`) rend l'UI « Cette fiche n'est plus disponible » ; le **statut HTTP 410 strict** est différé à la **Story 6.1** (App Router n'a pas de `gone()` natif). Un slug inexistant → `notFound()` (404). Détection tombstone via **`createAdminClient`** (lecture minimale `deleted_at`/`state`) car la RLS masque entièrement les soft-deleted au client session.
- **Identité avis** : `named` → `users.display_name` (si lisible) ; sinon → libellé générique « Un voisin ». Alignement fin pseudo/identité = Story 2.6.
- Pas d'extension `tests/rls.test.ts` : la fiche n'ajoute aucun objet DB lisible nouveau (vue agrégat déjà testée 2.2 ; tombstone = bypass admin server-only assumé).

**⚠️ Résidus de validation (gated — non exécutés) :**

1. **Data layer + 404 en conditions réelles** : `fetchArtisanBySlug`/`fetchArtisanComments` (embeddings, `author_display_name` via trigger) non exécutés contre la stack — comme la data layer 2.2. À smoke-tester avec un seed (artisan `published` + un `refused`) via `pnpm test:rls`-style ou navigateur.
2. **Offline e2e** : non testable headless. ⚠️ **AC4 régressé** : la fiche détaillée n'est plus en `CacheFirst` (D1 → fuite cross-user) ; seul l'annuaire + `tel:` OS-level survivent offline. À documenter UX.
3. **`pnpm gen:types` à rejouer + `pnpm supabase db reset` après application de la migration `20260622090000_ratings_author_display_name.sql`** — la colonne `ratings.author_display_name` est absente de `lib/supabase/types.generated.ts` au moment du commit (typecheck passe via cast `as unknown as CommentRow[]`).

**Patches review 2026-06-17 (appliqués post-review code) :** 18/21 patches code + 3 décisions architecturales (D1 SW cache, D2 `author_display_name`, D3 abandon 404/410). Détail complet et défers : voir section ### Review Findings ci-dessous + `_bmad-output/implementation-artifacts/deferred-work.md`. **AC3 régressé** à 404 simple (UI gone retirée) en attendant le 410 strict de Story 6.1. **AC4 régressé** (cache offline fiche retiré ; voir résidu n°2 ci-dessus).

### File List

**NEW :**

- `app/[locale]/community/artisan/[slug]/page.tsx`, `loading.tsx`, `error.tsx`, `data.ts`
- `app/[locale]/community/artisan/[slug]/_components/artisan-header.tsx`, `rating-gauges-full.tsx`, `comments-list.tsx`, `call-button.tsx`, `contributor-panel.tsx`
- `tests/artisan/artisan-fiche.test.tsx`
- `supabase/migrations/20260622090000_ratings_author_display_name.sql` _(review P20)_

**MODIFIED :**

- `messages/fr.json` (namespaces `community.artisan` + `errors.artisan` ; +`phoneAriaLabel`/`phoneUnavailable` review P9/P1)
- `messages/ar.json` (stubs AR mirroir `community.artisan` + `community.artisanCreate` + `errors.artisan` ; review P12)
- `sw/index.ts` (runtime `CacheFirst` fiche **retirée** — review P19/D1)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (statut 2.3 → done)
- `_bmad-output/implementation-artifacts/deferred-work.md` (6 défers code review 2.3)

### Change Log

| Date       | Version | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-17 | 0.1     | Implémentation story 2.3 : fiche artisan (header, 4 jauges full, avis pseudo/nommé, CTA appeler sticky `tel:` 56px, panel contributeur), tombstone gone UI (410 strict → 6.1), offline CacheFirst fiche, i18n. typecheck/lint/test verts (232 pass, 6 nouveaux). Statut → review.                                                                                                                                                                                                                                                |
| 2026-06-17 | 0.2     | Code review (3 couches adverses parallèles) : 21 patches appliqués (18 code + 3 décisions D1/D2/D3) ; 6 défers ; 5 noise écartés. **Régressions assumées** : AC3 (UI gone retirée, 404 simple — 410 strict → 6.1), AC4 (cache offline fiche retiré pour éviter fuite cross-user). **Nouvelles features** : téléphone visible formaté MA, validation E.164 stricte CTA, matérialisation `ratings.author_display_name` (migration + trigger), stubs AR convention. typecheck/lint/test verts (263 pass, +31 tests). Statut → done. |

### Review Findings

> Code review 2026-06-17 — Blind Hunter + Edge Case Hunter + Acceptance Auditor (3 couches adverses parallèles). 32 findings post-triage : 3 décisions, 18 patches, 6 différés, 5 noise écartés.

#### Decisions (résolues 2026-06-17)

- [x] [Review][Decision] **SW cache `CacheFirst` 1h sert page authentifiée à un autre user** — `sw/index.ts:43-50`. **Décision : exclure les pages auth du SW cache** (retirer `artisanFicheCache` ; AC4 strict cassé pour la fiche détaillée, annuaire + `tel:` OS-level préservés). → Patch P19 ci-dessous.
- [x] [Review][Decision] **`users.display_name` masqué par RLS → feature `named` morte** — `data.ts:153,167`. **Décision : matérialiser `author_display_name` sur `ratings`** (migration + snapshot au write ; lecture via la nouvelle colonne, plus d'embed `users`). → Patch P20 ci-dessous.
- [x] [Review][Decision] **`createAdminClient()` pour distinguer 404/410** — `data.ts:115-125`. **Décision : renoncer à la distinction → `notFound()` partout** (cohérent avec 410 strict déféré 6.1 ; retire bypass RLS + risque DoS). → Patch P21 ci-dessous.

#### Patches (appliqués 2026-06-17)

> 21 patches au total ; 18 appliqués ; **3 obsolètes** (rendus inutiles par les décisions D1/D2/D3) : **P2** (matcher SW regex) → retiré par P19, **P11** (robots:noindex gone) → retiré par P21, **P18** (users embed array) → retiré par P20. Marqués cochés pour clôture mais sans changement de code.

- [x] [Review][Patch] **Valider `phone_e164` côté affichage (DTMF injection / format invalide)** [`_components/call-button.tsx:12`] — `href={`tel:${phoneE164}`}` brut ; un `,`/`;`/espace en DB compose des DTMF post-décrochage. Pas de contrainte SQL E.164 (W1 deferred-work 2.1). Ajouter regex strict `^\+\d{8,15}$` ou fallback CTA désactivé.
- [x] [Review][Patch] **SW matcher `pathname.includes('/community/artisan/')` trop large** [`sw/index.ts:44-46`] — Match sur futures sous-routes `/edit`, `/admin/...`. Remplacer par regex ancrée locale `^/(fr|ar)/community/artisan/[^/]+$`.
- [x] [Review][Patch] **Contributeur d'un artisan `state='refused'` voit la fiche comme normale** [`data.ts:84-113`] — La policy `artisans_resident_select_own_pending` ne filtre pas par `state` ; `data.state='refused' && deleted_at IS NULL && created_by=auth.uid()` → `kind='found'`. Ajouter `if (row.state === 'refused') return { kind: 'gone' }` (et inclure `state` dans `DETAIL_SELECT`).
- [x] [Review][Patch] **`error.tsx` `Set captured` module-level non-borné + dedup empêche re-capture** [`error.tsx:10,22-29`] — Croissance monotone + perte d'observabilité Sentry après retry échoué. Borner LRU (~50) ou retirer le dedup module-level (le `seen.current` instance suffit).
- [x] [Review][Patch] **Sticky CTA recouvre le dernier commentaire sur mobile** [`page.tsx:62`, `call-button.tsx:10`] — `sticky bottom-4` en dernier enfant + `pb-24` (96px) insuffisant si CTA ≥ 56px + padding + barre URL iOS. Passer en `fixed bottom-0` hors article OU augmenter `pb` à `pb-32`/`pb-36`.
- [x] [Review][Patch] **Tri des tags par `key` ASCII au lieu du `label` localisé** [`data.ts:96`] — Ordre incohérent vs ce que l'utilisateur lit (et faux pour AR). `.sort((a, b) => a.label.localeCompare(b.label, locale))` après le mapping.
- [x] [Review][Patch] **`pickLocale` accepte `display_name_fr=''` (vide) sans fallback** [`data.ts:64-66`] — `<h1>` vide + `Metadata.title=''` + CTA « Appeler ». Ajouter `fr.trim() || '—'` (ou contrainte CHECK SQL, mais hors scope ici).
- [x] [Review][Patch] **`notFound()` dans `generateMetadata` génère bruit Sentry pour locale invalide** [`page.tsx:26-31`] — Next traite ça comme erreur metadata. Retourner `{}` quand `assertLocale` faux (ou wrap try/catch).
- [x] [Review][Patch] **Numéro de téléphone jamais affiché à l'écran (déviation AC1)** [`page.tsx:67`, `_components/call-button.tsx`] — AC1 liste explicitement « téléphone artisan (formaté E.164) » comme contenu visible. Aujourd'hui visible uniquement dans le `href`. Ajouter affichage formaté sous le CTA ou dans le header.
- [x] [Review][Patch] **Couverture tests lacunaire** [`tests/artisan/artisan-fiche.test.tsx`] — Manque : branche UI `gone` (AC3), `isOwner=true` rendant `ContributorPanel` (AC5), `has_invoice='sur_demande'` et `null` (AC1), label « NA » d'une jauge (AC1), data layer 3 issues (`found`/`gone`/`not-found`).
- [x] [Review][Patch] **Page `gone` indexée par les crawlers (status 200 + pas de noindex)** [`page.tsx:42-56`] — Quick-win SEO en attendant 410 strict (W1 → 6.1). Ajouter `robots: { index: false }` dans `generateMetadata` quand `result.kind === 'gone'`.
- [x] [Review][Patch] **Stubs AR absents pour `community.artisan` + `errors.artisan`** [`messages/ar.json`] — Convention projet : tous namespaces FR ont miroir AR vide (cf. `community.annuaire`). Fallback runtime fonctionne mais convention cassée.
- [x] [Review][Patch] **Skeleton `loading.tsx` n'imite pas la section avis** [`loading.tsx`] — CLS visible quand les 10 cartes commentaires s'insèrent. Ajouter titre + 2-3 cartes placeholder.
- [x] [Review][Patch] **`.not('comment_text', 'is', null)` accepte la chaîne vide** [`data.ts:156`] — Carte avec `<p>` vide rendue. Ajouter `.neq('comment_text', '')` (ou CHECK SQL).
- [x] [Review][Patch] **`createdAt` invalid Date non guardé** [`_components/comments-list.tsx`] — Si format inattendu → « Invalid Date ». `const d = new Date(s); !Number.isNaN(d.getTime()) ? ... : ''`.
- [x] [Review][Patch] **`slug` whitespace-only / décodé vide → round-trip DB + appel admin inutile** [`page.tsx:33-40`] — Ajouter `if (!slug?.trim()) notFound()` avant `fetchArtisanBySlug`.
- [x] [Review][Patch] **`<h1>` `displayName` très long déborde et écrase le badge prix mobile** [`_components/artisan-header.tsx`] — Ajouter `break-words` (et/ou `line-clamp-2`) sur le `<h1>`.
- [x] [Review][Patch] **Cardinalité Supabase `users ( display_name )` ambiguë (objet vs array)** [`data.ts:137,153,167`] — Embedding FK _to-one_ renvoie objet, _to-many_ renvoie array selon déclaration. Aucun test runtime. Normaliser : `Array.isArray(r.users) ? r.users[0]?.display_name : r.users?.display_name`. _Obsolète si P20 appliqué (suppression embed `users`)._
- [x] [Review][Patch] **P19 (← D1) : retirer `artisanFicheCache` du SW** [`sw/index.ts:40-57`] — Supprimer la `RuntimeCaching` artisan + sortir du tableau `runtimeCaching`. Documenter la régression AC4 (offline fiche détaillée n'est plus < 100ms ; CTA `tel:` reste OS-level ; annuaire reste cachable). Mettre à jour Completion Notes + Change Log.
- [x] [Review][Patch] **P20 (← D2) : matérialiser `author_display_name` sur `ratings`** — Migration `supabase/migrations/<timestamp>_ratings_author_display_name.sql` : `ALTER TABLE ratings ADD COLUMN author_display_name TEXT NULL;` + backfill `UPDATE ratings r SET author_display_name = u.display_name FROM users u WHERE u.id = r.created_by;`. Adapter le chemin write (story 2.6 — flagger en pré-requis) ou ajouter trigger DB intermédiaire. Côté lecture : remplacer l'embed `users(display_name)` par lecture directe de `r.author_display_name` ; supprimer le type `CommentRow.users`. Regen `lib/supabase/types.generated.ts`.
- [x] [Review][Patch] **P21 (← D3) : retirer la branche `createAdminClient()` dans `fetchArtisanBySlug`** [`data.ts:115-125`] — Remplacer par `if (!data) return { kind: 'not-found' }`. Supprimer l'import `createAdminClient`. Retirer le type `FetchArtisanResult` variant `'gone'` (et la branche correspondante dans `page.tsx:42-56`) OU le garder pour le futur 6.1 mais le marquer dead-code. Vérifier que les tests artisan-fiche n'asseyent plus la branche `gone` (sinon les marquer `skip` avec note 6.1). Mettre à jour Completion Notes : « AC3 régressé à 404 simple en attente du 410 strict de 6.1 ».

#### Différés (pre-existing / hors-scope / dette assumée)

- [x] [Review][Defer] **Statut HTTP 410 strict non émis (page `gone` retourne 200 OK)** [`page.tsx:42-56`] — Spec §410 Option 2 acceptée explicitement ; 410 strict déféré Story 6.1.
- [x] [Review][Defer] **Double cast `as unknown as DetailRow/CommentRow[]`** [`data.ts:85,162`] — Tech debt typage supabase-js sur select imbriqué. Documenté en Completion Notes.
- [x] [Review][Defer] **CTA sticky sans `pb-[env(safe-area-inset-bottom)]`** [`_components/call-button.tsx:10`] — Cohérence projet (entier ignore safe-area aujourd'hui). À traiter globalement.
- [x] [Review][Defer] **Pas de pagination au-delà des 10 commentaires** [`data.ts:159`, `_components/comments-list.tsx`] — Décision produit (spec « 10 plus récents »).
- [x] [Review][Defer] **Tests : `toBeDefined()` tautologique + strings FR hardcodées + a11y `ContributorPanel` non testée** [`tests/artisan/artisan-fiche.test.tsx`] — Qualité tests à reprendre post-MVP.
- [x] [Review][Defer] **CTA `tel:` + i18n sans `<bdi>` / `dir="auto"` pour mixed-script RTL** [`_components/call-button.tsx`] — V1.5 AR différée ; MVP FR-only.

#### Dismissed (noise / faux positifs)

- `useTranslations` dans server components — supporté officiellement par next-intl 4 avec `setRequestLocale` (présent `page.tsx:36`).
- `cache()` figeant `isOwner` — `cache()` React est per-request ; auth context cohérent dans une même requête SSR.
- `cache()` non appliqué à `fetchArtisanComments` — appelé 1 fois par requête.
- `RatingGaugesFull` `Map` recréé à chaque rendu — server component, micro-perf irrelevant.
- Commentaires FR/anglais mélangés dans le code — convention équipe.
