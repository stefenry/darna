# Story 3.4: Pack accueil mis en avant post-validation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> ⚠️ **3 points structurants** (détaillés en Dev Notes) : (1) **Colonnes lifecycle déjà prêtes** — `users.first_login_at` et `users.pack_accueil_dismissed_at` (nullable `timestamptz`) **existent** (1.3) et sont **grantées en UPDATE self** au résident (`init_rls`) → 3.4 n'ajoute **aucune** migration. (2) **Route `pack-accueil` statique** — `community/guide/pack-accueil/` lit `pack_entries` (3.1), prime sur `guide/[slug]` (segment statique > dynamique), réutilise le `<MarkdownRender>` de 3.2. (3) **Deux signaux distincts** — `pack_accueil_dismissed_at` (j'ai fermé la bannière) ≠ `first_login_at` (j'ai fini de lire le pack) ; la bannière disparaît si **l'un OU l'autre** est non-null (sémantique précise en §Décisions D2).

## Story

As a **nouveau résident (Salma — Journey 3)**,
I want **un « Pack accueil » curé mis en avant automatiquement à mon premier login post-admission**,
so that **j'obtiens en 10 minutes un aperçu qui m'aurait coûté 3 semaines de questions WhatsApp gênées**.

Story d'**onboarding** : elle branche la mise en avant automatique (bannière conditionnée au lifecycle `users`) + la page Pack lisant `pack_entries` (3.1) avec deep-links vers les entrées Guide (3.2). L'alimentation co_mod du pack relève de 3.5. C'est le dernier maillon « lecture » de l'Epic 3 côté résident.

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 3.4 » (l. 1220-1246). FR25, NFR37/NFR45. Précisions techniques (sémantique des 2 signaux, Server Actions, route statique) en Dev Notes — elles priment.

1. **AC1 — Bannière premier login.** Étant donné que je suis authentifié et `users.first_login_at` est `NULL` (et `pack_accueil_dismissed_at` `NULL`), quand j'atterris sur `/community/`, alors une **bannière proéminente** m'invite à « Découvrir le Pack accueil » avec un tap vers `/community/guide/pack-accueil`. (FR25)
2. **AC2 — Contenu du Pack.** Étant donné que je tape dans le Pack accueil, quand la page rend, alors je vois des **sections** (Codes portails, Horaires gardien, Jours poubelles, Contacts utiles, Traditions locales — issues de `pack_entries` regroupées par `section_key`) dans ma locale, chaque section **dépliable**, avec **deep-links vers les entrées Guide** liées.
3. **AC3 — Dismiss persistant.** Étant donné que je ferme la bannière (tap « Plus tard » ou « ✕ »), quand je reviens sur la home, alors la bannière **n'est plus affichée** — `users.pack_accueil_dismissed_at = now()` est posé ; le Pack reste **accessible** via le menu/Guide (tuile ou lien).
4. **AC4 — Fin de lecture = onboarding complété.** Étant donné que je finis de lire le Pack accueil, quand je ferme la page, alors `users.first_login_at = now()` est posé, persistant que j'ai complété le signal d'onboarding.
5. **AC5 — a11y + RTL.** Et la page Pack et la bannière sont **navigables au clavier de bout en bout** et **RTL-correctes**. (NFR37, NFR45)

### AC additionnel (régression — obligatoire)

6. **AC6 — Sécurité + idempotence + tests verts.** Écriture des 2 signaux via **client session** uniquement (grant `update(first_login_at, pack_accueil_dismissed_at)` sur `users` réservé au self via RLS `users_resident_update_self` — `id = auth.uid()`) ; **jamais** `createAdminClient`. Les Server Actions sont **idempotentes** (ne réécrivent pas un timestamp déjà posé — `coalesce`/garde) et **non bloquantes** (un échec de pose de signal ne casse pas la navigation — warn-log). Lecture `pack_entries` scope résidence (RLS 3.1). `pnpm typecheck`/`lint`/`test` verts ; tests bannière (présence conditionnée au lifecycle) + actions (pose idempotente).

## Tasks / Subtasks

- [x] **Task 1 — Lecture du lifecycle utilisateur** (AC: 1, 3)
  - [ ] `lib/auth/current-user.ts` (ou data layer home) : helper `fetchOnboardingState()` → client session, `select first_login_at, pack_accueil_dismissed_at from users where id = auth.uid() .single()`. Retour `{ showPackBanner: boolean }` = `first_login_at === null && pack_accueil_dismissed_at === null`. `cache()`.
  - [ ] Réutiliser le client session (`lib/supabase/server.ts`) ; ne pas re-fetcher l'auth (`requireResident` du layout l'a déjà validée — passer l'`user.id`).

- [x] **Task 2 — Bannière Pack sur la home** (AC: 1, 3, 5)
  - [ ] `app/[locale]/community/page.tsx` : après le titre/tuiles (préserver l'existant + tuiles 3.2/3.3), si `showPackBanner` → rendre `<PackBanner />`. La home est déjà `force-dynamic`.
  - [ ] `app/[locale]/community/_components/pack-banner.tsx` (`'use client'` pour le dismiss) : carte proéminente (accent `bg-soft`/bordure accent), titre i18n « Bienvenue ! Découvre le Pack accueil », CTA `<Link>` vers `/community/guide/pack-accueil` (cible ≥ 48px), bouton « Plus tard » + « ✕ » qui appellent l'action dismiss (Task 4). a11y : `role="region" aria-label`, ✕ avec `aria-label`, focusable, **Escape** ferme (= dismiss ou simple masquage local + action). Optimistic : masquer localement au tap puis `dismissPackBanner()` en arrière-plan (geste WhatsApp, NFR40b).
  - [ ] **Décision overlay vs bannière** : bannière in-page (pas overlay plein écran/modal — modales bannies MVP, spec UX). L'épic dit « bannière/overlay » → choisir **bannière** (D3).

- [x] **Task 3 — Page Pack accueil (route statique)** (AC: 2, 4, 5)
  - [ ] `app/[locale]/community/guide/pack-accueil/page.tsx` (RSC, `force-dynamic`, `generateMetadata` titre i18n). Segment **statique** sœur de `guide/[slug]` (prime dessus). `<AppHeader>` (retour) + intro.
  - [ ] `app/[locale]/community/guide/pack-accueil/data.ts` : `fetchPackEntries(locale)` → `select section_key, title_fr, title_ar, body_fr_markdown, body_ar_markdown, order_in_section from pack_entries where deleted_at is null order by section_key, order_in_section` (RLS scope résidence). Mappe locale + fallback FR (+ flag `untranslated`, badge « Non traduit » via clé partagée `community.guide.notTranslatedBadge`). Grouper par `section_key` (ordre = ordre d'apparition / `min(order_in_section)` par section ; `section_key` est `text` libre, 3.1 D3).
  - [ ] `_components/pack-section.tsx` : `<details>` par section (clavier gratuit), titre = `section_key` rendu lisible (ou via map i18n optionnelle si sections canoniques), entrées rendues via `<MarkdownRender>` (composant partagé 3.2). **Deep-links Guide** : les liens markdown `[texte](/community/guide/<slug>)` dans le corps pointent vers les entrées Guide (résolus par le renderer ; les co_mods saisissent ces liens en 3.5).
  - [ ] À la **fin de lecture** : marquer `first_login_at`. Pattern : un `<MarkOnboardingComplete />` client (effet `useEffect` au mount de la page Pack OU au unmount/`beforeunload`) qui appelle `completeOnboarding()` (Task 4) **une seule fois**. Simpler & fiable : appeler au **mount** de la page Pack (« je suis entré dans le pack = onboarding amorcé/complété ») — l'épic dit « quand je ferme la page » mais le mount est plus robuste que `beforeunload` (peu fiable mobile). Documenter ce choix (D4).
  - [ ] `loading.tsx` skeleton.

- [x] **Task 4 — Server Actions lifecycle** (AC: 3, 4, 6)
  - [ ] `app/[locale]/community/_actions/onboarding.ts` (`'use server'`) : `dismissPackBanner()` et `completeOnboarding()`.
  - [ ] `dismissPackBanner` : `requireResident()` ; `update users set pack_accueil_dismissed_at = now() where id = auth.uid() and pack_accueil_dismissed_at is null` (garde idempotente — ne réécrit pas). Client **session** (grant self). `revalidatePath('/[locale]/community')`. Échec → warn-log, retour silencieux (non bloquant — AC6).
  - [ ] `completeOnboarding` : idem avec `first_login_at` (`where … and first_login_at is null`). Pose **aussi** `pack_accueil_dismissed_at` si encore null (lire le pack vaut dismiss de la bannière — cohérent D2). `revalidatePath('/[locale]/community')`.
  - [ ] **Aucune** écriture admin ; **aucune** colonne hors `first_login_at`/`pack_accueil_dismissed_at`/`updated_at` (grants self).
  - [ ] Tests node (`// @vitest-environment node`, mocks `requireResident` + `createClient` chaîné + logger, calquer `tests/profil/profile-actions.test.ts`) : pose si null, no-op si déjà posé, échec DB → warn sans throw.

- [x] **Task 5 — i18n `community.packAccueil`** (AC: 1, 2, 5)
  - [ ] `messages/fr.json` namespace `community.packAccueil` : `banner.title` (« Bienvenue à Darna ! »), `banner.body` (« Un aperçu de 10 minutes pour tout savoir sur la résidence. »), `banner.cta` (« Découvrir le Pack accueil »), `banner.later` (« Plus tard »), `banner.dismiss` (aria « Fermer »), `title` (« Pack accueil »), `intro`, `entry.guideLink` (« Voir dans le Guide »). Réutiliser `community.guide.notTranslatedBadge`. Tonalité chaleureuse, tutoiement.
  - [ ] `messages/ar.json` : stub parallèle.

- [x] **Task 6 — Cache offline** (AC: lecture pack hors-ligne, FR45)
  - [ ] `sw/index.ts` : élargir le matcher `durable-content` (3.2/3.3) à `/community/guide/pack-accueil`. La home (`/community`) reste navigation-cached ; la **bannière** dépend du lifecycle serveur → pas critique offline.

- [x] **Task 7 — Tests** (AC: 1, 3, 4)
  - [ ] `tests/pack/pack-banner.test.tsx` (jsdom) : bannière rendue si `showPackBanner=true`, absente sinon ; tap « ✕ » masque + appelle l'action (mock).
  - [ ] `tests/pack/pack-page.test.tsx` : sections dépliables, deep-links Guide rendus, badge « Non traduit » si AR absent.
  - [ ] `tests/pack/onboarding-actions.test.ts` (Task 4) : idempotence + non-blocage.
  - [ ] `tests/rls.test.ts` : un résident ne peut UPDATE `first_login_at` que sur **sa** ligne (`id=auth.uid()`) — tentative sur autrui → `42501`/0 ligne (réutiliser seeds users existants).

## Dev Notes

> **Stack & conventions** : identiques 3.2/3.3 (Next.js 16 RSC + Server Actions, Supabase session-client + RLS, next-intl, Vitest). 3.4 = onboarding **applicatif** : 0 migration, réutilise colonnes lifecycle (1.3) + renderer markdown (3.2) + schéma pack (3.1).

### §Décisions (points tranchés)

1. **D1 — Aucune migration.** `users.first_login_at` / `pack_accueil_dismissed_at` (nullable `timestamptz`) ont été ajoutées en **1.3** précisément pour 3.4 (cf. epics.md l.522 : « used by Story 3.4 … without requiring a later ALTER TABLE ») et sont grantées en UPDATE self (`init_rls` `users_resident_update_self`). `pack_entries` existe (3.1). [tranché]
2. **D2 — Sémantique des 2 signaux.** `pack_accueil_dismissed_at` = « j'ai écarté la **bannière** » ; `first_login_at` = « j'ai **consommé** le Pack (onboarding complété) ». La bannière s'affiche ssi **les deux** sont null (`showPackBanner = first_login_at===null && dismissed_at===null`). Lire le pack pose `first_login_at` **et** `dismissed_at` (consommer vaut écarter). Fermer la bannière pose seulement `dismissed_at` (le Pack reste accessible, AC3). [tranché]
3. **D3 — Bannière, pas overlay modal.** L'épic dit « bannière/overlay plein écran » ; les modales/overlays plein écran sont bannis MVP (spec UX). → **bannière in-page** proéminente sur la home. [tranché]
4. **D4 — `first_login_at` posé au mount de la page Pack, pas au `beforeunload`.** L'épic dit « quand je ferme la page » mais `beforeunload`/`visibilitychange` est non fiable sur mobile (le cœur de cible). Poser au **mount** (« entrer dans le Pack = onboarding amorcé ») est robuste et idempotent. Si on veut être fidèle au « fin de lecture », alternative : poser au scroll-bottom ou après N secondes — mais le mount suffit au signal métier (ne plus re-pousser la bannière). [tranché — documenter dans Completion Notes si on dévie]
5. **D5 — `section_key` = `text` libre (3.1 D3).** Les sections du Pack ne sont pas un enum ; le tri/regroupement suit `order_in_section` et l'ordre d'apparition des `section_key`. Pas de map i18n obligatoire pour les libellés de section (les titres viennent des `pack_entries`). [tranché]

### §Sécurité (NFR21 / AR17)

- **Écriture self uniquement** : RLS `users_resident_update_self` (`id = auth.uid()`) + grant colonne `update(display_name, first_login_at, pack_accueil_dismissed_at, updated_at)` (init_rls) → un résident ne pose ces signaux que sur sa propre ligne. Jamais `createAdminClient`.
- **Idempotence** : `where … is null` empêche l'écrasement d'un timestamp (un re-tap ne « rajeunit » pas l'onboarding). Évite aussi des writes inutiles.
- **Non-blocage** : la pose d'un signal est un effet de bord d'UX ; un échec DB ne doit pas casser la navigation → `try/catch` + warn-log (pattern 2.4 D1 sur `identity_mode`).
- **Lecture pack** : RLS `pack_entries_resident_select_residence` (3.1) scope la résidence.

### §Réutilisation directe (ne PAS réinventer)

- **Colonnes lifecycle** : `users.first_login_at` / `pack_accueil_dismissed_at` (`20260524005559_init_schema.sql` l.35-37) + grant UPDATE self (`20260524005600_init_rls.sql`, `users_resident_update_self`).
- **Schéma pack** : `supabase/migrations/20260623090000_durable_content_schema.sql` (3.1) — `pack_entries`, RLS résident.
- **Renderer Markdown** : `components/content/markdown-render.tsx` (3.2, XSS-safe).
- **Server Action template** : `app/[locale]/community/profil/actions.ts` (garde `requireResident`, update self, revalidate, warn-log non bloquant) ; tests `tests/profil/profile-actions.test.ts`.
- **UI** : `<PageContainer>`, `<AppHeader>`, `<details>` sections (pattern 3.2), `<Link>` CTA.
- **i18n** : `community.guide.notTranslatedBadge` (partagé fallback FR48).
- **SW** : matcher `durable-content` (3.2/3.3) à élargir.

### §Gotchas (appris des stories 1.x / 2.4 / 3.2)

- `beforeunload` non fiable mobile → poser `first_login_at` au mount (D4).
- Écriture non bloquante : ne jamais `throw` depuis la pose de signal (warn-log), sinon la home/le pack plantent.
- Serwist KO sous Turbopack dev → offline en `dev:webpack`.
- `ar.json` parallèle même en stub.
- La home `page.tsx` est touchée par 3.2 (tuile Guide), 3.3 (tuile Numéros) **et** 3.4 (bannière) — préserver les ajouts amont (ordre de dev : 3.2 → 3.3 → 3.4).
- `<details>` natif = clavier + Escape gratuits (NFR37).

### Project Structure Notes

- **NEW** : `app/[locale]/community/guide/pack-accueil/{page,data,loading}.tsx` + `_components/pack-section.tsx` ; `app/[locale]/community/_components/pack-banner.tsx` ; `app/[locale]/community/_actions/onboarding.ts` ; helper `fetchOnboardingState` ; `tests/pack/*`.
- **UPDATE** : `app/[locale]/community/page.tsx` (bannière conditionnelle), `sw/index.ts` (matcher pack-accueil), `messages/{fr,ar}.json` (`community.packAccueil`).
- **AUCUNE** migration, **AUCUN** `gen:types`.

### References

- [Source: epics.md#Story-3.4] — AC verbatim (l.1220-1246), FR25 ; Story 1.3 note lifecycle (l.522).
- [Source: prd.md] — FR25 (l.918), FR45 (l.958), FR48 (l.961), NFR37 (l.1025), NFR40 (l.1028), NFR45 (l.1037), Journey 3 Salma/pack accueil (l.1072).
- [Source: architecture.md] — onboarding/pack accueil (Journey 3, l.1072 prd ; module contenu durable l.32), `app/(community)/guide/` (l.853).
- [Source: 3-1-…schema-contenu-durable…md] — `pack_entries`, RLS, `section_key` text (D3).
- [Source: 3-2-…guide…md] — renderer markdown partagé, route `pack-accueil` statique sœur (D4), matcher SW.
- [Source: supabase/migrations/20260524005559_init_schema.sql] — `first_login_at`/`pack_accueil_dismissed_at` (l.35-37).
- [Source: supabase/migrations/20260524005600_init_rls.sql] — `users_resident_update_self` + grant colonnes (l.~64-77).
- [Source: app/[locale]/community/profil/actions.ts] — template Server Action update self non bloquant.
- [Source: app/[locale]/community/page.tsx] — home (placeholder `force-dynamic`, à enrichir).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev autonome Epic 3, 2026-06-20).

### Debug Log References

- Aucune migration (D1 — colonnes lifecycle 1.3 + grant UPDATE self confirmés dans `init_rls` : `grant update (display_name, first_login_at, pack_accueil_dismissed_at, updated_at)`). `pnpm typecheck` ✅, `pnpm lint` ✅ (0 erreur), `pnpm test` → 360 passed (pack-banner + pack-page + onboarding-actions node), `pnpm test:rls` → block Epic 3 **10/10 verts** (test j onboarding self ; 1 échec pré-existant `moderation_log` hors-périmètre).

### Completion Notes List

- **Aucune migration** : `users.first_login_at`/`pack_accueil_dismissed_at` (1.3) + `pack_entries` (3.1) réutilisés.
- **Sémantique 2 signaux (D2)** : `showPackBanner = first_login_at===null && pack_accueil_dismissed_at===null`. `dismissPackBanner` pose seulement `pack_accueil_dismissed_at` ; `completeOnboarding` pose `first_login_at` ET `pack_accueil_dismissed_at` (consommer vaut écarter). Actions **idempotentes** (garde `.is(col, null)`) et **non bloquantes** (échec → `warn` log, jamais throw — prouvé en test node).
- **`first_login_at` au mount (D4)** : `<MarkOnboardingComplete>` pose le signal à l'entrée du Pack (`beforeunload` non fiable mobile). Ref-guard contre le double-mount StrictMode.
- **Bannière in-page (D3)**, pas overlay/modal. Optimistic dismiss (masquage local + action en arrière-plan). a11y : `role="region"`, ✕ `aria-label`, **Escape** ferme, CTA ≥ touch.
- **Route `pack-accueil` statique** sœur de `guide/[slug]` (segment statique prioritaire) ; réutilise `<MarkdownRender>` (3.2) → les deep-links Guide markdown `[texte](/community/guide/<slug>)` sont rendus (testé).
- SW : `guide/pack-accueil` est sous `/community/guide` → **déjà** couvert par le matcher `durable-content` (3.2), aucune modif SW.
- Écriture **self uniquement** via client session (`users_resident_update_self`, `id=auth.uid()`) — test RLS (j) prouve qu'un résident ne pose `first_login_at` que sur SA ligne (0 ligne sur autrui).
- i18n `community.packAccueil` (fr) ; `ar.json` stub parallèle.

### File List

- **NEW** `app/[locale]/community/_data/onboarding.ts` (`fetchOnboardingState`)
- **NEW** `app/[locale]/community/_actions/onboarding.ts` (`dismissPackBanner`, `completeOnboarding`)
- **NEW** `app/[locale]/community/_components/pack-banner.tsx`
- **NEW** `app/[locale]/community/guide/pack-accueil/{page,data,loading}.tsx` + `_components/{pack-section,mark-onboarding-complete}.tsx`
- **NEW** `tests/pack/{pack-banner.test.tsx,pack-page.test.tsx,onboarding-actions.test.ts}`
- **UPDATE** `app/[locale]/community/page.tsx` (bannière conditionnelle), `messages/{fr,ar}.json` (`community.packAccueil`), `tests/rls.test.ts` (test j)

### Change Log

| Date       | Version | Description                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-19 | 0.1     | Création story 3.4 (context engine). Onboarding Pack accueil : bannière home conditionnée au lifecycle `users` (first_login_at / pack_accueil_dismissed_at, posés via Server Actions session idempotentes non bloquantes), page Pack route statique lisant `pack_entries` (sections dépliables + deep-links Guide + renderer markdown 3.2), cache offline, i18n, tests. Aucune migration (colonnes 1.3 réutilisées). Status → ready-for-dev. |

### Review Findings

> Code review adversariale (Blind / Edge / Acceptance) — 2026-06-20. 2 patch, 4 defer. Sécurité OK (écriture session client, idempotence guards, non-bloquant, RLS self-only testée ; markdown `skipHtml` = pas de XSS).

- [x] [Review][Patch] Ordre des sections alphabétique au lieu de l'ordre d'apparition (D5) — `data.ts` trie `.order('section_key')` puis `order_in_section` → sections rendues par ordre alphabétique de `section_key` (texte libre). Spec D5/AC2 : « le tri/regroupement suit `order_in_section` et l'ordre d'apparition des `section_key` » (l'exemple AC2 n'est pas alphabétique). Fix : trier les sections par `min(order_in_section)` (requête ordonnée par order puis regroupement first-seen). [`app/[locale]/community/guide/pack-accueil/data.ts:40`]
- [x] [Review][Patch] `completeOnboarding` se déclenche au mount même si la page Pack a échoué/est vide → l'onboarding est marqué complet (bannière disparue à jamais) sans que le résident ait vu le contenu. Fix : ne rendre `<MarkOnboardingComplete>` que si `sections.length > 0`. [`app/[locale]/community/guide/pack-accueil/_components/mark-onboarding-complete.tsx:14`]
- [x] [Review][Defer] `completeOnboarding` écrase `pack_accueil_dismissed_at` (guard sur `first_login_at is null` seulement) → perd l'horodatage d'un dismiss antérieur. Bénin (déjà masquée). [`app/[locale]/community/_actions/onboarding.ts`] — deferred, sémantique timestamp
- [x] [Review][Defer] `revalidatePath('/[locale]/community')` omis des 2 Server Actions (Task 4 explicite). Fonctionnellement OK (`fetchOnboardingState` force-dynamic re-lit à la navigation). [`app/[locale]/community/_actions/onboarding.ts`] — deferred, pattern-cohérent
- [x] [Review][Defer] Deep-link Guide dans le markdown du pack non validé (slug supprimé/renommé → lien mort). [`pack-section.tsx` via MarkdownRender] — deferred, à câbler avec validation CRUD 3.5
- [x] [Review][Defer] **Systémique (hors 3.4)** : un résident dont le JWT n'a pas encore les claims `residence_id`/`role` voit un Pack vide « en préparation » (RLS `auth_residence_id()` null → 0 rows). Affecte toutes les lectures RLS Epic 2/3, pas juste le pack. À vérifier que les claims sont bien posés au login (1.6). [`data.ts` + RLS] — deferred, escalade auth/claims
