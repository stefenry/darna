# Story 3.2: Guide résident — lecture + recherche + deep linking par entrée

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> ⚠️ **3 points structurants** (détaillés en Dev Notes) : (1) **Lecture seule sur schéma 3.1** — `guide_entries`, ses enums (`guide_theme_key`), RLS résident-lecture et colonnes FTS `search_fr_tsv`/`search_ar_tsv` **existent** (3.1) ; 3.2 ne crée **qu'un** RPC de recherche (`ts_headline`) en migration, le reste est UI RSC + data layer (pattern annuaire 2.2/fiche 2.3). (2) **Renderer Markdown introuvable dans le repo** → 3.2 **ajoute** `react-markdown` + `remark-gfm` (sans `rehype-raw` → pas de HTML brut, XSS-safe) et crée le composant partagé `markdown-render.tsx` réutilisé par le Pack (3.4) et la preview co_mod (3.5). (3) **Route `pack-accueil` est statique** : `community/guide/pack-accueil/` (3.4) prime sur `community/guide/[slug]/` (Next.js : segment statique > dynamique) — ne pas créer d'entrée `guide_entries` de slug `pack-accueil`.

## Story

As a **résident (Aïcha — Journey 2)**,
I want **parcourir le Guide comme une FAQ structurée dans ma langue, le rechercher, et ouvrir n'importe quelle entrée directement par deep link**,
so that **je trouve une info pratique (ex. le code du portail) sans demander à personne, en moins de 22 secondes**.

Story de **consultation** : elle pose le chemin de lecture par-dessus le schéma 3.1. Le **CRUD co_mod** qui alimente le Guide relève de 3.5 ; 3.2 lit des `guide_entries` (seedées manuellement / via 3.5). Elle établit la **route canonique deep-link** (`/community/guide/[slug]`) cible de l'Epic 6, le **fallback FR** (FR48) et le **renderer Markdown** réutilisés par 3.4/3.5.

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 3.2 » (l. 1156-1190). FR23/FR36-setup/FR45-setup/FR48, NFR7/NFR8/NFR35/NFR40. Précisions techniques (RPC `ts_headline`, renderer markdown, cache SW) en Dev Notes — elles priment.

1. **AC1 — Liste groupée par thème.** Étant donné que je suis authentifié `resident` et j'ouvre `/community/guide`, quand la page rend, alors je vois les entrées **groupées par thème** (Codes portails / Horaires gardien / Règles jardin / Déchets / Traditions / Sécurité / Autre), chaque thème **dépliable**, entrées dans ma locale, triées par `order_in_theme`. (FR23)
2. **AC2 — Recherche FTS classée.** Étant donné que je tape une requête et soumets, quand les résultats rendent, alors ils s'affichent **tous thèmes confondus, classés par pertinence FTS** (`ts_rank`), avec **snippet de l'extrait correspondant surligné** (`ts_headline`). (NFR7)
3. **AC3 — Deep link par entrée.** Étant donné que j'ouvre `/community/guide/[slug]` (deep link WhatsApp / e-mail / partage), quand la page rend, alors je vois le **titre + corps Markdown rendu** dans ma locale, avec **fil d'Ariane** retour au thème ; l'URL est la **cible canonique** du deep-link Epic 6. (FR23, FR36-setup)
4. **AC4 — Fallback FR explicite.** Étant donné qu'une entrée a un corps FR mais pas AR, quand je la consulte en mode AR, alors le **fallback FR** rend avec un **badge « Non traduit »**. (FR48)
5. **AC5 — Lecture offline.** Étant donné que j'ai ouvert le Guide une fois en ligne, quand j'y reviens **hors-ligne**, alors toutes les entrées rendent depuis le cache Serwist en **< 100 ms**. (NFR8, FR45-setup)
6. **AC6 — Benchmark Aïcha (Journey 2).** Étant donné que je suis Aïcha, quand j'ouvre `/guide`, tape un thème puis « Quels sont les codes des portails ? », alors je lis la réponse en **≤ 22 s** depuis le déverrouillage. (NFR40)
7. **AC7 — a11y.** Et la page passe le scan axe-core (contraste ≥ 4.5:1, font ≥ 16px, focus visible) ; les `<details>`/accordéons sont opérables au clavier ; RTL-correct en AR. (NFR35, NFR37, NFR45)

### AC additionnel (régression — obligatoire)

8. **AC8 — Sécurité + Markdown sûr + tests verts.** Lecture via **client session** uniquement (RLS `guide_entries_resident_select_residence` = enforcement) ; aucune fuite cross-résidence. Markdown rendu **sans HTML brut** (`react-markdown` sans `rehype-raw`, `skipHtml`) — un `body_*_markdown` contenant `<script>`/`<img onerror>` est **inerte** (anti-XSS, AR17). RPC recherche `security invoker` (hérite RLS du caller, jamais `definer`). `slug` introuvable dans ma résidence → `notFound()` (404, pas de fuite d'existence cross-tenant). `pnpm typecheck`/`lint`/`test` verts ; test rendu liste/entrée + test renderer markdown (script inerte).

## Tasks / Subtasks

- [x] **Task 1 — Dépendance + renderer Markdown partagé** (AC: 3, 8)
  - [ ] `pnpm add react-markdown remark-gfm` (versions stables compat React 19 / Next 16). **Ne pas** ajouter `rehype-raw`/`rehype-sanitize` (on n'autorise aucun HTML brut → pas de surface XSS à sanitiser).
  - [ ] `components/content/markdown-render.tsx` (RSC-compatible, pas de `'use client'`) : `<Markdown remarkPlugins={[remarkGfm]} skipHtml components={{…}}>{source}</Markdown>`. `components` mappe titres/listes/liens/`<a target>` aux tokens borderless v2 (prose sobre, liens `accent-600`, pas de `prose` Tailwind si non installé → classes utilitaires). Liens externes `rel="noopener noreferrer"`. Placer en `components/content/` (partagé Guide + Pack + preview co_mod, pas sous une route).
  - [ ] `components/content/markdown-render.test.tsx` : rend titres/listes/liens ; **`<script>alert(1)</script>` et `<img src=x onerror=…>` n'apparaissent pas dans le DOM** (skipHtml) ; un lien `[x](https://…)` a `rel="noopener noreferrer"`.

- [x] **Task 2 — Migration : RPC recherche `search_guide_entries`** (AC: 2, 8)
  - [ ] `supabase/migrations/20260623100000_guide_search_rpc.sql` (timestamp > 3.1). `create function public.search_guide_entries(p_query text, p_locale text) returns table(slug text, theme_key public.guide_theme_key, title text, snippet text, rank real) language sql stable security invoker set search_path = public as $$ … $$;`
  - [ ] Corps : `websearch_to_tsquery(<config>, p_query)` (config `french` si `p_locale='fr'`, sinon `simple`) sur `search_fr_tsv`/`search_ar_tsv` ; `ts_rank` pour le tri ; `ts_headline(<config>, coalesce(title_<loc>,title_fr) || ' — ' || coalesce(body_<loc>_markdown, body_fr_markdown), query, 'StartSel=<mark>,StopSel=</mark>,MaxFragments=1,MinWords=5,MaxWords=20')` pour le snippet ; `title` = `coalesce(title_<loc>, title_fr)` (fallback FR, FR48). `where deleted_at is null` (RLS scope déjà la résidence — **security invoker** = la policy résident s'applique). `order by rank desc limit 30`. Pas de `residence_id` en paramètre (RLS le déduit du JWT).
  - [ ] Empêcher l'injection de syntaxe tsquery : `websearch_to_tsquery` est sûr par construction (pas de parse d'opérateurs). Sanitiser la longueur côté data layer (réutiliser `sanitizeQuery`).

- [x] **Task 3 — Data layer Guide (liste + recherche)** (AC: 1, 2, 4, 8)
  - [ ] `app/[locale]/community/guide/data.ts` : `fetchGuideEntries(locale)` → client session, `select slug, theme_key, title_fr, title_ar, order_in_theme from guide_entries where deleted_at is null order by theme_key, order_in_theme` (RLS scope résidence), mappe `title = locale==='ar' ? (title_ar ?? title_fr) : title_fr` + flag `untranslated = locale==='ar' && !title_ar`. Grouper par `theme_key` (objet ordonné suivant l'ordre enum canonique défini en const). `cache()` comme `data.ts` annuaire.
  - [ ] `searchGuide(locale, rawQuery)` → `sanitizeQuery` (réutiliser `lib/search/fts.ts`) ; si `!hasQuery` → `[]` ; sinon `supabase.rpc('search_guide_entries', { p_query, p_locale: locale })`. Retour typé `{ slug, themeKey, title, snippet, rank }[]`.
  - [ ] Const `GUIDE_THEME_ORDER` (ordre d'affichage des thèmes) dans `lib/content/guide.ts` (réutilisable liste + co_mod 3.5).

- [x] **Task 4 — Data layer entrée (deep link)** (AC: 3, 4, 8)
  - [ ] `app/[locale]/community/guide/[slug]/data.ts` : `fetchGuideEntryBySlug(locale, slug)` (pattern `cache(_fetch…)` de la fiche artisan l.69) → `select * from guide_entries where slug = ? and deleted_at is null .maybeSingle()` (RLS scope résidence → un slug d'une autre résidence renvoie `null`). Retour discriminé `{ kind:'found', entry, body, title, untranslated } | { kind:'not-found' }`. `body = locale==='ar' ? (body_ar_markdown ?? body_fr_markdown) : body_fr_markdown` ; `untranslated = locale==='ar' && !body_ar_markdown`.

- [x] **Task 5 — Page liste `/community/guide`** (AC: 1, 2, 7)
  - [ ] `app/[locale]/community/guide/page.tsx` (RSC, `export const dynamic = 'force-dynamic'`, `generateMetadata` titre Guide). Lit `searchParams.q` ; si `q` présent → branche recherche (`searchGuide`) sinon liste groupée (`fetchGuideEntries`). `setRequestLocale`. `<AppHeader>`/titre + intro i18n.
  - [ ] `_components/guide-search.tsx` (`'use client'`) : input qui met à jour l'URL `?q=` (debounce ; pattern `search-input.tsx` annuaire). a11y : `role="search"`, label i18n.
  - [ ] `_components/guide-theme-section.tsx` : `<details>` natif (clavier gratuit, NFR37) par thème, `<summary>` = libellé i18n `community.guide.themes.<key>` + count, liste de `<Link href=…/guide/[slug]>` (titre + badge « Non traduit » si `untranslated`).
  - [ ] `_components/guide-search-results.tsx` : liste plate classée, chaque item = `<Link>` titre + snippet (le `<mark>` du `ts_headline` rendu via `dangerouslySetInnerHTML` **uniquement** sur la sortie `ts_headline` — déjà échappée par Postgres sauf les balises `<mark>` que l'on a définies ; sécuriser : `ts_headline` HTML-échappe le contenu, seules nos `<mark>` passent → sûr. **Documenter** ce point en commentaire). État vide « Aucun résultat » (i18n).
  - [ ] `loading.tsx` (skeleton thèmes, pas spinner — AR21), `error.tsx` (pattern annuaire).

- [x] **Task 6 — Page entrée `/community/guide/[slug]`** (AC: 3, 4, 7, 8)
  - [ ] `app/[locale]/community/guide/[slug]/page.tsx` (RSC, `force-dynamic`). `fetchGuideEntryBySlug` ; `kind==='not-found'` → `notFound()`. Rend `<AppHeader>` (chevron retour) + **fil d'Ariane** « Guide › {thème i18n} » (`<Link>` vers `/guide` ancré thème — ou simple lien `/guide`) + `<h1>` titre + badge « Non traduit » (AC4) + `<MarkdownRender source={body} />`. `generateMetadata` titre = titre entrée (cache la lecture).
  - [ ] `loading.tsx` skeleton.
  - [ ] **Préserver** : ne pas exposer `body_*_markdown` brut dans le HTML hors du renderer ; pas d'`<a>` vers une autre résidence (slugs scoping RLS).

- [x] **Task 7 — Cache offline Serwist** (AC: 5)
  - [ ] `sw/index.ts` : ajouter une `RuntimeCaching` `durable-content` (StaleWhileRevalidate, `ExpirationPlugin` maxAge 24h, maxEntries ~64) matchant les navigations `/[locale]/community/guide` et `/community/guide/*` **et** leurs payloads RSC (`?_rsc=`), partitionnée par résidence si nécessaire via cookie/locale (s'aligner sur le pattern `annuaireCache` l.32-48, mais StaleWhileRevalidate car contenu éditorial moins volatil). Le `cacheOnNavigation` global est déjà actif (next.config) ; cette règle garantit le **< 100 ms** offline (AC5).
  - [ ] Vérifier en `dev:webpack` (Serwist KO sous Turbopack — architecture l.142/203).

- [x] **Task 8 — i18n `community.guide`** (AC: 1, 2, 4, 7)
  - [ ] `messages/fr.json` namespace `community.guide` : `title` (« Guide de la résidence »), `intro`, `search.label`/`search.placeholder` (« code portail, gardien… »), `themes.{codes_portails,horaires_gardien,regles_jardin,dechets,traditions,securite,autre}` (libellés FR), `notTranslatedBadge` (« Non traduit »), `breadcrumb` (« Guide »), `searchResults.empty`, `searchResults.title`, `count` (`{n, plural, …}`), `entry.back`. Tonalité : tutoiement, pas de jargon.
  - [ ] Ajouter une **tuile Guide** sur la home : `community.home` (ou `community.nav`) clé `tiles.guide` + lien dans `app/[locale]/community/page.tsx` (le placeholder actuel n'a pas de tuiles — **préserver** le titre/body existants, ajouter une grille de tuiles ; 3.3 ajoutera la tuile Numéros, 3.4 la bannière Pack).
  - [ ] `messages/ar.json` : mêmes clés en **stub** (structure parallèle, MVP FR-only, AR différé V1.5).

- [x] **Task 9 — Tests** (AC: 1, 3, 4, 8)
  - [ ] `tests/guide/guide-list.test.tsx` (jsdom, `<NextIntlClientProvider>`) : rendu thèmes dépliables + badge « Non traduit » sur entrée AR sans `title_ar` (mock data layer).
  - [ ] `tests/guide/guide-entry.test.tsx` : rend titre + markdown ; `notFound` si data layer renvoie `not-found`.
  - [ ] `markdown-render.test.tsx` (Task 1) : script inerte.
  - [ ] `tests/rls.test.ts` : étendre — RPC `search_guide_entries` appelé par un résident d'une **autre** résidence ne retourne **pas** l'entrée seedée (security invoker = RLS appliqué).

## Dev Notes

> **Stack & conventions** : identiques 2.2-2.6 (Next.js 16 App Router RSC + Server Actions, Supabase session-client + RLS, next-intl, Zod, Vitest jsdom). 3.2 = story **applicative de lecture** sur le schéma 3.1, + 1 RPC + 1 dépendance markdown.

### §Décisions (points tranchés)

1. **D1 — `react-markdown` + `remark-gfm`, sans HTML brut.** Le repo n'a aucun renderer markdown (vérifié : pas de `remark`/`marked`/`rehype` en deps). On ajoute `react-markdown` (`skipHtml`, pas de `rehype-raw`) → tout HTML inline d'un `body_*_markdown` est **ignoré**, pas rendu : surface XSS nulle sans sanitiseur. L'architecture prévoyait `markdown-render.tsx` (l.861) — on le matérialise en `components/content/` (partagé, pas sous route). [tranché — gap « renderer markdown »]
2. **D2 — Recherche via RPC `security invoker`, pas `.textSearch()` direct.** Annuaire (2.2) faisait `.textSearch().order('created_at')` sans `ts_rank` ni snippet. L'épic 3.2 exige **classement par pertinence** (`ts_rank`) **et** snippet surligné (`ts_headline`) — impossibles via PostgREST seul. D'où un RPC SQL `security invoker` (hérite la RLS du résident appelant ; **jamais** `definer` qui bypasserait le tenant). [tranché]
3. **D3 — Snippet `ts_headline` : `<mark>` sûr.** `ts_headline` HTML-échappe le texte source et n'insère que les délimiteurs qu'on lui donne (`StartSel=<mark>`). On rend donc le snippet via `dangerouslySetInnerHTML` en sachant que seul `<mark>` est injecté et le reste est échappé par Postgres. Commenter ce raisonnement au point d'usage (revue sécurité). [tranché]
4. **D4 — `pack-accueil` est une route statique sœur.** `community/guide/pack-accueil/` (3.4) coexiste avec `community/guide/[slug]/` — Next.js route le segment statique en priorité. **Ne pas** créer d'entrée `guide_entries` nommée `pack-accueil` (collision conceptuelle). Le data layer `[slug]` ne sera jamais appelé avec `pack-accueil`. [tranché]
5. **D5 — Fil d'Ariane minimal.** « Guide › {thème} » suffit (pas de hiérarchie profonde). Lien retour `/guide` (ancrage thème optionnel via `#`). [tranché]
6. **D6 — Pas de pagination liste.** Le Guide d'une résidence est petit (dizaines d'entrées) → liste complète groupée, pas de `hasMore`. La recherche limite à 30 (RPC). [tranché]

### §Sécurité (NFR21 / AR17)

- **Lecture client session uniquement** : RLS `guide_entries_resident_select_residence` (3.1) scope la résidence et exclut `deleted_at`. Jamais de `createAdminClient` en lecture.
- **RPC `security invoker`** : le tri/headline s'exécute avec les droits du résident → RLS appliquée, aucune fuite cross-résidence. Tester explicitement (Task 9).
- **Markdown** : `skipHtml` + pas de `rehype-raw` → `<script>`/`onerror` inertes. Liens `rel="noopener noreferrer"`.
- **404 plutôt que 403** sur slug cross-tenant : `maybeSingle()` renvoie `null` (RLS filtre) → `notFound()`, on ne révèle pas l'existence d'une entrée d'une autre résidence.

### §Réutilisation directe (ne PAS réinventer)

- **Schéma** : `supabase/migrations/20260623090000_durable_content_schema.sql` (3.1) — `guide_entries`, `guide_theme_key`, RLS résident, `search_fr_tsv`/`search_ar_tsv`.
- **Data layer template** : `app/[locale]/community/annuaire/data.ts` (`cache()`, RLS-scopé, `force-dynamic`) ; `app/[locale]/community/artisan/[slug]/data.ts` (pattern `cache(_fetch…)`, retour discriminé `found`/`not-found`, l.69-118).
- **Recherche** : `lib/search/fts.ts` (`sanitizeQuery`, `hasQuery`, `MAX_QUERY_LENGTH`).
- **UI** : `<PageContainer>` (`components/layout/page-container.tsx`), `<AppHeader>`, `search-input.tsx` (annuaire `_components`), skeletons `loading.tsx` annuaire/fiche.
- **i18n** : `getTranslations` (RSC) / `useTranslations` (client) ; namespace `community.*` existant comme modèle.
- **SW** : `sw/index.ts` `annuaireCache` (l.32-48) comme modèle de `RuntimeCaching` + `ExpirationPlugin`.

### §Gotchas (appris des stories 2.2-2.6)

- Serwist KO sous Turbopack en dev → tester l'offline en `pnpm dev:webpack` (architecture l.142/203).
- PostgREST sérialise `numeric`/`real` en **strings** → si on lit `rank`, coercer (mais `rank` sert au tri serveur, peu exposé).
- `useActionState`/flux client post-submit ne s'exécute pas proprement en jsdom → tests de **rendu** seulement.
- `ar.json` reste structurellement parallèle même en stub.
- Le `<details>` natif est clavier-accessible gratuitement (préférer à un accordéon JS — NFR37).
- `ts_headline` peut être coûteux : limité par `MaxFragments=1` + `limit 30` sur le RPC.

### Project Structure Notes

- **NEW** : `supabase/migrations/20260623100000_guide_search_rpc.sql` ; `components/content/markdown-render.tsx` (+ `.test.tsx`) ; `lib/content/guide.ts` (const `GUIDE_THEME_ORDER`) ; `app/[locale]/community/guide/{page,data,loading,error}.tsx` + `_components/{guide-search,guide-theme-section,guide-search-results}.tsx` ; `app/[locale]/community/guide/[slug]/{page,data,loading}.tsx` ; tests `tests/guide/*`.
- **UPDATE** : `sw/index.ts` (cache durable-content), `app/[locale]/community/page.tsx` (tuile Guide), `messages/{fr,ar}.json` (`community.guide` + tuile), `package.json` (react-markdown, remark-gfm).
- **AUCUNE** modif de schéma de table (3.1 a tout posé) ; seul ajout DB = le RPC recherche.

### References

- [Source: epics.md#Story-3.2] — AC verbatim (l.1156-1190), FR23/FR36-setup/FR45-setup/FR48.
- [Source: prd.md] — FR23 (l.916), FR36 (l.938), FR45 (l.958), FR48 (l.961), NFR7 (l.983), NFR8 (l.984), NFR35 (l.1023), NFR37 (l.1025), NFR40 (l.1028), NFR45 (l.1037), Journey 2 Aïcha (l.1071).
- [Source: architecture.md] — F4 Guide `app/(community)/guide/` (l.721/853/1213), `markdown-render.tsx` planifié (l.861), `guide/[entry]/page.tsx` (l.444), SW cache + offline (l.329/986), Serwist caveat Turbopack (l.142/203).
- [Source: 3-1-…schema-contenu-durable…md] — schéma `guide_entries`, RLS, FTS (story sœur, fondation).
- [Source: supabase/migrations/20260619090000_artisans_schema.sql] — FTS générées + GIN (modèle), `.textSearch` annuaire.
- [Source: app/[locale]/community/artisan/[slug]/data.ts] — pattern `cache()` + retour discriminé `found/not-found` (l.69-118).
- [Source: app/[locale]/community/annuaire/{page,data}.ts] — `force-dynamic`, search params, data layer.
- [Source: lib/search/fts.ts] — `sanitizeQuery`/`hasQuery` (l.18-81).
- [Source: sw/index.ts] — `annuaireCache` runtimeCaching (l.32-48).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev autonome Epic 3, 2026-06-20).

### Debug Log References

- `pnpm add react-markdown remark-gfm` → react-markdown 10.1.0, remark-gfm 4.0.1 (compat React 19 / Next 16).
- Migration RPC `20260627100000_guide_search_rpc.sql` appliquée ; `pnpm gen:types` → `search_guide_entries` dans `Functions`.
- `pnpm typecheck` ✅, `pnpm lint` ✅ (0 erreur, 13 warnings = baseline), `pnpm test` → 345 passed (markdown-render + guide-list), `pnpm test:rls` → block Epic 3 **8/8 verts** (g/h RPC cross-résidence inclus ; 1 échec pré-existant `moderation_log` hors-périmètre, voir 3.1).

### Completion Notes List

- **Déviation timestamp** : RPC en `20260627100000_guide_search_rpc.sql` (story prévoyait `20260623100000`, slot pris par Epic 2 — cohérent avec 3.1).
- `markdown-render.tsx` placé en `components/content/` (partagé Guide/Pack/preview co_mod), **RSC-compatible** (pas de `'use client'`). XSS-safe : `skipHtml` + pas de `rehype-raw` → `<script>`/`<img onerror>` inertes (testé). Liens externes `rel="noopener noreferrer" target="_blank"` ; `urlTransform` par défaut neutralise `javascript:`.
- RPC `search_guide_entries` **SECURITY INVOKER** (jamais DEFINER) : RLS du résident appliquée → preuve cross-résidence en test RLS (g/h). `ts_rank` (tri) + `ts_headline` (snippet `<mark>`). Locale-aware via `regconfig` (`french`/`simple`). `revoke execute from public, anon` + `grant to authenticated`.
- Snippet `ts_headline` rendu via `dangerouslySetInnerHTML` : sûr car Postgres HTML-échappe le source, seules nos `<mark>` passent (commenté au point d'usage). NB : `react/no-danger` n'est pas activé dans l'ESLint du projet.
- SW : `durableContentCache` (StaleWhileRevalidate, 24h, 64 entrées) matchant `/community/(guide|numeros-utiles)` + payloads RSC. Couvre déjà `numeros-utiles` (3.3) et `guide/pack-accueil` (3.4, sous `guide/`). Note mono-résidence MVP (pas de partitionnement par résidence).
- Home : passée du placeholder à une **grille de tuiles** (Annuaire + Guide). 3.3 ajoutera Numéros, 3.4 la bannière Pack.
- `community.guide` + `errors.guide` ajoutés à `fr.json` ; `ar.json` en **stub parallèle** (MVP FR-only).
- `<AppHeader>` cité par la story n'existe pas comme composant → header/back-link inline (pattern fiche artisan), conforme à l'intent.

### File List

- **NEW** `supabase/migrations/20260627100000_guide_search_rpc.sql`
- **NEW** `supabase/migrations/20260629090000_review_3_2_rpc_hardening.sql` (review 2026-06-20 — D1 + 17 patches : RPC PLPGSQL 2 branches, CTE post-limit, residence_id explicit, p_locale whitelist, generated col `ar_complete`)
- **NEW** `components/content/markdown-render.tsx` (+ `.test.tsx`)
- **NEW** `lib/content/guide.ts` (`GUIDE_THEME_ORDER`)
- **NEW** `app/[locale]/community/guide/{page,data,loading,error}.tsx` + `_components/{guide-search,guide-theme-section,guide-search-results}.tsx`
- **NEW** `app/[locale]/community/guide/[slug]/{page,data,loading}.tsx`
- **NEW** `tests/guide/guide-list.test.tsx`
- **UPDATE** `app/auth/signout/route.ts` (review P5 — `Clear-Site-Data: "cache"` au logout)
- **UPDATE** `sw/index.ts` (durable-content cache — review P5 maxAge 24h → 5min), `app/[locale]/community/page.tsx` (tuiles), `messages/{fr,ar}.json` (`community.guide`, `errors.guide`, tuiles, AR ICU plural fix), `lib/supabase/types.generated.ts` (RPC + `ar_complete`), `tests/rls.test.ts` (g/h/h1/h2 + cas review)
- **UPDATE** `components/content/markdown-render.tsx` (review P2/P3 — `disallowedElements=['img']` + `urlTransform` strict)
- **UPDATE** `app/[locale]/community/guide/_components/guide-search-results.tsx` (review P1 — split JS sans `dangerouslySetInnerHTML`, P11 strict typing)
- **UPDATE** `app/[locale]/community/guide/_components/guide-search.tsx` (review P7 — `searchParamsRef` au tick)
- **UPDATE** `app/[locale]/community/guide/_components/guide-theme-section.tsx` (review P11 — strict `Locale`)
- **UPDATE** `app/[locale]/community/guide/data.ts` + `[slug]/data.ts` (review P4 — FR48 cohérent via `ar_complete`)
- **UPDATE** `app/[locale]/community/guide/[slug]/page.tsx` (review P10 — slug regex validation)

### Change Log

| Date       | Version | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-19 | 0.1     | Création story 3.2 (context engine). Lecture Guide sur schéma 3.1 : liste groupée par thème (`<details>`), recherche FTS classée + snippet (`ts_headline` via RPC security-invoker), deep link `/guide/[slug]`, fallback FR + badge « Non traduit » (FR48), renderer Markdown partagé XSS-safe (react-markdown sans HTML brut), cache offline Serwist, i18n, tests. Status → ready-for-dev.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-06-20 | 0.2     | Code review adversariale (Blind Hunter + Edge Case + Acceptance Auditor) : XSS critique confirmée empiriquement sur `ts_headline` (Postgres N'HTML-ÉCHAPPE PAS — un `<img onerror>` dans `body_fr_markdown` traversait le snippet via `dangerouslySetInnerHTML`). 1 décision (D1 split JS) + 17 patches appliqués : RPC PLPGSQL 2 branches (P13 index GIN), CTE post-limit (P8), residence_id explicite (P6), p_locale whitelist (P15), generated col `ar_complete` (P17 FR48 cohérent), MarkdownRender `disallowedElements=['img']` + `urlTransform` whitelist (P2/P3), slug regex côté page (P10), GuideSearch ref pour searchParams (P7), SW maxAge 24h→5min + `Clear-Site-Data` au signout (P5), `Locale` strict typing (P11), AR `count` ICU plural template (P9), tests régression XSS/markdown/RPC. Status → done. |

### Review Findings

> Code review 2026-06-20 — Blind Hunter + Edge Case Hunter + Acceptance Auditor (3 couches adverses parallèles). ~55 findings bruts → 18 post-triage : **1 décision**, **17 patches**, **10 différés**, **3 dismissed**. **1 finding CRITICAL confirmé empiriquement**.

#### Décision

- [x] [Review][Decision] **D1 — Comment corriger la faille XSS du snippet de recherche ?** [`guide-search-results.tsx:36-40`] — `ts_headline` ne HTML-échappe PAS le texte source (vérifié SQL local : `select ts_headline('french', 'Bonjour <img src=x onerror=alert(1)> code portail', websearch_to_tsquery('french','portail'), 'StartSel=<mark>,StopSel=</mark>')` retourne le tag `<img onerror>` LITTÉRAL). Le commentaire D3 spec et le commentaire code étaient factuellement faux. **Résolution** : **(a) split JS sans `dangerouslySetInnerHTML`** — `snippet.split(/(<\/?mark>)/g)` + render React (échappement par défaut). RPC inchangé sur les délimiteurs. XSS éliminé.

#### Patches

- [x] [Review][Patch] **P1 [CRITICAL] — XSS stocké via `ts_headline` snippet** [`guide-search-results.tsx:36-40`] — Résolu par D1. Test (`guide-list.test.tsx`) : un snippet contenant `<img onerror>` est rendu comme texte brut, aucune balise `<img>`/`<script>` injectée dans le DOM ; le `<mark>` légitime traverse correctement.
- [x] [Review][Patch] **P2 [HIGH] — `MarkdownRender` permet `![alt](url)` (privacy + tracking)** [`markdown-render.tsx`] — `disallowedElements={['img']}` ajouté. Un body markdown `![tracker](https://attacker.example/pixel.gif)` ne rend AUCUN `<img>`. Test ajouté.
- [x] [Review][Patch] **P3 [HIGH] — `MarkdownRender` accepte `mailto:`/`xmpp:`/`//evil`/`javascript:`** [`markdown-render.tsx`] — `urlTransform` strict : whitelist `https?://` + relatif `/xxx` (pas `//xxx`). `mailto:`, `javascript:`, `data:`, protocol-relative → `href=""`. 4 tests régression.
- [x] [Review][Patch] **P4 [HIGH] — FR48 incohérent list vs detail** [`data.ts:68` + `[slug]/data.ts:55`] — list check `!title_ar`, detail check `!body_ar_markdown` → un titre AR sans body AR : list dit « traduit », detail dit « Non traduit ». **Résolution** : generated col `ar_complete boolean` (P17) sur `guide_entries`, list utilise la colonne, detail check `(!title_ar || !body_ar)`. Sémantique unifiée « complet AR ssi titre+corps non-vides ». Test (h2) confirme `ar_complete=false` sur seed FR-only.
- [x] [Review][Patch] **P5 [HIGH] — SW cache leak multi-user + soft-delete invalidation absente** [`sw/index.ts:55` + `auth/signout/route.ts`] — (a) `maxAgeSeconds` 24h → 5min sur `durableContentCache` (limite fenêtre leak + invalidation soft-delete co_mod) ; (b) header `Clear-Site-Data: "cache"` posé sur la réponse 303 de `/auth/signout` (purge Cache API du device au logout, anti-leak appareil partagé). Trade-off documenté : AC5 (< 100ms offline) reste satisfait dans la fenêtre 5min.
- [x] [Review][Patch] **P6 [MEDIUM] — RPC defense-in-depth `residence_id` absent** [`20260629090000_review_3_2_rpc_hardening.sql`] — Ajout `and g.residence_id = public.auth_residence_id()` au WHERE du RPC (en plus de la RLS). Court-circuit explicite si une régression future relâche la policy.
- [x] [Review][Patch] **P7 [MEDIUM] — `GuideSearch` self-loop + stale searchParams** [`guide-search.tsx:50`] — `searchParamsRef` lecture au tick (pas à l'armement). Retire `searchParams` des deps de l'effet 2 (évite self-loop sur chaque `router.replace`, et capture la dernière valeur si un autre param URL change pendant le debounce).
- [x] [Review][Patch] **P8 [MEDIUM] — `ts_headline` calculé pré-limit (perf)** [`20260629090000_review_3_2_rpc_hardening.sql`] — RPC structuré en CTE `matched` (rank + limit 30) puis `ts_headline` post-limit. 30 calls de `ts_headline` au lieu de N matched. À MVP <100 entrées cosmétique, à 3.5+ multi-résidence ça mord.
- [x] [Review][Patch] **P9 [LOW] — AR `community.guide.count` ICU plural template vide** [`messages/ar.json`] — `count: "{n, plural, =0 {0} one {#} other {#}}"` (template ICU valide). next-intl ne plantera plus si un user visite `/ar/community/guide`.
- [x] [Review][Patch] **P10 [MEDIUM] — Slug validation côté page absente** [`[slug]/page.tsx`] — Regex `^[a-z0-9][a-z0-9-]{0,79}$` (alignée sur le CHECK DB 3.1 P4). Court-circuit avant le fetch Supabase → anti-DoS (slugs absurdes) + anti path traversal.
- [x] [Review][Patch] **P11 [LOW] — Locale typing laxiste** [`guide-search-results.tsx`, `guide-theme-section.tsx`] — `locale: string` → `locale: Locale` strict (import `lib/i18n/config`).
- [x] [Review][Patch] **P12 [LOW] — Commentaire D3 factuellement faux** [`guide-search-results.tsx:7-9,38`] — Remplacé par un commentaire correct : `ts_headline` N'HTML-ÉCHAPPE PAS, on split JS, React échappe par défaut.
- [x] [Review][Patch] **P13 [MEDIUM] — `WHERE (CASE…) @@ tsq` empêche l'index GIN** [`20260629090000_review_3_2_rpc_hardening.sql`] — RPC réécrit en PLPGSQL avec 2 branches `if p_locale='ar' then … else … end`. Chaque branche WHERE explicit sur la bonne colonne (`search_fr_tsv` / `search_ar_tsv`) → Postgres utilise l'index GIN partial correspondant.
- [x] [Review][Patch] **P14 [LOW] — Doc snippet markdown brut surligné** — Documenté dans l'en-tête de `guide-search-results.tsx` (le snippet contient le markdown brut `**`/`#` non-rendu, par design — strip nécessiterait un parser SQL).
- [x] [Review][Patch] **P15 [MEDIUM] — RPC accepte locale invalide** [`20260629090000_review_3_2_rpc_hardening.sql`] — `if p_locale is null or p_locale not in ('fr','ar') then raise exception 'invalid_locale'`. Test (h1) prouve le rejet.
- [x] [Review][Patch] **P16 [HIGH] — Tests régression XSS / image markdown / FR48** — Ajoutés : (1) snippet `<img onerror>` inerte ; (2) `![alt](url)` désactivé ; (3) `mailto:`/`javascript:`/`//evil`/`data:` urlTransform ; (4) RPC reject locale invalide ; (5) `ar_complete=false` sur seed FR-only.
- [x] [Review][Patch] **P17 [MEDIUM] — Generated col `ar_complete`** [`20260629090000_review_3_2_rpc_hardening.sql`] — Colonne `ar_complete boolean generated always as (title_ar non-vide AND body_ar_markdown non-vide) stored`. Permet à la liste de calculer FR48 sans bandwidth body (50KB max × N entrées sur 3G).

#### Différés

- [x] [Review][Defer] **EC-01 — Empty state injuste sur query 100% stopwords FR** — UX dégradée acceptée MVP (impossible de distinguer côté client sans appel SQL).
- [x] [Review][Defer] **EC-03 — Timing channel cross-tenant via @@ tsq évaluation** — P6 court-circuit `residence_id` mitigerait partiellement ; mesure formelle de variance différée.
- [x] [Review][Defer] **EC-10 — Test axe-core automatisé** — Pattern projet (`@axe-core/playwright` E2E), instrumentation broader scope.
- [x] [Review][Defer] **EC-16 — RTL fallback content visual** — Locale AR + body FR fallback affichage RTL → UX cleanup epic 7.x ou V1.5 AR-aware.
- [x] [Review][Defer] **F15 — `revoke from public, anon` redundance** — Nit cosmétique.
- [x] [Review][Defer] **F16 — `captured` Set module-scope** — Pattern projet (cf. `annuaire/error.tsx`), nit.
- [x] [Review][Defer] **F17 — Rank coercion NaN edge** — Mort code (rank tri serveur uniquement).
- [x] [Review][Defer] **F19 — Error log non-instanceof guard** — Bénin (catch swallows).
- [x] [Review][Defer] **EC-15 — cache() React deduplication edge** — Comportement défensif attendu.
- [x] [Review][Defer] **EC-20 — Perf logging `guide_entries > 200`** — Volume MVP négligeable.

#### Dismissed

- EC-12 — `rank` coercion innocent (tri serveur).
- EC-14 — Slug Unicode (defensive design OK).
- EC-09 — Markdown brut `**`/`#` dans le snippet (UX cosmétique acceptée MVP).
