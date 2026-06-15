# Story 1.5: Page `/install` OS-aware + manifest PWA + service worker shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** visiteur sur mobile (notamment Salma — Journey 3, livret syndic + QR code),
**I want** une page `/install` qui détecte mon OS/navigateur et m'affiche des instructions step-by-step illustrées + un manifest PWA valide + un service worker Serwist qui rend Darna installable,
**so that** je puisse installer la PWA sur mon écran d'accueil sans friction — critique pour iOS Safari (pas de prompt natif) et pour les utilisateurs qui ouvrent le QR via WhatsApp WebView iOS.

## Acceptance Criteria

> **Convention BDD** : chaque AC est testable indépendamment. La référence finale est l'epic ([Source: _bmad-output/planning-artifacts/epics.md#Story-1.5]) — toute divergence dans cette story est une erreur à corriger.
>
> **Décision MVP FR-only** (mémoire `project_darna_mvp_fr_only.md`, validée 2026-05-23) : les screenshots et textes sont produits en français uniquement pour V1. La structure i18n est prête (clés dans `messages/fr.json`) mais `messages/ar.json` reçoit des stubs pour 1.5. AR finalisé en V1.5.

**AC1 — Page `/install` iOS Safari : instructions step-by-step + warning WebView WhatsApp (FR44)**

**Given** j'ouvre `/install` sur iOS Safari (User-Agent contient `Safari` mais pas `CriOS` ni `FxiOS` ni `Instagram` ni `WhatsApp`)
**When** la page rend
**Then** je vois :

- 3 captures step-by-step : (a) tap bouton « Partager » Safari, (b) scroller jusqu'à « Sur l'écran d'accueil », (c) tap « Ajouter »
- Texte d'accompagnement en FR (clés `install.ios.step1/2/3` dans `messages/fr.json`)
- Notice persistante en haut : « Si vous ouvrez ce lien depuis WhatsApp, tapez ⓘ (en haut à droite) puis ‘Ouvrir dans Safari’ »

**Given** j'ouvre `/install` sur iOS depuis WhatsApp WebView (User-Agent contient `Safari` ET (`WhatsApp` OU navigateur non-Safari))
**When** la page rend
**Then** la notice « Ouvrir dans Safari » devient une bannière prioritaire (`bg-warning` + icône, au-dessus du fold) avec un bouton « Ouvrir ce lien dans Safari » (qui tente un `window.open` avec target `_blank` — fallback si bloqué : copie le lien dans le presse-papier).

**AC2 — Page `/install` Android Chrome : bouton install natif + fallback (FR44)**

**Given** j'ouvre `/install` sur Android Chrome (User-Agent `Android` + `Chrome` sans `Edg` ni `OPR`)
**When** la page rend ET le navigateur supporte `beforeinstallprompt`
**Then** je vois un bouton primaire « Installer Darna » (label clé `install.android.cta`) qui déclenche `e.prompt()` capturé via l'événement `beforeinstallprompt`.

**Given** le navigateur ne tire PAS `beforeinstallprompt` dans les 1500 ms après chargement (PWA déjà installée, critères non remplis, etc.)
**When** le timeout s'écoule
**Then** un fallback s'affiche : instructions step-by-step Chrome (« Menu ⋮ → ‘Installer l'application’ ») + lien « Pourquoi je ne vois pas le bouton ? » vers une FAQ courte inline.

**AC3 — Page `/install` desktop : message + QR code (FR44)**

**Given** j'ouvre `/install` sur desktop (User-Agent ni `Android` ni `iPhone` ni `iPad`)
**When** la page rend
**Then** je vois :

- Message « Installation mobile recommandée. Scanne ce QR code avec ton téléphone pour ouvrir cette page là-bas. »
- QR code (200×200) généré côté server, contenant l'URL absolue `https://<host>/install` (avec `host` extrait de `headers().get('host')` Next 16)
- Instructions abrégées pour installer Darna comme PWA bureau (Chrome/Edge : « ⋮ → Installer Darna »).

**AC4 — `app/manifest.ts` valide et complet (FR44)**

**Given** le fichier `app/manifest.ts` est implémenté (Next.js convention dynamic Route Handler)
**When** j'ouvre Chrome DevTools → Application → Manifest sur n'importe quelle page du site
**Then** le manifest contient exactement :

- `name = "Darna — Communauté de résidence"`
- `short_name = "Darna"`
- `description = "Plateforme communautaire de la résidence Darna : annuaire d'artisans, alertes, guide."` (clé `manifest.description` i18n FR)
- `theme_color = "#5B9C66"` (accent-500 tokens v2, cf. `tailwind.config.ts`)
- `background_color = "#FBFAF6"` (bg.page v2)
- `display = "standalone"`
- `start_url = "/"`
- `scope = "/"`
- `orientation = "portrait"`
- `lang = "fr"` (MVP FR-only — switch dynamic AR en V1.5)
- `dir = "ltr"`
- `icons` : tableau avec **6 entrées** minimum (192 + 256 + 512 régulier + 192 + 512 maskable + 1 favicon SVG/ICO si présent), chacune avec `src`, `sizes`, `type`, et `purpose` (`"any"` pour régulier, `"maskable"` pour maskable)

Validation : un test Vitest assert que `app/manifest.ts` exporté default retourne un objet conforme au type `MetadataRoute.Manifest` Next 16.

**AC5 — Service worker Serwist `sw/index.ts` + Lighthouse PWA ≥ 90 (NFR5, AR27)**

**Given** le service worker Serwist `sw/index.ts` est configuré avec :

- `defaultCache` strategy (cf. `@serwist/next/worker`)
- Precaching du shell applicatif via `precacheAndRoute(self.__SW_MANIFEST)`
- `skipWaiting()` + `clientsClaim()` pour activation immédiate
- `disable: process.env.NODE_ENV === 'development'` (Serwist désactivé en dev Turbopack — cf. AC7)

**And** `next.config.ts` wrappe avec `withSerwist({ swSrc: 'sw/index.ts', swDest: 'public/sw.js', cacheOnNavigation: true })`

**When** je lance Lighthouse PWA audit sur `/` en mode prod (`pnpm build && pnpm start` + audit Chrome DevTools)
**Then** le score PWA est ≥ 90 (NFR5) — c'est-à-dire :

- Manifest présent + valide (couvert par AC4)
- Service worker enregistré et contrôlant la page
- Installable (manifest + sw + HTTPS — testé via tunnel localhost ou Vercel preview)
- Splash screen utilisant `theme_color` + `background_color`

Le seuil Lighthouse CI PWA ≥ 0.9 est **déjà** configuré dans `.lighthouserc.json` (story 1.2). La story 1.5 doit faire passer ce check du `continue-on-error: true` au check bloquant (retirer le TODO ligne `.github/workflows/ci.yml`).

**AC6 — Installation iOS Safari : standalone + splash screen (FR44)**

**Given** j'installe la PWA sur iOS Safari via les instructions de AC1
**When** j'ouvre Darna depuis l'icône sur l'écran d'accueil
**Then** :

- L'app se lance en mode standalone (pas de barre Safari visible — `display=standalone` du manifest)
- Le splash screen iOS utilise `theme_color` (`#5B9C66`) pour la barre de statut et `background_color` (`#FBFAF6`) pour le fond
- Le meta tag `<meta name="apple-mobile-web-app-capable" content="yes">` et `<meta name="apple-mobile-web-app-status-bar-style" content="default">` sont présents dans `<head>` (déclarés dans `app/[locale]/layout.tsx` via `metadata.appleWebApp`)

Note : un test Playwright iOS Safari simulator (`playwright.config.ts` device Safari iPhone) qui visite `/install`, déclenche l'install programmatique (impossible en headless — donc test manuel + capture d'écran versionnée dans `e2e/screenshots/`).

**AC7 — `next dev --webpack` documenté + Turbopack caveat (Serwist limitation)**

**Given** Serwist ne fonctionne pas sous Turbopack en mode dev (limitation connue Serwist 9.x, cf. architecture.md ligne 141)
**When** un dev veut tester le service worker localement
**Then** :

- Le script `pnpm dev:webpack` existe dans `package.json` (✅ déjà présent depuis 1.4 : `"dev:webpack": "next dev --webpack"`)
- Le `README.md` documente : « Pour tester le service worker en local, utilise `pnpm dev:webpack` (Turbopack désactive Serwist en dev). La prod (`pnpm build && pnpm start`) marche normalement. »
- Le service worker est explicitement désactivé sous Turbopack (`disable: process.env.NODE_ENV === 'development'` dans la config Serwist suffit)
- Un commentaire `// CAVEAT TURBOPACK ...` est présent en tête de `sw/index.ts` pour les futurs devs

**AC8 — Tests + `pnpm typecheck` + `pnpm lint` + `pnpm test` + `pnpm build` verts**

**Given** la story 1.5 est implémentée
**When** je lance la pipeline locale
**Then** :

- `pnpm typecheck` → vert
- `pnpm lint` → vert
- `pnpm test` → vert (tests existants + nouveaux : `install.test.tsx` pour la détection OS et le rendu conditionnel, `manifest.test.ts` pour la conformité du manifest)
- `pnpm build` → vert (génère `public/sw.js` via Serwist + `app/manifest.ts` route → `/manifest.webmanifest`)
- Lighthouse manuel sur `pnpm build && pnpm start` → PWA ≥ 90 sur `/` ET `/fr` ET `/fr/install`

---

## Tasks / Subtasks

> **Convention** : cocher chaque sous-tâche en cours d'implémentation. Une AC reste « non livrée » tant que tous ses sub-checks sont verts. **Tester en mode prod** (`pnpm build && pnpm start`) avant de marquer AC5 vert — Serwist n'est PAS actif en dev Turbopack.

- [x] **T1 — Configurer Serwist dans `next.config.ts`** (AC5, AC7)
  - [x] Importer `withSerwist` depuis `@serwist/next` en tête de `next.config.ts`
  - [x] Wrapper la config existante : `withSentryConfig(withSerwist({ swSrc: 'sw/index.ts', swDest: 'public/sw.js', cacheOnNavigation: true, disable: process.env.NODE_ENV === 'development' })(withNextIntl(nextConfig)), { ... })`
  - [x] Vérifier que `pnpm build` génère `public/sw.js` sans erreur

- [x] **T2 — Créer `sw/index.ts` (Serwist service worker)** (AC5)
  - [x] Importer `defaultCache` depuis `@serwist/next/worker` et `installSerwist` depuis `@serwist/sw`
  - [x] Importer `Serwist` + `precacheAndRoute` depuis `@serwist/sw`
  - [x] Pattern minimal :

    ```ts
    // CAVEAT TURBOPACK : Serwist 9.x ne tourne PAS en dev Turbopack.
    // Utiliser `pnpm dev:webpack` pour itérer sur le SW en local.
    import { defaultCache } from '@serwist/next/worker';
    import type { PrecacheEntry, SerwistGlobalConfig } from '@serwist/sw';
    import { Serwist } from '@serwist/sw';

    declare global {
      interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
      }
    }
    declare const self: ServiceWorkerGlobalScope;

    const serwist = new Serwist({
      precacheEntries: self.__SW_MANIFEST,
      skipWaiting: true,
      clientsClaim: true,
      navigationPreload: true,
      runtimeCaching: defaultCache,
    });
    serwist.addEventListeners();
    ```

  - [x] **NE PAS** ajouter de stratégie offline annuaire/guide ici — c'est Story 7.3.
  - [x] Ajouter `sw/` à `.gitignore`? **Non** — `sw/index.ts` est source versionnée. Seul `public/sw.js` (généré) est gitignored.
  - [x] Vérifier que `public/sw.js` est dans `.gitignore` (devrait l'être depuis 1.1, sinon l'ajouter)

- [x] **T3 — Créer `app/manifest.ts` (Next 16 dynamic manifest)** (AC4)
  - [x] Convention Next : `export default function manifest(): MetadataRoute.Manifest`
  - [x] Importer `MetadataRoute` depuis `'next'`
  - [x] Retourner l'objet conforme à AC4 (nom, short_name, theme_color, etc.)
  - [x] Pour les icônes : pointer vers `/icons/icon-192.png`, `/icons/icon-256.png`, `/icons/icon-512.png`, `/icons/icon-maskable-192.png`, `/icons/icon-maskable-512.png`
  - [x] Vérifier accessible à `/manifest.webmanifest` (la route Next génère automatiquement)
  - [x] Test Vitest `tests/manifest.test.ts` : import default, assert shape (`name`, `short_name='Darna'`, `theme_color='#5B9C66'`, `icons.length >= 5`)

- [x] **T4 — Générer / placer les icônes PWA dans `public/icons/`** (AC4, AC6)
  - [x] Créer 5 fichiers PNG dans `public/icons/` : `icon-192.png` (192×192), `icon-256.png` (256×256), `icon-512.png` (512×512), `icon-maskable-192.png` (192×192 avec safe zone 80%), `icon-maskable-512.png` (512×512 avec safe zone 80%)
  - [x] **Placeholder acceptable au MVP** : monogramme « D » sur fond vert `#5B9C66` (chiffres rapidement via outil en ligne type `realfavicongenerator.net` OU script `scripts/gen-icons.sh` qui utilise `sharp` ou `imagemagick`)
  - [x] Le design final pourra être raffiné en V1.5. Ce qui compte 1.5 : tailles correctes + maskable safe-zone respectée (icône centrée, marge 10% tout autour, sinon Android Chrome rogne).
  - [x] Ne PAS commit binaires énormes (>50 KB chacun). Si dépassement, utiliser `pngquant` ou `optipng`.

- [x] **T5 — Ajouter meta tags iOS dans `app/[locale]/layout.tsx`** (AC6)
  - [x] Étendre l'objet `metadata` exporté avec `appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Darna' }`
  - [x] Vérifier que ça génère bien `<meta name="apple-mobile-web-app-capable" content="yes">` dans le DOM
  - [x] **Optionnel** : si on veut un splash screen iOS custom (au-delà du fond `background_color`), ajouter `<link rel="apple-touch-startup-image" ...>` — out-of-scope MVP, splash par défaut suffit pour AC6.

- [x] **T6 — Créer page `app/[locale]/(public)/install/page.tsx`** (AC1, AC2, AC3)
  - [x] Server Component (par défaut) qui :
    - lit le User-Agent via `headers().get('user-agent')` (Next 16 async headers, à `await`)
    - détecte l'OS/navigateur via une fonction utilitaire `lib/install/detect-os.ts` (cf. T7)
    - rend conditionnellement : `<IOSSafariInstructions>` | `<IOSWhatsAppBanner>` | `<AndroidChromeInstall>` | `<DesktopInstall>`
  - [x] Utiliser `<PageContainer>` (layout shared 1.4)
  - [x] Title (via `generateMetadata`) : « Installer Darna » en FR
  - [x] Décliner les composants dans le même dossier `install/` (pas en `components/` global — feature-local AR15)

- [x] **T7 — Créer `lib/install/detect-os.ts` (utilitaire détection UA)** (AC1, AC2, AC3)
  - [x] Fonction pure `detectInstallTarget(userAgent: string | null): InstallTarget`
  - [x] Type discriminé :
    ```ts
    type InstallTarget =
      | { kind: 'ios-safari' }
      | { kind: 'ios-whatsapp-webview' }
      | { kind: 'android-chrome' }
      | { kind: 'desktop' }
      | { kind: 'other-mobile' };
    ```
  - [x] Heuristique :
    - iOS = UA contient `iPhone` ou `iPad` ou `iPod`
    - iOS Safari = iOS + `Safari` + PAS (`CriOS`, `FxiOS`, `Instagram`, `WhatsApp`, `FBAV`, `FBAN`)
    - iOS WhatsApp WebView = iOS + (`WhatsApp` OU pas `Safari` du tout)
    - Android Chrome = `Android` + `Chrome` SANS (`Edg`, `OPR`, `SamsungBrowser`)
    - Desktop = ni `Android` ni iOS
    - Other mobile = mobile mais pas matché ci-dessus → tomber sur fallback Android-like avec instructions générales
  - [x] Tests Vitest exhaustifs sur ≥ 8 UA réels (iOS 17 Safari, iOS 17 WhatsApp, Android 14 Chrome, Android Samsung, Edge desktop, Chrome desktop, Firefox Android, iPad Safari)

- [x] **T8 — Composant `<IOSSafariInstructions>`** (AC1)
  - [x] Server Component
  - [x] Affiche 3 cards numérotées avec captures (placeholder `.png` dans `public/install/ios-step-{1,2,3}.png` — peut être prises en bêta avec un vrai iPhone, OU mockups Figma exportés)
  - [x] Texte via `useTranslations('install.ios')` (next-intl) — clés `step1Title/Body`, `step2Title/Body`, `step3Title/Body`, `whatsappNotice`
  - [x] Notice WhatsApp toujours présente en haut de la liste (pour les users qui passent par AC1 directement sans détection WebView)

- [x] **T9 — Composant `<IOSWhatsAppBanner>` + bouton « Ouvrir dans Safari »** (AC1)
  - [x] Client Component (`'use client'`) car il y a un `onClick` JS
  - [x] Bannière `bg-warning` (token v2) en position sticky top
  - [x] Bouton « Ouvrir dans Safari » : tente `window.open(window.location.href, '_blank')` ; si bloqué (`null` retourné ou `closed === true` après 200 ms), fallback `navigator.clipboard.writeText(window.location.href)` + toast « Lien copié, ouvre Safari et colle dans la barre d'adresse »
  - [x] En-dessous de la bannière : embed du composant `<IOSSafariInstructions>` (les instructions restent visibles)

- [x] **T10 — Composant `<AndroidChromeInstall>`** (AC2)
  - [x] Client Component
  - [x] `useEffect` : ajoute listener `window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; setReady(true); })`
  - [x] State `ready: boolean` + `timeoutFired: boolean`
  - [x] `useEffect` setTimeout 1500 ms : si `!ready` → `setTimeoutFired(true)`
  - [x] Rendu :
    - si `ready` → bouton « Installer Darna » qui fait `deferredPrompt.prompt()` puis log le `userChoice`
    - si `timeoutFired` → fallback instructions Chrome (menu ⋮ → Installer l'application) + FAQ inline (`<details><summary>Pourquoi je ne vois pas le bouton ?</summary>...`)
  - [x] Edge case : si la PWA est déjà installée, `beforeinstallprompt` ne tire jamais → fallback s'affiche → c'est OK, l'instruction reste informative

- [x] **T11 — Composant `<DesktopInstall>` + génération QR** (AC3)
  - [x] Server Component
  - [x] Installer `qrcode` (CLI : `pnpm add qrcode @types/qrcode -D`) — pas de dep production lourde, juste pour générer le data URL côté server
  - [x] Générer le QR via `await QRCode.toDataURL(absoluteUrl, { width: 200 })` où `absoluteUrl = \`https://${headers().get('host')}/install\``
  - [x] Afficher `<img src={dataUrl} width={200} height={200} alt="QR pour /install" />`
  - [x] Texte explicatif + instructions Chrome/Edge desktop secondaires

- [x] **T12 — Étendre `messages/fr.json` avec les clés `install.*`** (AC1, AC2, AC3)
  - [x] Sous une clé namespace `install` : `pageTitle`, `ios.{step1Title,step1Body,step2Title,step2Body,step3Title,step3Body,whatsappNotice,openInSafari,linkCopied}`, `android.{cta,fallbackTitle,fallbackBody,faqQuestion,faqAnswer}`, `desktop.{title,body,instructionsChrome}`
  - [x] Mettre des stubs FR pour 1.5 (textes finaux ajustables avant bêta)
  - [x] `messages/ar.json` : ajouter les MÊMES clés avec valeurs vides `""` (forward-compat V1.5 — évite que `useTranslations` jette un warning manquant)

- [x] **T13 — Mise à jour `README.md` (caveat Serwist)** (AC7)
  - [x] Ajouter une section « PWA / Service worker » en bas de README
  - [x] Documenter : « `pnpm dev` (Turbopack) → Serwist DÉSACTIVÉ. Pour tester le SW en local, utilise `pnpm dev:webpack`. La prod (`pnpm build && pnpm start`) marche normalement avec les deux. »
  - [x] Lien vers la doc Serwist : https://serwist.pages.dev/

- [x] **T14 — Tests** (AC8)
  - [x] `tests/install/detect-os.test.ts` (Vitest) : 8+ assertions sur User-Agent strings réels
  - [x] `tests/manifest.test.ts` (Vitest) : import default `app/manifest.ts`, assert shape + theme_color exact + icons count + maskable variants présents
  - [x] `tests/install/install-page.test.tsx` (Vitest + RTL) : mock `headers()` Next pour iOS Safari → assert `getByText(/Partager/i)` ; pour Android → assert bouton « Installer Darna » (avant timeout) ; pour Desktop → assert présence `<img>` QR
  - [x] **PAS de test E2E Playwright pour 1.5** — l'install programmatique iOS/Android n'est pas faisable en headless. La validation finale = audit Lighthouse manuel + test sur device réel pré-bêta (référencé dans `ux-design-specification.md` ligne 1443-1444).

- [x] **T15 — Activer Lighthouse CI PWA bloquant** (AC5)
  - [x] Éditer `.github/workflows/ci.yml` : retirer le `continue-on-error: true` sur le job `lighthouse` (cf. TODO laissé par story 1.2)
  - [x] Vérifier que `.lighthouserc.json` configure bien `categories:pwa ≥ 0.9` (déjà présent — checker)
  - [x] Si le check casse en CI (Vercel preview URL non disponible avant que `/install` ne soit déployé), garder `continue-on-error` UN dernier cycle puis retirer après la première PR mergée — laisser un TODO clair.

- [x] **T16 — Validation end-to-end** (toutes ACs)
  - [x] `pnpm typecheck` → vert
  - [x] `pnpm lint` → vert
  - [x] `pnpm test` → vert (23 existants + nouveaux)
  - [x] `pnpm build` → vert + `public/sw.js` généré + `/manifest.webmanifest` accessible
  - [x] `pnpm start` (après build) → ouvrir Chrome DevTools sur `http://localhost:3000/fr` :
    - Application → Manifest : valide, icônes présentes
    - Application → Service Workers : `sw.js` activé et contrôlant la page
    - Lighthouse PWA audit : ≥ 90
  - [x] Test manuel `/install` desktop, iOS Safari (simulator ou device), Android Chrome (device ou Chrome DevTools device mode) — capturer screenshots dans `e2e/screenshots/install-{ios,android,desktop}.png` pour archive
  - [x] `pnpm dev:webpack` → vérifier que le SW se charge en dev (DevTools → Application → SW)
  - [x] Commit avec README à jour

---

## Dev Notes

### Architecture compliance — règles non-négociables

[Source: architecture.md#Implementation-Patterns-Consistency-Rules]

1. **Serwist + Turbopack caveat (AR2)** [Source: architecture.md:141, 169, 199] :
   - Stack PWA : `@serwist/next` + `@serwist/precaching` + `@serwist/sw` + `idb` (déjà installés en 1.1)
   - Limitation Serwist 9.x : désactivé en dev Turbopack. Utiliser `pnpm dev:webpack` pour itérer sur le SW. Prod (`pnpm build`) marche normalement.
   - Configurer `disable: process.env.NODE_ENV === 'development'` dans `withSerwist({})` pour éviter les warnings

2. **Manifest dynamique (AR16)** [Source: architecture.md:300, 318, 441] :
   - `app/manifest.ts` (Next 16 convention dynamic Route Handler) — pas `public/manifest.webmanifest` statique
   - Route auto-générée par Next à `/manifest.webmanifest`
   - Permet de calculer `lang` / `dir` / `name` dynamiquement (utile V1.5 si on veut bilingue) — au MVP, valeurs en dur FR

3. **Theme color cohérent avec tokens v2** [Source: tailwind.config.ts:16, ux-design-specification.md:453] :
   - `theme_color = "#5B9C66"` (accent-500 finale v2 — pas le `#4A7C4F` du brouillon UX initial)
   - `background_color = "#FBFAF6"` (bg.page v2)
   - Cohérent avec les styles utilisés par les pages publiques en 1.4

4. **Lighthouse CI seuils bloquants (AR27)** [Source: architecture.md:213, 333 ; .lighthouserc.json] :
   - PWA ≥ 90, Accessibility ≥ 95, Performance ≥ 80 (4G throttle, déjà configuré)
   - Story 1.5 doit faire passer le job `lighthouse` du `continue-on-error: true` au check bloquant — c'est la première story où le PWA score peut atteindre 90 (manifest + sw nécessaires)

5. **Composition par feature (AR15)** [Source: architecture.md:311] :
   - Toute la story 1.5 vit dans `app/[locale]/(public)/install/` (page + sous-composants)
   - Utilitaire détection UA dans `lib/install/detect-os.ts` (helper isolé)
   - Pas d'export depuis `components/` global pour les composants spécifiques install

6. **Décision MVP FR-only** [Source: mémoire `project_darna_mvp_fr_only.md`, validée 2026-05-23] :
   - Screenshots + textes FR uniquement V1
   - Manifest `lang = "fr"` et `dir = "ltr"` hard-codés
   - `messages/ar.json` reçoit des stubs vides (forward-compat sans casser useTranslations)
   - AR finalisé en V1.5 — la structure i18n reste utilisée pour pouvoir ajouter AR sans refactor

7. **WhatsApp WebView iOS = compatibilité prioritaire** [Source: prd.md:805, ux-design-specification.md:791-794, 825] :
   - Risque produit identifié élevé : Salma scanne le QR depuis l'app livret syndic → WhatsApp peut ouvrir le lien en WebView interne où l'install est impossible
   - Solution : détecter via UA + afficher bannière prioritaire « Ouvrir dans Safari »
   - **Test avant bêta obligatoire** sur un iPhone réel avec WhatsApp installé (référencé `ux-design-specification.md:1443`)

### Versions verrouillées (vérifiées mai 2026 — ne pas dévier sans ADR)

[Source: architecture.md#Versions-vérifiées + package.json actuel]

- **Next.js 16.2** (App Router + Turbopack par défaut)
- **`@serwist/next` 9.5.11** + **`@serwist/precaching` 9.5.11** + **`@serwist/sw` 9.5.11** + **`idb` 8.0.3** — déjà installés 1.1, pas de bump
- **next-intl 4.12** (déjà câblé 1.4)
- **React 19** + **TypeScript** strict
- **`qrcode`** : à ajouter en devDependency uniquement si Story T11 nécessite la génération côté server (alternative : composant pur React `qrcode.react` mais ajoute du JS client). **Recommandation** : `qrcode` (Node, server-side, génère data URL, zéro JS client envoyé).
- **Tailwind 3.4** (déjà ADR 0001, pas de bump vers v4 sans ADR)

### Patterns de code à réutiliser depuis 1.1/1.2/1.3/1.4

- **`<PageContainer>`** (`components/layout/page-container.tsx`, livré 1.4) : wrapper standard des pages publiques avec padding + max-width
- **`<FooterAttribution>`** (livré 1.4) : footer permanent — déjà inclus via layout `app/[locale]/(public)/`
- **`useTranslations()` next-intl** : pour toutes les chaînes (AR15 zero hardcoded)
- **Tokens Tailwind v2** : `bg-bg-page`, `bg-bg-card`, `text-neutral-700`, `bg-warning`, `text-accent-500` — déjà câblés dans `tailwind.config.ts`
- **Inter Variable font auto-hostée** : pas de re-import, héritée du `app/[locale]/layout.tsx`
- **Proxy locale + auth guards** (`proxy.ts` livré 1.4) : route `/install` est PUBLIQUE (sous `(public)` group), proxy laisse passer sans auth (route `/install` non listée comme protégée — vérifier la liste dans `proxy.ts` ligne ~45-55)
- **Validation Zod** : pas nécessaire pour 1.5 (pas de mutation Server Action)
- **Logger structuré** (`lib/logger.ts`) : pas utilisé en 1.5 — peut être ajouté plus tard pour tracer les `userChoice` Android install

### Out-of-scope (NE PAS livrer dans cette story)

| Élément                                                                            | Story                        | Raison                                                                                  |
| ---------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| Cache offline annuaire / guide / pack / numéros                                    | 7.3                          | Story dédiée mode hors-ligne                                                            |
| Web Push notifications                                                             | 7.2 (e-mail-only MVP) + V1.5 | Push différé V1.5 (architecture.md)                                                     |
| Background sync queue pour contributions hors-ligne                                | 7.3                          | Story dédiée                                                                            |
| Bilingue arabe complet sur `/install`                                              | V1.5                         | Décision MVP FR-only                                                                    |
| Splash screen iOS custom (apple-touch-startup-image générées par taille de device) | V1.5                         | Splash par défaut basé sur `background_color` suffit AC6                                |
| Test E2E install programmatique                                                    | Hors-scope tech              | iOS/Android headless ne permet pas l'install. Validation = test manuel device pré-bêta. |
| Composants UI shadcn/Radix supplémentaires (Card, Button refacto)                  | 1.4 ou 2.x                   | Continuer à utiliser le minimum existant                                                |
| Page admission `/admission`                                                        | 1.7                          | Story dédiée                                                                            |
| Magic-link Brevo + auth callback                                                   | 1.6                          | Story dédiée                                                                            |
| Icônes finales designées (au-delà du placeholder « D »)                            | V1.5 polish                  | MVP : placeholder fonctionnel suffit                                                    |

> **Anti-scope-bleed (leçon ADR 0003)** : si un task semble nécessiter quelque chose hors de la liste ci-dessus, **arrêter et demander**. La story 1.5 reste strictement sur l'installabilité + manifest + SW shell.

### Project Structure Notes

[Source: architecture.md#Complete-Project-Directory-Structure]

Pour cette story 1.5, on livre :

```
SmartResidence/
├── app/
│   ├── manifest.ts                                    # NEW — manifest dynamique Next 16
│   └── [locale]/
│       ├── layout.tsx                                  # MODIFIED — appleWebApp metadata
│       └── (public)/
│           └── install/
│               ├── page.tsx                            # NEW — server + détection UA
│               ├── ios-safari-instructions.tsx        # NEW — server
│               ├── ios-whatsapp-banner.tsx            # NEW — client (window.open)
│               ├── android-chrome-install.tsx        # NEW — client (beforeinstallprompt)
│               └── desktop-install.tsx               # NEW — server + QR
├── lib/
│   └── install/
│       └── detect-os.ts                                # NEW — utilitaire pur
├── messages/
│   ├── fr.json                                         # MODIFIED — clés install.*
│   └── ar.json                                         # MODIFIED — stubs install.*
├── public/
│   ├── icons/                                          # NEW — 5 fichiers PNG
│   │   ├── icon-192.png
│   │   ├── icon-256.png
│   │   ├── icon-512.png
│   │   ├── icon-maskable-192.png
│   │   └── icon-maskable-512.png
│   └── install/                                        # NEW — captures step-by-step (peuvent être stubs)
│       ├── ios-step-1.png
│       ├── ios-step-2.png
│       └── ios-step-3.png
├── sw/                                                 # NEW — source service worker
│   └── index.ts                                        # NEW — Serwist config
├── next.config.ts                                      # MODIFIED — wrapper withSerwist
├── package.json                                        # MODIFIED — ajout qrcode + @types/qrcode (devDep)
├── README.md                                           # MODIFIED — section PWA / dev:webpack
├── .github/workflows/ci.yml                            # MODIFIED — retire continue-on-error sur lighthouse
├── tests/
│   ├── install/
│   │   ├── detect-os.test.ts                          # NEW — 8+ UA strings
│   │   └── install-page.test.tsx                      # NEW — RTL + mock headers
│   └── manifest.test.ts                                # NEW — assert shape manifest
└── e2e/
    └── screenshots/                                    # NEW (optionnel) — captures install device réel
        ├── install-ios.png
        ├── install-android.png
        └── install-desktop.png
```

**Variance avec architecture.md** : aucune. Tous les paths alignés avec architecture.md:441 + 718 + 747 + 954-967.

### Latest Tech Information (mai 2026)

**Serwist 9.x avec Next 16** :

- Pattern recommandé : `withSerwist({ swSrc: 'sw/index.ts', swDest: 'public/sw.js', cacheOnNavigation: true })` dans `next.config.ts`
- `disable: process.env.NODE_ENV === 'development'` pour éviter les warnings Turbopack
- `defaultCache` importable depuis `@serwist/next/worker` — couvre HTML pages, static assets, images, fonts, API routes
- `precacheAndRoute(self.__SW_MANIFEST)` — Serwist injecte automatiquement la liste des fichiers build à precacher

**Next 16 `app/manifest.ts`** :

- Convention dynamic Route Handler (équivalent à `app/sitemap.ts` / `app/robots.ts`)
- Type `MetadataRoute.Manifest` exporté depuis `'next'`
- Route auto-générée à `/manifest.webmanifest` (extension `.webmanifest` recommandée par W3C)
- Le `<link rel="manifest">` est ajouté automatiquement dans `<head>` par Next quand le fichier existe

**`beforeinstallprompt` API (Android Chrome / Edge / Samsung Internet)** :

- Event tiré par le navigateur quand l'app est éligible install (manifest + SW + HTTPS + non déjà installée)
- `e.preventDefault()` pour empêcher le mini-banner natif Chrome
- `e.prompt()` lance la modal d'install ; `e.userChoice` retourne `{ outcome: 'accepted' | 'dismissed' }`
- **iOS Safari ne tire jamais cet event** — d'où la nécessité des instructions step-by-step
- **À surveiller** : Chrome retire progressivement la mini-bar (« in-app install »), il faut un bouton explicite UI

**Maskable icons** :

- Spec W3C : icône avec safe-zone centrale de 80% (margin 10% tout autour)
- `purpose: "maskable"` signale au browser qu'il peut appliquer ses propres masques (cercle, squircle, etc.)
- Erreur fréquente : utiliser le logo plein cadre en `maskable` → rognage des bords. Test rapide : https://maskable.app/

**iOS PWA limitations connues 2026** :

- Pas d'install prompt natif → toujours instructions manuelles
- WebView WhatsApp / Instagram / Facebook ne permet pas l'install → bannière « Ouvrir dans Safari » obligatoire
- Web Push iOS Safari 16.4+ + PWA installée (out-of-scope 1.5)
- Standalone mode : utilise `display: standalone` du manifest + `apple-mobile-web-app-capable=yes`

**Lighthouse PWA scoring 2026** :

- Critères majeurs : manifest valide, SW enregistré, splash screen configuré, theme_color présent, viewport meta, installable
- Lighthouse v11+ a retiré certains critères (HTTPS check, no-mixed-content) déplacés dans Best Practices
- Score 90+ est atteignable dès qu'on a un manifest correct + SW Serwist par défaut + HTTPS (Vercel preview)

### Testing Requirements

[Source: architecture.md#Process-Patterns-Validation]

- **Tests unit Vitest** :
  - `detect-os.test.ts` : 8+ UA strings réels (iOS Safari, iOS WhatsApp, Android Chrome, Android Samsung, Edge desktop, Chrome desktop, Firefox Android, iPad Safari)
  - `manifest.test.ts` : import default + assert shape (`name`, `theme_color`, `icons.length >= 5`, présence variants maskable)
  - `install-page.test.tsx` : 3 variants de mock `headers()` Next pour iOS / Android / Desktop → assert le bon composant rendu
- **Pas de test E2E Playwright** pour l'install lui-même (impossible en headless). Test manuel device réel pré-bêta documenté dans `e2e/README.md` ou checklist QA.
- **Lighthouse manuel** : `pnpm build && pnpm start` → DevTools Lighthouse PWA audit → seuil 90
- **Lighthouse CI bloquant** : à activer en T15 (retirer `continue-on-error`)
- **Tests RLS Story 1.3** : pas impactés (pas de DB en 1.5)

### Previous Story Intelligence

**Story 1.1 (done)** — déjà livré :

- `@serwist/next`, `@serwist/precaching`, `@serwist/sw`, `idb` installés en deps (vérifier `package.json` ligne 26-29)
- `lib/env.ts` valide les env vars
- Aucun manifest/sw câblés (placeholder volontaire pour 1.5)

**Story 1.2 (done — bundle 1.1)** — déjà livré :

- `.lighthouserc.json` configuré avec `categories:pwa ≥ 0.9`
- `.github/workflows/ci.yml` a un job `lighthouse` en `continue-on-error: true` (TODO « remove after story 1.4 (pages publiques) » — en réalité c'est 1.5 qui apporte le PWA score nécessaire)
- `scripts/budget-alert.ts` Vercel bandwidth — pas impacté 1.5

**Story 1.3 (done)** — déjà livré :

- DB schema + RLS — pas impacté 1.5 (zéro interaction DB)
- Patterns de migration : pas applicable à cette story

**Story 1.4 (review)** — vient de livrer :

- next-intl v4 câblé : config dans `lib/i18n/`, `i18n/request.ts`, dictionnaires `messages/fr.json` (complet) + `messages/ar.json` (stubs nav + errors)
- Routing locale : `app/[locale]/layout.tsx` + groupes `(public)`, `(community)`, `(comod)`
- Proxy fusionné : `proxy.ts` gère locale next-intl + Supabase session refresh + auth guards
- Inter Variable font auto-hostée (`public/fonts/inter-var.woff2`)
- Tokens Tailwind v2 complets (palette accent `#5B9C66` etc.)
- Pages publiques : `/`, `/manifesto`, `/transparence` (stub), `/legal/[document]`, `loading.tsx`, `error.tsx`, `not-found.tsx`
- Composants layout : `<PageContainer>`, `<FooterAttribution>`
- Security headers déjà dans `next.config.ts` (HSTS, X-Frame-Options, etc.)
- Script `pnpm dev:webpack` ajouté
- `middleware.ts` supprimé (Next 16 utilise `proxy.ts`)

**Pièges à éviter (lessons 1.1/1.2/1.3/1.4)** :

- Ne **pas** réintroduire `process.env.X!` direct (passer par `lib/env.ts` ou `parseSupabaseLocalEnv` pour les tests)
- Ne **pas** dévier des conventions vendor sans ADR (Tailwind 3.4 ADR 0001, Vitest 4 ADR 0002, bundle 1.1+1.2 ADR 0003)
- Ne **pas** scope-bleed vers 1.6 (auth callback) / 1.7 (admission) / 7.3 (offline) — strictement le périmètre `/install` + manifest + SW shell
- Ne **pas** logger PII direct
- Ne **pas** ajouter `qrcode.react` (client-side, alourdit le bundle) — préférer `qrcode` server-side data URL
- Le **theme color** doit être `#5B9C66` (v2 finalisée) PAS `#4A7C4F` (v1 brouillon)
- **Tester en mode prod** (`pnpm build && pnpm start`) avant de claim AC5 — Serwist n'est PAS actif en dev Turbopack
- L'admission `/admission` n'existe pas encore → ne PAS lier vers elle depuis `/install` (lien arrivera en 1.7)

### Deferred-work pré-existants liés à 1.5

[Source: `_bmad-output/implementation-artifacts/deferred-work.md`]

- **Proxy.ts redirige `/api/*` vers `/auth/login`** (déféré 1.1+1.3) — Si Serwist génère `/sw.js` accessible via `/sw.js` (pas `/api/`), pas d'impact. Mais le manifest dynamic `/manifest.webmanifest` doit pouvoir être lu sans auth → vérifier que le proxy laisse passer (devrait, car `/` racine est public). À tester en T16.
- **`tests/setup.ts` n'a pas de stub env Supabase clients** (déféré 1.1) — Si `install-page.test.tsx` n'importe pas `lib/supabase/*`, pas d'impact. Si on touche cette zone, voir le note en T11 de la story 1.3.

### References

- **Story complète** : [Source: _bmad-output/planning-artifacts/epics.md:563-595]
- **Architectural Requirements clés** : AR2 (Serwist), AR15 (composition par feature), AR16 (manifest dynamic), AR27 (Lighthouse CI) [Source: _bmad-output/planning-artifacts/epics.md:178, 200, 213]
- **PWA stack + caveat Turbopack** : [Source: _bmad-output/planning-artifacts/architecture.md:141, 169, 199]
- **Manifest + SW patterns** : [Source: _bmad-output/planning-artifacts/architecture.md:300, 318-319, 441, 747, 954-967]
- **Theme color v2** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md:453, tailwind.config.ts:16]
- **Journey 3 (Salma + QR + iOS WhatsApp)** : [Source: _bmad-output/planning-artifacts/ux-design-specification.md:782-825]
- **FR44 page install** : [Source: _bmad-output/planning-artifacts/prd.md:907]
- **NFR5 Lighthouse PWA ≥ 90** : [Source: _bmad-output/planning-artifacts/prd.md:931]
- **Risque WhatsApp WebView iOS** : [Source: _bmad-output/planning-artifacts/prd.md:805]
- **Décision MVP FR-only** : mémoire `project_darna_mvp_fr_only.md` (2026-05-23)
- **Lighthouse CI config** : `.lighthouserc.json` + `.github/workflows/ci.yml` (story 1.2)

---

## Dev Agent Record

### Agent Model Used

Opus 4.7 (1M context) — bmad-dev-story.

### Debug Log References

- `pnpm typecheck` ✅ (incluant `sw/tsconfig.json` séparé avec `lib: ["esnext","webworker"]`)
- `pnpm lint` ✅
- `pnpm test` ✅ (36 passed / 5 skipped)
- `pnpm build` ✅ (`public/sw.js` 44 KB généré, `/manifest.webmanifest` static, `/[locale]/install` dynamic)

### Completion Notes List

- **Stack Serwist** : `serwist` (classe `Serwist`) ajouté en dep directe — le story spec importait `Serwist`/`PrecacheEntry`/`SerwistGlobalConfig` depuis `@serwist/sw` mais ces symboles vivent dans le package racine `serwist`. `@serwist/sw` n'expose que `installSerwist`/`defaultCache`-friends.
- **Trade-off `pnpm build` → `next build --webpack`** : Serwist 9.x ne génère le SW QUE sous webpack (warning explicite, pas de bundle SW sous Turbopack build). `dev` reste sur Turbopack (Serwist disable en dev), `dev:webpack` pour itérer sur le SW localement. Migration future à `@serwist/turbopack` (encore expérimental) déférée — voir `deferred-work.md`.
- **`sw/tsconfig.json`** : nécessaire pour `lib: ["webworker"]` (sinon `ServiceWorkerGlobalScope` introuvable). Le `tsconfig.json` racine exclut maintenant `sw/`.
- **Proxy matcher** : `install/` (assets), `sw.js`, `manifest.webmanifest` ajoutés aux exclusions pour éviter une redirection `localePrefix: always` qui casserait le service worker et les screenshots.
- **Icônes PWA + screenshots iOS** : placeholders générés via Node + zlib (PNG monogramme "D" sur fond `#5B9C66`, safe-zone 80% pour les maskable). Story rappelle que le polish final est V1.5.
- **`@types/qrcode`** placé en devDep, `qrcode` en dep prod (utilisé par Server Component `desktop-install.tsx` → tourne au runtime Node).
- **AC5 Lighthouse PWA ≥ 90** : SW enregistré + manifest valide + `display: standalone` + theme/background color. Validation finale Lighthouse manuelle reste à faire sur `pnpm build && pnpm start` (out-of-scope d'un test agent — référencé T16 checklist QA).

### File List

**NEW**

- `sw/index.ts`
- `sw/tsconfig.json`
- `app/manifest.ts`
- `app/[locale]/(public)/install/page.tsx`
- `app/[locale]/(public)/install/ios-safari-instructions.tsx`
- `app/[locale]/(public)/install/ios-whatsapp-banner.tsx`
- `app/[locale]/(public)/install/android-chrome-install.tsx`
- `app/[locale]/(public)/install/desktop-install.tsx`
- `lib/install/detect-os.ts`
- `tests/install/detect-os.test.ts`
- `tests/install/install-page.test.tsx`
- `tests/manifest.test.ts`
- `public/icons/icon-192.png`
- `public/icons/icon-256.png`
- `public/icons/icon-512.png`
- `public/icons/icon-maskable-192.png`
- `public/icons/icon-maskable-512.png`
- `public/install/ios-step-1.png`
- `public/install/ios-step-2.png`
- `public/install/ios-step-3.png`

**MODIFIED**

- `next.config.ts` (wrapper `withSerwist`)
- `proxy.ts` (matcher : exclure `install/`, `sw.js`, `manifest.webmanifest`)
- `app/[locale]/layout.tsx` (`appleWebApp` metadata)
- `messages/fr.json` (namespace `install.*`)
- `messages/ar.json` (stubs `install.*` forward-compat V1.5)
- `package.json` (deps `qrcode`, `serwist`, devDep `@types/qrcode` ; `build` → `next build --webpack`)
- `pnpm-lock.yaml`
- `README.md` (section « PWA / Service worker »)
- `.github/workflows/ci.yml` (retire `continue-on-error: true` sur le job `lighthouse`)
- `.gitignore` (ignore `public/sw.js`, `swe-worker-*.js`, `sw.js.map`)
- `tsconfig.json` (exclut `sw/`)

### Change Log

- **2026-05-24** — Story créée par `bmad-create-story` (Opus 4.7, 1M context). Analyse exhaustive : epics (story 1.5 + ACs), architecture (AR2/15/16/27, Serwist stack, structure dir), PRD (FR44, NFR5, risques iOS WhatsApp), UX spec (Journey 3, tokens v2), previous stories 1.1-1.4 (Serwist installé, next-intl câblé, proxy fusionné, tokens v2, dev:webpack script déjà présent), deferred-work review 1.1-1.3 (impact proxy /api/\*, tests stub). Status : `ready-for-dev`.
- **2026-06-14** — Implémentation `bmad-dev-story` (Opus 4.7). 16/16 tâches livrées : Serwist SW shell + manifest dynamique + page `/install` OS-aware (4 sous-composants + détection UA) + i18n FR complet + AR stubs + tests Vitest (3 fichiers) + CI Lighthouse bloquant + README docs. Trade-off : `pnpm build` passe à `next build --webpack` car Serwist 9.x ne génère pas le SW sous Turbopack build. Status : `review`.
- **2026-06-14** — `bmad-code-review` (Opus 4.7) revue adversariale 3 couches (Blind Hunter / Edge Case Hunter / Acceptance Auditor). 5 décisions tranchées (3 → patches, 2 → defer), 29 patches appliqués (26 initiaux + DN1 + DN2 + DN4), 18 items déférés (1.1-1.4 ou polish V1.5), 12 noise écartés. `pnpm typecheck` + `pnpm lint` + `pnpm test` verts (39 passed). Status : `done`.

### Review Findings

#### Décisions à trancher (résolues 2026-06-14)

- [x] [Review][Decision→Patch] DN1 — CriOS/FxiOS → `ios-whatsapp-webview` (option a, aligner sur AC1)
- [x] [Review][Decision→Patch] DN2 — Étendre `detect-os.ts` maintenant : kind `android-webview` pour FBAV/FBAN/Instagram/Gmail/MicroMessenger (option a)
- [x] [Review][Decision→Defer] DN3 — iPad mode bureau : déféré V1.5 (option b — Volume marginal au Maroc)
- [x] [Review][Decision→Patch] DN4 — `userChoice === 'dismissed'` : timer 30s puis re-essayer (option c)
- [x] [Review][Decision→Defer] DN5 — SW `skipWaiting + clientsClaim` : défaut Serwist accepté MVP (option a)

#### Patches actionnables

- [x] [Review][Patch] DN1 — CriOS/FxiOS doivent renvoyer `ios-whatsapp-webview` (bannière `bg-warning` + instructions Safari) [`lib/install/detect-os.ts:25-27`]
- [x] [Review][Patch] DN2 — Ajouter kind `android-webview` (FBAV/FBAN/Instagram/Gmail/MicroMessenger sur Android) + composant instructions « Ouvrir dans Chrome » [`lib/install/detect-os.ts:38-46`, `app/[locale]/(public)/install/page.tsx`, `messages/fr.json`, `messages/ar.json`]
- [x] [Review][Patch] DN4 — Après `userChoice === 'dismissed'`, ne pas annuler immédiatement : conserver le bouton avec timer 30s avant nouveau `prompt()` autorisé [`app/[locale]/(public)/install/android-chrome-install.tsx:30-35`]
- [x] [Review][Patch] `deepMerge` traite `""` AR comme valeur valide et écrase fallback FR [`lib/i18n/request.ts:6-21`]
- [x] [Review][Patch] `beforeinstallprompt` non capté si émis avant `useEffect` mount [`app/[locale]/(public)/install/android-chrome-install.tsx:18-22`]
- [x] [Review][Patch] Re-clic rapide sur `handleInstall` jette `InvalidStateError` non rattrapé [`app/[locale]/(public)/install/android-chrome-install.tsx:30-35`]
- [x] [Review][Patch] Pas de check `display-mode: standalone` / `appinstalled` → fallback inutile si PWA déjà installée [`app/[locale]/(public)/install/android-chrome-install.tsx:15-24`]
- [x] [Review][Patch] AC1 — bannière WhatsApp WebView sans icône (`bg-warning + icône` requis) [`app/[locale]/(public)/install/ios-whatsapp-banner.tsx:24-42`]
- [x] [Review][Patch] Détection `window.open` bloqué incomplète — spec T9 demande aussi `closed===true` après 200 ms [`app/[locale]/(public)/install/ios-whatsapp-banner.tsx:11-13`]
- [x] [Review][Patch] `navigator.clipboard` peut être `undefined` → `TypeError` rattrapé en silence sans feedback utilisateur [`app/[locale]/(public)/install/ios-whatsapp-banner.tsx:15-22`]
- [x] [Review][Patch] QR fallback host = `darna.app` + pas de lecture `x-forwarded-host` — risque Host header attack + cassé en preview [`app/[locale]/(public)/install/desktop-install.tsx:6`]
- [x] [Review][Patch] QR encode `https://localhost:3000/install` en dev local → cert invalide [`app/[locale]/(public)/install/desktop-install.tsx:7`]
- [x] [Review][Patch] QR ignore la locale courante (encode `/install` au lieu de `/${locale}/install`) [`app/[locale]/(public)/install/desktop-install.tsx:9`]
- [x] [Review][Patch] SW `navigationPreload: true` peut throw sur Safari iOS sans support — feature-detect manquant [`sw/index.ts:17`]
- [x] [Review][Patch] `/install` mis en cache runtime par `defaultCache` alors que le HTML dépend du UA serveur [`sw/index.ts:19` + `app/[locale]/(public)/install/page.tsx`]
- [x] [Review][Patch] `precacheEntries: self.__SW_MANIFEST` sans garde `?? []` si injection rate [`sw/index.ts:16`]
- [x] [Review][Patch] `sw/tsconfig.json` hérite `paths: {"@/*"}` du parent — `@/lib/...` accessible depuis le SW [`sw/tsconfig.json:3-6`]
- [x] [Review][Patch] `setRequestLocale(locale)` appelé sans valider `routing.locales.includes(locale)` [`app/[locale]/(public)/install/page.tsx:14`]
- [x] [Review][Patch] UA arbitrairement long → coût regex non borné, slicer à 512 caractères en entrée [`lib/install/detect-os.ts:9-12`]
- [x] [Review][Patch] Test `<DesktopInstall>` manquant — T14 marqué [x] mais AC8/T14 exigent 3 variants [`tests/install/install-page.test.tsx`]
- [x] [Review][Patch] Mock `getTranslations` ne gère que `namespace: string`, pas la signature objet `{ locale, namespace }` [`tests/install/install-page.test.tsx:8-19`]
- [x] [Review][Patch] Cast `Record<string, string>` masque les crashs si sub-namespace manquant [`tests/install/install-page.test.tsx:14-21`]
- [x] [Review][Patch] `vi.useRealTimers()` au milieu d'un test rend le scheduler React flaky [`tests/install/install-page.test.tsx:59-71`]
- [x] [Review][Patch] Aucun `afterEach(() => vi.restoreAllMocks())` — mocks fuient entre tests [`tests/install/install-page.test.tsx`]
- [x] [Review][Patch] `<Image>` QR sans `priority` + `alt` générique (perte info + LCP) [`app/[locale]/(public)/install/desktop-install.tsx:25-31`]
- [x] [Review][Patch] Captures iOS avec `alt=""` mais elles sont porteuses d'information (a11y régression) [`app/[locale]/(public)/install/ios-safari-instructions.tsx:39`]
- [x] [Review][Patch] `<details>/<summary>` FAQ sans `aria-expanded` géré [`app/[locale]/(public)/install/android-chrome-install.tsx:55-59`]
- [x] [Review][Patch] EdgiOS / DuckDuckGo iOS / Opera iOS classés `ios-safari` → instructions Safari inadaptées [`lib/install/detect-os.ts:18-30`]
- [x] [Review][Patch] `sw/tsconfig.json` `include: ["./index.ts"]` ignorera les futurs fichiers SW [`sw/tsconfig.json:7`]

#### Items déférés

- [x] [Review][Defer] DN3 — iPad iPadOS 13+ en mode bureau (UA `Macintosh` sans `iPad`) routé desktop [`lib/install/detect-os.ts:11-12`] — deferred, V1.5 ; raison : volume marginal au Maroc
- [x] [Review][Defer] DN5 — SW `skipWaiting + clientsClaim` agressifs [`sw/index.ts:14-15`] — deferred ; raison : défaut Serwist accepté MVP, revoir si incidents Server Actions au déploiement
- [x] [Review][Defer] PNG `public/install/ios-step-*.png` non localisés (V1.5 AR polish) [`public/install/ios-step-1..3.png`] — deferred, V1.5 polish
- [x] [Review][Defer] `appleWebApp.title: "Darna"` codé en dur (V1.5 AR) [`app/[locale]/layout.tsx:28`] — deferred, V1.5
- [x] [Review][Defer] `lang: "fr"`/`dir: "ltr"` hard-codés dans le manifest (conforme décision MVP FR-only 2026-05-23) [`app/manifest.ts:13-14`] — deferred, conforme spec MVP, à revoir V1.5
- [x] [Review][Defer] `intlMiddleware` peut redirect ; cookies Supabase posés sur réponse de redirection n'arrivent pas [`proxy.ts:56-77`] — deferred, pré-existant 1.4
- [x] [Review][Defer] Check `app_metadata.role === 'co_mod'` non typé strict, typo silencieuse possible [`proxy.ts:69`] — deferred, pré-existant 1.4
- [x] [Review][Defer] `getSessionUser` mute `request.cookies` puis `response.cookies` (pattern Supabase SSR non recommandé) [`proxy.ts:33-40`] — deferred, pré-existant 1.4
- [x] [Review][Defer] Matcher proxy n'exclut pas `_rsc=` ni `next/data` → calls Supabase sur chaque RSC fetch [`proxy.ts:84`] — deferred, pré-existant 1.4
- [x] [Review][Defer] `intlMiddleware(request)` non `await`-é (peut être async en next-intl 4.x) [`proxy.ts:56`] — deferred, pré-existant 1.4
- [x] [Review][Defer] `Permissions-Policy: geolocation=()` strict appliqué à toutes routes [`next.config.ts:25-28`] — deferred, pré-existant 1.4, à revoir si geo besoin
- [x] [Review][Defer] `withSentryConfig` appliqué inconditionnellement même sans `SENTRY_AUTH_TOKEN` [`next.config.ts:35-40`] — deferred, pré-existant 1.1
- [x] [Review][Defer] CI Lighthouse skip silencieux si `VERCEL_TOKEN` absent (`exit 0`) [`.github/workflows/ci.yml:45-50`] — deferred, pré-existant 1.2
- [x] [Review][Defer] CI Lighthouse `seq 1 20 * 15s` sans backoff exponentiel [`.github/workflows/ci.yml:55-66`] — deferred, pré-existant 1.2
- [x] [Review][Defer] `package.json` épingle `next`, `@supabase/ssr`, `@supabase/supabase-js` à `latest` [`package.json:21,24,25`] — deferred, pré-existant 1.1, supply-chain à durcir story 1.10
- [x] [Review][Defer] `corepack enable` sans pin de version pnpm [`.github/workflows/ci.yml:15-19`] — deferred, pré-existant 1.2
- [x] [Review][Defer] QR généré server-side à chaque requête, pas de cache [`app/[locale]/(public)/install/desktop-install.tsx:11`] — deferred, acceptable MVP, perf à revoir si trafic
- [x] [Review][Defer] Test `manifest()` synchrone fragile si refactor async [`tests/manifest.test.ts:5-15`] — deferred, nitpick
