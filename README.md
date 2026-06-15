# Darna

> _Codename repo : SmartResidence — produit : **Darna**._

## Mission

Darna est une **PWA communautaire** pour une résidence marocaine de 150 villas. Elle remplace les groupes WhatsApp d'entraide par un outil **bilingue FR/AR**, **souverain (UE/Maroc)**, **sans tracker**, **modéré par les résidents eux-mêmes**, et publié en MIT.

Voir le product brief complet : [`_bmad-output/planning-artifacts/product-brief-SmartResidence.md`](./_bmad-output/planning-artifacts/product-brief-SmartResidence.md).

## Stack

- **Next.js 16.2** (App Router, Server Components, Turbopack)
- **Supabase** (Postgres + Auth magic-link e-mail + RLS multi-tenant)
- **Tailwind CSS 3.4** + composants shadcn/Radix (depuis le starter officiel)
- **PWA** : `@serwist/next` + manifest + service worker offline
- **i18n FR/AR + RTL** : `next-intl` (livré en Story 1.4)
- **Tests** : Vitest (unit) + Playwright (E2E, iOS Safari simulator)
- **Validation** : Zod v4 sur 3 frontières (Server Actions, Route Handlers, env vars)
- **Hosting** : Vercel `fra1` (Francfort) + Supabase `eu-central-1`

## Quickstart

Prérequis : Node 22 LTS (voir `.nvmrc`), pnpm 10+.

```bash
pnpm install
cp .env.example .env.local
# Remplir .env.local (Supabase + Brevo + GlitchTip + Upstash + CRON_SECRET ≥32 chars)
pnpm dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

### Caveat dev PWA

Sous **Turbopack** (`pnpm dev`), Serwist (service worker) est **désactivé en dev**. Pour développer le service worker localement, utiliser :

```bash
pnpm dev:webpack
```

La build de prod (`pnpm build`) fonctionne normalement avec Turbopack.

## PWA / Service worker

- Source : `sw/index.ts` (compilé vers `public/sw.js` au build, ignoré par git).
- Manifest dynamique : `app/manifest.ts` → exposé à `/manifest.webmanifest`.
- Icônes : `public/icons/` (5 PNG `any` + `maskable`, à raffiner V1.5).
- Page d'installation OS-aware : `/install` (détection iOS Safari / WhatsApp WebView / Android Chrome / Desktop QR).
- Doc Serwist : <https://serwist.pages.dev/>.

## Scripts

| Script             | Description                                             |
| ------------------ | ------------------------------------------------------- |
| `pnpm dev`         | Dev server (Turbopack)                                  |
| `pnpm dev:webpack` | Dev server avec service worker actif (Webpack)          |
| `pnpm build`       | Build production                                        |
| `pnpm start`       | Run production build                                    |
| `pnpm lint`        | ESLint (logical properties + no-any)                    |
| `pnpm typecheck`   | TypeScript strict (`tsc --noEmit`)                      |
| `pnpm test`        | Vitest unit/components (single run)                     |
| `pnpm test:watch`  | Vitest watch mode                                       |
| `pnpm e2e`         | Playwright tests                                        |
| `pnpm e2e:ui`      | Playwright UI mode                                      |
| `pnpm gen:types`   | Régénère `lib/supabase/types.generated.ts` (Story 1.3+) |

## Licence

[MIT](./LICENSE) — code libre dès J1. Voir aussi NFR48 dans `_bmad-output/planning-artifacts/epics.md`.
