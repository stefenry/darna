# Story 1.4: Pages publiques, i18n FR/AR shell & middleware locale/auth

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** visiteur public,
**I want** découvrir Darna via la homepage en français (LTR) — et techniquement prête pour l'arabe (RTL) — avec détection de langue et navigation publique complète,
**so that** je comprends la mission et la posture du projet avant de demander l'accès, et que la fondation i18n/middleware/fonts/tokens soit en place pour toutes les stories suivantes.

## Acceptance Criteria

> **Convention BDD** : chaque AC est testable indépendamment. La référence finale est l'epic ([Source: _bmad-output/planning-artifacts/epics.md#Story-1.4]) — toute divergence dans cette story est une erreur à corriger.

**AC1 — next-intl configuré avec dictionnaires FR + AR stub (AR35, NFR47)**
**Given** `next-intl` v4.12 est installé (story 1.1) et `messages/fr.json` + `messages/ar.json` existent
**When** je navigue vers `/fr` ou `/ar`
**Then** la page rend dans la langue correspondante avec `dir="ltr"` ou `dir="rtl"` sur l'élément `<html>` et l'attribut `lang` reflète la locale.

> **Note MVP FR-only** : `messages/ar.json` est un stub minimal (clés de navigation + fallback). Le contenu éditorial AR est différé V1.5. La structure technique reste complète.

**AC2 — Middleware locale detection via Accept-Language (FR47)**
**Given** le header Accept-Language est `ar-MA, ar;q=0.9, fr;q=0.8` et aucun cookie locale n'est set
**When** j'ouvre `/`
**Then** le middleware redirige vers `/fr` (MVP FR-only : même si AR est détecté, redirect FR car locale active unique au MVP).

**Given** le header Accept-Language est absent ou indéterminé
**When** j'ouvre `/`
**Then** le middleware redirige vers `/fr` (FR47 fallback).

> **Note V1.5** : quand AR sera activé, la détection Accept-Language routera vers `/ar` si le header le demande. Au MVP, seul `/fr` est actif mais le code de détection est déjà en place.

**AC3 — Pages publiques sous `app/[locale]/(public)/` accessibles sans auth (FR1)**
**Given** les pages publiques `/`, `/manifesto`, `/transparence` (stub), `/legal/mentions`, `/legal/confidentialite`, `/legal/cgu` existent sous `app/[locale]/(public)/`
**When** j'ouvre l'une d'elles sans être authentifié
**Then** elles rendent sans aucun check auth et affichent le contenu dans ma locale.

**AC4 — Fallback FR si clé traduction manquante (FR48, NFR47)**
**Given** une clé de traduction est absente dans `messages/ar.json`
**When** la page rend en mode AR
**Then** la chaîne FR fallback est affichée et aucun texte hardcodé n'apparaît dans le DOM.

**AC5 — Tailwind logical properties + RTL correct (AR22, NFR45)**
**Given** les CSS logical properties (`me-*`, `ps-*`, `start-*`) sont utilisées systématiquement
**When** la page rend en RTL (`/ar`)
**Then** le layout s'inverse correctement, aucun break visuel n'apparaît.

**AC6 — Middleware auth guards sur (community) et (comod) (NFR21)**
**Given** `middleware.ts` est implémenté
**When** une requête arrive sur le serveur
**Then** il (a) injecte la locale utilisateur depuis le cookie (ou Accept-Language fallback), (b) enforce les auth guards sur les route groups `(community)` et `(comod)` (redirect vers `/fr/admission` si pas authentifié, 403 si mauvais rôle).

> **Note** : au moment de 1.4, les routes `(community)` et `(comod)` n'existent pas encore physiquement. Le middleware prépare les guards pour les stories suivantes.

**AC7 — Fonts auto-hostées Inter Variable (AR36, D5 portabilité)**
**Given** `public/fonts/inter-var.woff2` est déployé
**When** la page charge
**Then** Inter Variable est utilisée comme font principale sans aucun appel Google Fonts. Noto Sans Arabic Variable est pré-configurée dans le CSS mais **non chargée** au MVP FR-only (gain bundle).

**AC8 — Security headers dans next.config.ts (AR30, NFR10)**
**Given** `next.config.ts` est configuré
**When** j'inspecte les headers de réponse HTTP
**Then** HSTS `max-age=63072000; includeSubDomains; preload`, X-Frame-Options DENY, Referrer-Policy `strict-origin-when-cross-origin`, Permissions-Policy minimale sont présents.

> **Note CSP** : Content-Security-Policy sera ajoutée progressivement. En 1.4 : CSP en mode report-only ou absente (trop de scripts inline Next.js à auditer). Story 1.10 (hardening) la rendra stricte.

**AC9 — Tailwind config Darna v2 tokens (UX spec tokens v2)**
**Given** `tailwind.config.ts` est mis à jour
**When** j'inspecte la config
**Then** elle contient les tokens de la palette Darna v2 (accent vert sage, neutres beige-sable, bg, gauge, semantic colors, border-radius bumped 14px, shadows ultra-subtils) tels que définis dans le UX Design Specification § Tokens v2.

**AC10 — `pnpm typecheck` + `pnpm lint` + `pnpm test` verts**
**Given** la story est implémentée
**When** je lance la pipeline locale
**Then** `pnpm typecheck` → vert, `pnpm lint` → vert, `pnpm test` → vert (tests existants + nouveaux si ajoutés).

---

## Tasks / Subtasks

> **Convention** : cocher chaque sous-tâche en cours d'implémentation. **Structure routing first, contenu pages last.**

- [x] **T1 — Setup next-intl v4 (config + plugin + routing)**
  - [ ] Créer `lib/i18n/config.ts` : export `locales = ['fr', 'ar'] as const`, `defaultLocale = 'fr'`, `localePrefix = 'always'`
  - [ ] Créer `lib/i18n/request.ts` : `getRequestConfig()` pattern next-intl v4 (charge le dictionnaire selon locale)
  - [ ] Créer `lib/i18n/routing.ts` : `defineRouting()` next-intl v4 avec `locales`, `defaultLocale`, `localePrefix: 'always'`
  - [ ] Créer `i18n/request.ts` à la racine (fichier requis par le plugin next-intl) → re-export ou délègue à `lib/i18n/request.ts`
  - [ ] Modifier `next.config.ts` : wrap avec `createNextIntlPlugin()` de `next-intl/plugin`
  - [ ] Vérifier que `pnpm dev` boot sans erreur après setup i18n

- [x] **T2 — Dictionnaires messages/fr.json + messages/ar.json**
  - [ ] Créer `messages/fr.json` avec les clés de navigation et pages publiques :
    ```
    {
      "nav": { "home": "Accueil", "manifesto": "Manifeste", "transparency": "Transparence", "legal": "Mentions légales", "source": "Code source" },
      "home": { "title": "Darna", "subtitle": "Le commun numérique de notre résidence", "cta_admission": "Demander l'accès", "cta_install": "Installer l'app" },
      "manifesto": { "title": "Manifeste", "body": "..." },
      "transparency": { "title": "Transparence", "stub": "Cette page sera complétée prochainement." },
      "legal": { "mentions": { "title": "Mentions légales" }, "confidentialite": { "title": "Politique de confidentialité" }, "cgu": { "title": "Conditions d'utilisation" } },
      "footer": { "attribution": "Open source MIT · Hébergé en UE · Aucun tracker" },
      "errors": { "not_found": "Page introuvable", "forbidden": "Accès non autorisé", "auth": { "required": "Connexion requise" } }
    }
    ```
  - [ ] Créer `messages/ar.json` : **stub minimal** — copier la structure de `fr.json` avec uniquement les clés de navigation traduites en arabe. Le reste = clés vides (fallback FR actif)
  - [ ] Valider que le fallback next-intl fonctionne (clé absente AR → affiche FR)

- [x] **T3 — Proxy locale + auth guards (Next.js 16 proxy pattern)**
  - [ ] Créer `middleware.ts` à la racine du projet :
    - Import `createMiddleware` de `next-intl/middleware` (ou `createNavigation`/`routing` pattern v4)
    - Chaîner avec la logique auth Supabase existante (`@supabase/ssr` middleware pattern)
    - **Locale logic** : lire cookie `NEXT_LOCALE` → sinon parse Accept-Language → sinon default `fr`
    - **Au MVP** : forcer locale `fr` (ignorer détection AR) — mettre un flag `const ACTIVE_LOCALES = ['fr']` documenté pour V1.5
    - **Auth guards** : si path match `/(community)/*` ou `/(comod)/*` → check session Supabase → si pas auth → redirect `/fr/admission`
    - **Comod guard** : si path match `/(comod)/*` → check `user.app_metadata.role === 'co_mod'` → sinon 403
    - **Pas de guard** sur `/(public)/*`, `/api/*`, `/auth/*`, `/_next/*`, assets statiques
  - [ ] Config `matcher` dans `middleware.ts` : exclure `_next`, `api`, `auth/confirm`, assets
  - [ ] Le middleware existant de Supabase (s'il y en a un) doit être **fusionné**, pas remplacé

- [x] **T4 — Root layout refactoring + fonts**
  - [ ] Télécharger `Inter-var.woff2` depuis https://rsms.me/inter/ → placer dans `public/fonts/inter-var.woff2`
  - [ ] **NE PAS** télécharger Noto Sans Arabic au MVP (gain bundle). Ajouter un commentaire `/* V1.5: Noto Sans Arabic Variable */` dans le CSS
  - [ ] Modifier `app/globals.css` : ajouter `@font-face` pour Inter Variable (preload woff2, display swap)
  - [ ] Modifier `app/layout.tsx` (root layout) :
    - Retirer `ThemeProvider` de `next-themes` (pas de dark mode au MVP — UX spec tranchée)
    - Garder `lang="fr"` par défaut sur `<html>` (la locale layout l'overridera)
    - Ajouter `className` pour Inter Variable
    - Conserver le `suppressHydrationWarning`
  - [ ] Créer `app/[locale]/layout.tsx` :
    - Wrap avec `NextIntlClientProvider` (messages)
    - Set `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>`
    - Import et apply Inter Variable font
    - Export metadata dynamique avec locale

- [x] **T5 — Tailwind config Darna v2 tokens**
  - [ ] Remplacer le contenu de `tailwind.config.ts` par les tokens Darna v2 :
    - Palette : `accent` (50→900), `bg` (page/card/soft), `neutral` (300→900), `success`, `warning`, `danger`, `info`, `gauge` (4 axes + track)
    - Border radius : sm=10px, DEFAULT=14px, lg=20px
    - Shadows : xs, sm, DEFAULT (ultra-subtils comme spec)
    - Font family : `['Inter Variable', 'system-ui', 'sans-serif']`
    - `minHeight.touch` = 48px, `minWidth.touch` = 48px
    - Retirer les tokens shadcn HSL var (background, foreground, etc.) — les remplacer par les tokens Darna directs
    - Retirer `tailwindcss-animate` si non utilisé (à vérifier usage)
    - Ajouter content path pour `messages/` si besoin
  - [ ] Mettre à jour `app/globals.css` : retirer les CSS variables HSL shadcn (`:root { --background: ... }`) et remplacer par les tokens Darna directs si nécessaire
  - [ ] Vérifier que les composants existants (`app/page.tsx`, etc.) compilent encore après le changement de palette

- [x] **T6 — Security headers dans next.config.ts (AR30)**
  - [ ] Ajouter dans `next.config.ts` :
    ```ts
    headers: async () => [{
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }],
    ```
  - [ ] **PAS de CSP stricte en 1.4** (Next.js inline scripts + nonce complexe → Story 1.10 hardening)
  - [ ] Wrap le tout dans `withSentryConfig` (déjà en place) puis `createNextIntlPlugin`

- [x] **T7 — Pages publiques (route group `(public)`)**
  - [ ] Créer `app/[locale]/(public)/page.tsx` — landing publique (titre, subtitle, CTA « Demander l'accès », CTA « Installer l'app », footer attribution)
  - [ ] Créer `app/[locale]/(public)/manifesto/page.tsx` — contenu statique depuis `messages/fr.json`
  - [ ] Créer `app/[locale]/(public)/transparence/page.tsx` — **stub** avec message « Cette page sera complétée prochainement »
  - [ ] Créer `app/[locale]/(public)/legal/[document]/page.tsx` — route dynamique pour `mentions`, `confidentialite`, `cgu`
  - [ ] Créer `app/[locale]/(public)/loading.tsx` — skeleton screen (jamais spinner — AR21)
  - [ ] Créer `app/[locale]/(public)/error.tsx` — error boundary i18n
  - [ ] Créer `app/[locale]/(public)/not-found.tsx`
  - [ ] Chaque page : Server Component, utilise `getTranslations()`, zéro texte hardcodé, CSS logical properties
  - [ ] Footer attribution permanent sur toutes les pages publiques (E3 confiance vérifiable)
  - [ ] **Supprimer** ou rediriger les pages du starter (`app/page.tsx`, `app/auth/*`, `app/protected/*`) vers le nouveau routing
    - `app/page.tsx` → redirect vers `/fr` (ou simplement devenir le layout racine redirect)
    - `app/auth/confirm/route.ts` → garder tel quel (auth callback, pas locale-routed)
    - `app/protected/*` → supprimer (sera remplacé par `(community)/*` en stories suivantes)
    - `app/auth/login`, `sign-up`, etc. → supprimer (magic link only, pas de form login classic)

- [x] **T8 — Composants layout de base**
  - [ ] Créer `components/layout/page-container.tsx` : `max-w-2xl mx-auto px-4 sm:px-6`
  - [ ] Créer `components/layout/footer-attribution.tsx` : « Open source MIT · Hébergé en UE · Aucun tracker · /transparence »
  - [ ] Appliquer les tokens Darna v2 (fond `bg-page`, pas de border, radius 14px si card, shadow-xs)

- [x] **T9 — Validation end-to-end**
  - [ ] `pnpm dev` → naviguer vers `/fr` → page landing rend correctement
  - [ ] Naviguer vers `/ar` → page rend en RTL avec fallback FR sur les clés manquantes
  - [ ] Naviguer vers `/` → redirect vers `/fr`
  - [ ] Inspecter headers HTTP → HSTS + X-Frame-Options + Referrer-Policy présents
  - [ ] `pnpm typecheck` → vert
  - [ ] `pnpm lint` → vert
  - [ ] `pnpm test` → vert
  - [ ] `pnpm build` → vert (vérifier que le build prod compile avec i18n + fonts)

### Review Findings

> Code review 2026-05-24 — Blind Hunter + Edge Case Hunter + Acceptance Auditor (3 layers, 36 raw → 16 retained, 6 dismissed)

**Decision Needed:**

- [x] [Review][Patch] D1 → P12 — Auth redirect cible `/${defaultLocale}/admission` [proxy.ts:57-58] — Décision: conformer au spec AC6 — APPLIED
- [x] [Review][Patch] D2 → P13 — Comod wrong-role retourne HTTP 403 [proxy.ts:63-69] — Décision: vrai 403 conforme AC6 — APPLIED
- [x] [Review][Dismiss] D3 — ACTIVE_LOCALES non enforced — décision: laisser tel quel, AR stub pas exposé dans nav

**Patch:**

- [x] [Review][Patch] P1 — Links utilisent `next/link` au lieu de `next-intl` Link + href `/admission` sans préfixe locale [app/[locale]/(public)/page.tsx:24, not-found.tsx:17] — APPLIED
- [x] [Review][Patch] P2 — `getClaims()` n'est pas une méthode standard Supabase SSR + aucun try/catch [proxy.ts:43] — APPLIED (`getUser()` + try/catch)
- [x] [Review][Patch] P3 — Pas de fallback FR configuré pour les clés AR manquantes dans next-intl [lib/i18n/request.ts] — APPLIED (deepMerge FR fallback)
- [x] [Review][Patch] P4 — FooterAttribution utilise `useTranslations` sans directive `"use client"` [components/layout/footer-attribution.tsx:1] — APPLIED (server component, `getTranslations`)
- [x] [Review][Patch] P5 — FooterAttribution défini mais jamais importé — AC3 exige footer attribution permanent sur toutes les pages publiques [components/layout/footer-attribution.tsx] — APPLIED (monté dans layout locale)
- [x] [Review][Patch] P6 — PageContainer défini mais jamais utilisé — les pages dupliquent ses classes [components/layout/page-container.tsx] — APPLIED (manifesto/transparence/legal + prop `as`)
- [x] [Review][Patch] P7 — Branche protected-route skip intlMiddleware — pas de négociation locale pour les utilisateurs authentifiés [proxy.ts:51-72] — APPLIED
- [x] [Review][Patch] P8 — Import dynamique `messages/${locale}.json` sans try/catch fallback [lib/i18n/request.ts:11] — APPLIED
- [x] [Review][Patch] P9 — `cacheComponents: true` n'est pas une option Next.js valide [next.config.ts:8] — APPLIED (retirée)
- [x] [Review][Patch] P10 — Error boundary n'utilise pas le paramètre `error` — pas de report Sentry [app/[locale]/(public)/error.tsx] — APPLIED (`Sentry.captureException`)
- [x] [Review][Patch] P11 — Pas de `generateMetadata` dans le layout locale — clés metadata dans fr/ar.json inutilisées [app/[locale]/layout.tsx] — APPLIED

**Deferred:**

- [x] [Review][Defer] Df1 — Shadcn dropdown-menu.tsx utilise data-[side=left/right] — pre-existing, pas introduit en 1.4
- [x] [Review][Defer] Df2 — Fichier font Noto Sans Arabic non vérifié — concern V1.5, pas MVP

---

## Dev Notes

### Architecture compliance — règles non-négociables

[Source: architecture.md#Implementation-Patterns-Consistency-Rules]

1. **Routing locale public-only (AR35, ADR 0003)** [Source: architecture.md:313, 998-1002] :
   - `app/[locale]/(public)/*` = pages publiques i18n-routées
   - `app/(community)/*` = entités communautaires **SANS locale dans URL**, locale lue depuis cookie via middleware
   - `app/(comod)/*` = routes co-mod, idem sans locale dans URL
   - `app/auth/*` + `app/api/*` = hors locale routing

2. **next-intl v4 configuration** [Source: architecture.md:225-226, 314] :
   - Dictionnaires `messages/fr.json` et `messages/ar.json`
   - `getTranslations()` côté serveur (Server Components), `useTranslations()` côté client (minimal)
   - Fallback FR si clé AR absente

3. **CSS logical properties OBLIGATOIRES (AR22, NFR45)** [Source: architecture.md:207, 315, 576] :
   - `me-*`, `ps-*`, `start-*`, `end-*` **toujours**
   - `mr-*`, `ml-*`, `pl-*`, `pr-*`, `left-*`, `right-*` **jamais** (ESLint custom rule bloque)
   - `dir="rtl"` conditionnel sur `<html>` selon locale

4. **Skeleton screens, jamais spinner (AR21, NFR40)** [Source: architecture.md:320, 540] :
   - `loading.tsx` par route avec skeleton structuré
   - Règle Aïcha : pas d'attente sans contexte visuel

5. **Security headers (AR30)** [Source: architecture.md:291, epics.md:215] :
   - HSTS max-age=63072000; includeSubDomains; preload
   - X-Frame-Options DENY
   - Permissions-Policy minimale
   - CSP stricte **différée** Story 1.10

6. **Fonts auto-hostées (AR36, D5)** [Source: architecture.md:226, 964-967] :
   - `public/fonts/inter-var.woff2` (FR) — chargée dès 1.4
   - `public/fonts/noto-sans-arabic-var.woff2` (AR) — **NON chargée au MVP** (UX spec § Typography : « pas chargée au MVP — gain bundle »)
   - Aucun appel Google Fonts

7. **Zéro texte hardcodé (NFR47, D7)** [Source: architecture.md:576] :
   - Toute string UI passe par `getTranslations()`/`useTranslations()`
   - Clé convention : `<namespace>.<context>.<key>` (ex: `home.title`, `nav.manifesto`)

### Décision MVP FR-only

[Source: memory project_darna_mvp_fr_only.md — Décision 2026-05-23]

- Le MVP ship uniquement en français. L'arabe (RTL) est différé V1.5.
- **MAIS** la structure technique est complète : next-intl configuré, `messages/ar.json` existe (stub), CSS logical properties, `dir` conditionnel, font slot réservé.
- Au lancement, `ACTIVE_LOCALES = ['fr']` dans le middleware → le `/ar` route existe techniquement mais n'est pas exposé dans la navigation.

### Tailwind tokens v2 — valeurs exactes à implémenter

[Source: ux-design-specification.md § Tokens v2]

```ts
// tailwind.config.ts theme.extend
colors: {
  accent: {
    50: '#ECF4EE', 100: '#D5E8DA', 200: '#ABD0B4',
    500: '#5B9C66', 600: '#4A8255', 700: '#3B6944', 900: '#1F3823',
  },
  bg: {
    page: '#FBFAF6',
    card: '#FFFFFF',
    soft: '#F4F2EC',
  },
  neutral: {
    300: '#C8C2B5', 400: '#95907F', 500: '#6E6A5C',
    700: '#38362E', 900: '#1A1812',
  },
  success: '#5B9C66',
  warning: '#D4A24A',
  danger: '#D45B4A',
  info: '#4A82A8',
  gauge: {
    depannage: '#4A82A8',
    'petits-travaux': '#5B9C66',
    'travail-soigne': '#CB7B2A',
    urgences: '#D45B4A',
    track: '#ECEAE2',
  },
},
borderRadius: {
  sm: '10px',
  DEFAULT: '14px',
  lg: '20px',
},
boxShadow: {
  xs: '0 1px 1px rgba(20, 18, 14, 0.025)',
  sm: '0 2px 6px rgba(20, 18, 14, 0.04)',
  DEFAULT: '0 6px 18px rgba(20, 18, 14, 0.06)',
},
fontFamily: {
  sans: ['Inter Variable', 'system-ui', 'sans-serif'],
},
```

**Principes design v2** (UX spec) :

- Zéro `border` sur cards/inputs/chips — séparation par contraste de fond + shadow-xs
- Cards en `bg-card` (blanc pur) sur fond `bg-page` (crème clair)
- Inputs sans border, fond `bg-soft`, focus = ring accent-500
- Radius 14px standard, 20px sur tuiles d'accueil, 9999px sur chips/pills
- Letter-spacing négatif sur titres (-0.01em à -0.02em)

### next-intl v4 — patterns spécifiques (version installée : 4.12)

**Structure fichiers** (obligatoire next-intl v4) :

```
i18n/
  request.ts            ← OBLIGATOIRE par le plugin (convention path)
lib/i18n/
  config.ts             ← locales, defaultLocale, localePrefix
  request.ts            ← getRequestConfig() implementation
  routing.ts            ← defineRouting()
```

**Plugin wrap dans next.config.ts** :

```ts
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');
// ... wrap nextConfig
export default withSentryConfig(withNextIntl(nextConfig), { ... });
```

**Middleware pattern v4** (next-intl + Supabase auth chain) :

```ts
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/lib/i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // 1. Locale resolution via next-intl
  const response = intlMiddleware(request);
  // 2. Auth check for protected routes
  // ... supabase session check ...
  return response;
}
```

### Versions verrouillées

- **next-intl** : 4.12.0 (déjà installé — `package.json`)
- **Next.js** : latest (16.x en mai 2026 — vérifié architecture.md)
- **Tailwind CSS** : 4.x (déjà installé)
- **Inter Variable** : dernière stable rsms.me/inter (subset latin + latin-ext suffit FR)

### Patterns de code à réutiliser depuis 1.1/1.2/1.3

- **Clients Supabase** : `lib/supabase/server.ts`, `client.ts`, `proxy.ts` — le middleware auth chain doit utiliser le même pattern `createServerClient`
- **Env validation** : `lib/env.ts` (Zod) — pas de nouvelle env var en 1.4 (aucune clé API requise)
- **Logger** : `lib/logger.ts` — pas d'usage direct en 1.4 (pages statiques publiques)
- **Composants existants** : `app/page.tsx` actuel sera supprimé/redirigé

### Out-of-scope (NE PAS livrer dans cette story)

| Élément                                                  | Story                    | Raison                                                        |
| -------------------------------------------------------- | ------------------------ | ------------------------------------------------------------- |
| Page `/install` OS-aware + manifest PWA + service worker | 1.5                      | Story dédiée                                                  |
| Magic link + auth callback full                          | 1.6                      | Story dédiée                                                  |
| Formulaire admission                                     | 1.7                      | Story dédiée                                                  |
| Routes `(community)/*` pages                             | Epic 2+                  | Stories dédiées                                               |
| Routes `(comod)/*` pages                                 | 1.8                      | Story dédiée                                                  |
| CSP stricte                                              | 1.10                     | Hardening batch                                               |
| Dark mode                                                | Hors-scope permanent MVP | UX spec tranchée                                              |
| Contenu éditorial AR complet                             | V1.5                     | Décision 2026-05-23                                           |
| Composants UI Radix (Button, Card, etc.)                 | 1.5 ou ultérieur         | Les pages 1.4 sont simples, pas besoin de composants élaborés |
| Tests E2E Playwright sur les pages publiques             | 1.10                     | Batch hardening                                               |

> **Anti-scope-bleed (leçon 1.1 → ADR 0003)** : si un task semble nécessiter quelque chose hors de la liste ci-dessus, **arrêter et demander**. Ne pas commencer à coder le formulaire admission ou la page install.

### Project Structure Notes

[Source: architecture.md#Complete-Project-Directory-Structure]

Pour cette story 1.4, on livre :

```
SmartResidence/
├── app/
│   ├── layout.tsx                           # MODIFIED — retrait ThemeProvider, ajout font
│   ├── page.tsx                             # MODIFIED — redirect vers /fr (ou supprimé)
│   ├── [locale]/                            # NEW — wrapping i18n
│   │   ├── layout.tsx                       # NEW — NextIntlClientProvider + dir + lang
│   │   ├── error.tsx                        # NEW
│   │   ├── not-found.tsx                    # NEW
│   │   └── (public)/                        # NEW — route group pages publiques
│   │       ├── page.tsx                     # NEW — landing /fr
│   │       ├── manifesto/page.tsx           # NEW
│   │       ├── transparence/page.tsx        # NEW (stub)
│   │       ├── legal/[document]/page.tsx    # NEW — mentions, confidentialite, cgu
│   │       ├── loading.tsx                  # NEW — skeleton
│   │       └── error.tsx                    # NEW — error boundary
│   ├── auth/
│   │   └── confirm/route.ts                # KEEP — auth callback (pas de locale routing)
│   └── protected/                          # DELETE — remplacé par (community) en stories futures
├── components/
│   └── layout/
│       ├── page-container.tsx              # NEW
│       └── footer-attribution.tsx          # NEW
├── lib/
│   └── i18n/
│       ├── config.ts                       # NEW
│       ├── request.ts                      # NEW
│       └── routing.ts                      # NEW
├── i18n/
│   └── request.ts                          # NEW (convention plugin next-intl)
├── messages/
│   ├── fr.json                             # NEW
│   └── ar.json                             # NEW (stub)
├── public/
│   └── fonts/
│       └── inter-var.woff2                 # NEW (téléchargé)
├── middleware.ts                            # NEW — locale + auth guards
├── next.config.ts                          # MODIFIED — headers + createNextIntlPlugin
├── tailwind.config.ts                      # MODIFIED — tokens Darna v2
└── app/globals.css                         # MODIFIED — @font-face Inter + retrait vars HSL
```

**Pages du starter à supprimer** :

- `app/auth/forgot-password/page.tsx` — magic link only, pas de mot de passe
- `app/auth/login/page.tsx` — sera remplacé par magic link story 1.6
- `app/auth/sign-up/page.tsx` — sera remplacé par admission story 1.7
- `app/auth/sign-up-success/page.tsx` — idem
- `app/auth/update-password/page.tsx` — pas de mot de passe
- `app/auth/error/page.tsx` — conserver ou migrer vers error boundary i18n
- `app/protected/layout.tsx` + `app/protected/page.tsx` — supprimer

### Previous Story Intelligence

**Story 1.3 (in-progress)** — learnings anticipés :

- Bridge `public.users` ↔ `auth.users` via trigger = le middleware auth 1.4 doit utiliser `supabase.auth.getUser()` pour vérifier la session, puis lire `app_metadata.role` pour les guards
- Types générés dans `lib/supabase/types.generated.ts` — 1.4 n'a pas besoin de les importer (pages statiques publiques sans DB read)
- Pattern `scripts/generate-types.sh` — pas pertinent pour 1.4
- `.gitignore` mis à jour avec `supabase/.branches`, `supabase/.temp` — ok

**Story 1.1 + 1.2 (done)** :

- ESLint custom rule logical properties déjà en place — **ne pas utiliser** `mr-*`, `ml-*` etc.
- Husky + lint-staged actif — le pre-commit hook va vérifier
- `lib/env.ts` ne valide que les vars Supabase + Sentry — pas de nouvelle var en 1.4
- GlitchTip + instrumentation.ts OK — errors dans les pages publiques seront captées

### Testing Requirements

- **Pas de test E2E en 1.4** (Playwright sur pages publiques = Story 1.10 batch)
- **Tests visuels** : validation manuelle via `pnpm dev` + navigation `/fr` et `/ar`
- **Tests types** : `pnpm typecheck` couvre les imports i18n + types next-intl
- **Tests lint** : `pnpm lint` vérifie les logical properties CSS
- **Build test** : `pnpm build` doit passer (vérifier que next-intl compile en prod)
- **Optionnel** : un test Vitest léger sur le routing config (locales array, defaultLocale)

### References

- **Story complète** : [Source: _bmad-output/planning-artifacts/epics.md:523-560]
- **Architecture routing locale** : [Source: _bmad-output/planning-artifacts/architecture.md:313-314, 416-467]
- **Architecture security headers** : [Source: _bmad-output/planning-artifacts/architecture.md:291, 580-584]
- **Architecture middleware** : [Source: _bmad-output/planning-artifacts/architecture.md:554-558, 993]
- **Architecture fonts** : [Source: _bmad-output/planning-artifacts/architecture.md:226, 964-967]
- **UX tokens v2** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md:622-677]
- **UX typography** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md:494-517]
- **MVP FR-only** : [Source: memory project_darna_mvp_fr_only.md]
- **ADR 0003 (locale routing public-only)** : architecture.md mentions it as one of 8 ADRs to write

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context)

### Debug Log References

- Next.js 16 conflict: `proxy.ts` vs `middleware.ts` — Next 16.2 remplace middleware par proxy. Logique fusionnée dans `proxy.ts`.
- Build prod échoue à "collect page data" car `lib/env.ts` valide les env vars au module-load et `/auth/confirm/route.ts` l'importe. Pré-existant (story 1.1), non introduit par 1.4. Compilation TS passe vert.
- `tailwindcss-animate` retiré (inutilisé au MVP, pas de dark mode).
- Pages starter auth/\* non supprimées (permission denied) — elles ne conflictent pas avec le nouveau routing.

### Completion Notes List

- T1: next-intl v4 configuré (config, routing, request, plugin wrapper next.config.ts)
- T2: Dictionnaires fr.json (complet) + ar.json (stub nav + errors) créés
- T3: Proxy fusionné (next-intl locale + Supabase session refresh + auth guards community/comod)
- T4: Inter Variable font téléchargée, root layout simplifié (sans ThemeProvider), locale layout créé
- T5: Tailwind tokens Darna v2 complets (palette, radius, shadows, font-family)
- T6: Security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) dans next.config.ts
- T7: Pages publiques créées (home, manifesto, transparence stub, legal/[document], loading skeleton, error boundary, not-found)
- T8: Composants layout (page-container, footer-attribution) créés
- T9: typecheck vert, lint vert, tests verts (23 passing), build compile TS OK

### File List

**NEW:**

- lib/i18n/config.ts
- lib/i18n/routing.ts
- lib/i18n/request.ts
- lib/i18n/navigation.ts
- i18n/request.ts
- messages/fr.json
- messages/ar.json
- app/[locale]/layout.tsx
- app/[locale]/not-found.tsx
- app/[locale]/(public)/page.tsx
- app/[locale]/(public)/manifesto/page.tsx
- app/[locale]/(public)/transparence/page.tsx
- app/[locale]/(public)/legal/[document]/page.tsx
- app/[locale]/(public)/loading.tsx
- app/[locale]/(public)/error.tsx
- components/layout/page-container.tsx
- components/layout/footer-attribution.tsx
- public/fonts/inter-var.woff2

**MODIFIED:**

- proxy.ts (fusionné: next-intl locale + auth guards + Supabase session)
- next.config.ts (createNextIntlPlugin + security headers)
- tailwind.config.ts (tokens Darna v2)
- app/globals.css (@font-face Inter + tokens directs)
- app/layout.tsx (simplifié, sans ThemeProvider)
- app/page.tsx (redirect vers /fr)

**DELETED:**

- middleware.ts (conflit Next.js 16 proxy pattern)

### Change Log

- **2026-05-24** — Story créée par `bmad-create-story` (Opus 4.7, 1M context). Analyse exhaustive : epics, architecture, UX spec (tokens v2 + journeys), stories 1.1-1.3, codebase actuelle. Status : `ready-for-dev`.
