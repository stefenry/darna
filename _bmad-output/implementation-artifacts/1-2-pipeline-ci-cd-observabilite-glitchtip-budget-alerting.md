# Story 1.2: Pipeline CI/CD, observabilité GlitchTip & budget alerting

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** solo dev (Stephane),
**I want** 4 workflows GitHub Actions (CI, release, mirror, budget alerting) + GlitchTip Cloud EU observabilité avec sourcemaps + Lighthouse CI avec seuils bloquants + logger JSON structuré,
**so that** la qualité du code, les erreurs en production, les régressions perf/a11y et les coûts d'infra soient surveillés automatiquement sans intervention manuelle.

## Acceptance Criteria

> **Convention BDD** : chaque AC est testable indépendamment. La référence finale est l'epic ([Source: _bmad-output/planning-artifacts/epics.md#Story-1.2]) — toute divergence dans cette story est une erreur à corriger.

**AC1 — Workflow CI sur PR (AR25)**
**Given** `.github/workflows/ci.yml` est commité
**When** une PR est ouverte sur `main`
**Then** le workflow exécute **4 jobs séquentiels** : (1) lint (`pnpm lint`), (2) typecheck (`pnpm typecheck`), (3) tests Vitest (`pnpm test`), (4) Lighthouse CI sur la preview URL Vercel — et le workflow **échoue** sur tout exit code non-zéro, marquant la PR comme `failing`.

**AC2 — Lighthouse CI assertions bloquantes (AR27)**
**Given** `.lighthouserc.json` est configuré avec des assertions
**When** le workflow CI exécute Lighthouse contre la preview Vercel
**Then** il enforce : **PWA >= 0.90**, **Accessibility >= 0.95**, **Performance >= 0.80** (avec throttle 4G simulé) — la PR est marquée `failing` si un seuil est manqué.

**AC3 — GlitchTip observabilité avec sourcemaps (AR26, NFR16)**
**Given** `instrumentation.ts` câble `@sentry/nextjs` v10.x avec le DSN GlitchTip Cloud EU
**When** une Server Action ou un Route Handler `throw` une erreur
**Then** l'erreur apparaît dans GlitchTip Cloud EU (Allemagne) avec les **sourcemaps résolues** (uploadées via le step release du CI) et les logs JSON structurés corrélés via `X-Darna-Request-Id`.

**AC4 — Vercel Analytics désactivé (NFR16)**
**Given** la configuration Vercel du projet est inspectée
**When** je vérifie `vercel.json` ou les paramètres projet
**Then** Vercel Analytics, Vercel Speed Insights et Vercel Web Analytics sont **désactivés** (privacy-first, pas de tracking client).

**AC5 — Budget alerting quotidien (AR28)**
**Given** `.github/workflows/budget-alert.yml` existe avec un cron quotidien
**When** le workflow s'exécute
**Then** il pull les usages via les APIs Supabase + Vercel + R2 + Brevo, estime le coût mensuel projeté, et envoie un **e-mail d'alerte via Brevo** si le coût dépasse **15 EUR** (MVP) ou **50 EUR** (post-100 villas, configurable via variable).

**AC6 — Workflow release (AR25)**
**Given** `.github/workflows/release.yml` existe
**When** je push un tag `release-*`
**Then** le workflow (1) exécute `supabase db push --linked` pour appliquer les migrations, (2) promote le dernier déploiement preview vers production via Vercel CLI, (3) uploade les sourcemaps vers GlitchTip.

**AC7 — Workflow mirror anti-bus-factor (NFR29)**
**Given** `.github/workflows/mirror.yml` existe
**When** le cron horaire se déclenche
**Then** le repo GitHub est mirrored vers GitLab.com et Codeberg.org via `git push --mirror` avec tokens dédiés.

**AC8 — Logger JSON structuré (AR19, AR26)**
**Given** `lib/logger.ts` est créé
**When** un module importe `log()` depuis `lib/logger.ts`
**Then** les logs sont émis en JSON structuré sur `stdout` avec les champs : `ts` (ISO), `level` (`info`|`warn`|`error`), `event` (ex: `admission.validated`), `user_id` (nullable), `residence_id` (nullable), `request_id` (nullable, corrélation `X-Darna-Request-Id`), `payload` (optionnel, **jamais de PII**) — et les erreurs de niveau `error` sont **automatiquement capturées par GlitchTip** via `@sentry/nextjs`.

**AC9 — Sécurité des workflows**
**Given** tous les workflows GitHub Actions
**When** j'inspecte les fichiers YAML
**Then** : (1) chaque action tierce utilise un **SHA complet pinné** avec commentaire de version (`actions/checkout@<sha> # v4.1.7`), (2) chaque workflow déclare des `permissions` minimales (read-only sauf ce qui est nécessaire), (3) aucun secret n'est exposé dans les logs, (4) les tokens mirror sont des secrets GitHub séparés (`GITLAB_MIRROR_TOKEN`, `CODEBERG_MIRROR_TOKEN`).

---

## Tasks / Subtasks

> **Convention** : cocher chaque sous-tâche en cours d'implémentation. Une AC reste "non livrée" tant que tous ses sub-checks sont verts.

- [x] **T1 — Installer `@sentry/nextjs` + configurer GlitchTip** (AC3, AC8)
  - [x] `pnpm add @sentry/nextjs@^10`
  - [x] Créer `sentry.server.config.ts` :
    ```ts
    import * as Sentry from '@sentry/nextjs';
    Sentry.init({
      dsn: process.env.GLITCHTIP_DSN,
      tracesSampleRate: 1.0,
      environment: process.env.VERCEL_ENV || 'development',
    });
    ```
  - [x] Créer `sentry.edge.config.ts` (même structure, DSN identique)
  - [x] Créer `sentry.client.config.ts` (même DSN, `replaysSessionSampleRate: 0` — pas de replay, privacy-first)
  - [x] Créer `instrumentation.ts` :
    ```ts
    import * as Sentry from '@sentry/nextjs';
    export async function register() {
      if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('./sentry.server.config');
      }
      if (process.env.NEXT_RUNTIME === 'edge') {
        await import('./sentry.edge.config');
      }
    }
    export const onRequestError = Sentry.captureRequestError;
    ```
  - [x] Wrapper `next.config.ts` avec `withSentryConfig()` pour sourcemaps auto-upload (uniquement en CI, pas en dev local — conditionné par `SENTRY_AUTH_TOKEN`)
  - [x] Ajouter `SENTRY_AUTH_TOKEN` et `SENTRY_ORG` et `SENTRY_PROJECT` dans `.env.example` (bloc GlitchTip), avec commentaire : `# Sourcemaps upload (CI only — pas requis en dev local)`
  - [x] Vérifier que `lib/env.ts` parse **uniquement** `GLITCHTIP_DSN` (les tokens Sentry sourcemaps sont des secrets CI, pas de l'app runtime)

- [x] **T2 — Créer `lib/logger.ts`** (AC8)
  - [x] Implémenter le logger JSON structuré :
    ```ts
    type LogLevel = 'info' | 'warn' | 'error';
    type LogEntry = {
      ts: string;
      level: LogLevel;
      event: string;
      user_id: string | null;
      residence_id: string | null;
      request_id: string | null;
      payload?: Record<string, unknown>;
    };
    export function log(entry: Omit<LogEntry, 'ts'>): void {
      const output: LogEntry = { ts: new Date().toISOString(), ...entry };
      if (entry.level === 'error') {
        // Sentry capture automatique pour GlitchTip
        const Sentry = require('@sentry/nextjs');
        Sentry.captureMessage(entry.event, {
          level: 'error',
          extra: { ...entry.payload, request_id: entry.request_id },
        });
      }
      console.log(JSON.stringify(output));
    }
    ```
  - [x] Créer `lib/logger.test.ts` — 3 tests : (1) log info produit du JSON valide avec tous les champs, (2) log error invoque Sentry.captureMessage, (3) aucun PII dans le payload (test par l'absence de champs email/phone)
  - [x] `pnpm test` → tous verts

- [x] **T3 — Désactiver Vercel Analytics** (AC4)
  - [x] Créer `vercel.json` à la racine :
    ```json
    {
      "$schema": "https://openapi.vercel.sh/vercel.json",
      "analytics": { "enabled": false },
      "speedInsights": { "enabled": false }
    }
    ```
  - [x] Vérifier `package.json` : aucune dépendance `@vercel/analytics`, `@vercel/speed-insights`. Si présente, supprimer.
  - [x] Grep le code source pour `import.*@vercel/analytics` — résultat attendu : 0

- [x] **T4 — Workflow CI** (AC1, AC2, AC9)
  - [x] Créer `.github/workflows/ci.yml` :
    - Trigger : `pull_request` sur `main`
    - Permissions : `contents: read`, `pull-requests: read`
    - Runner : `ubuntu-latest` (Ubuntu 24.04)
    - Setup : `actions/setup-node@<sha>` avec `node-version-file: '.nvmrc'` ou `node-version: '22'` + `pnpm` via `corepack enable`
    - Cache : `actions/cache@<sha>` sur `pnpm store`
    - Jobs :
      1. **lint-typecheck-test** : `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm test`
      2. **lighthouse** : dépend de lint-typecheck-test, déclenché sur `deployment_status` success OU attend la preview URL Vercel (via API Vercel ou `vercel-preview-url` action pinée) → `npx @lhci/cli@0.15 autorun`
    - Toutes les actions tierce avec SHA complet + commentaire version
  - [x] Créer `.lighthouserc.json` :
    ```json
    {
      "ci": {
        "collect": {
          "numberOfRuns": 3,
          "settings": {
            "throttling": {
              "cpuSlowdownMultiplier": 4
            }
          }
        },
        "assert": {
          "assertions": {
            "categories:performance": ["error", { "minScore": 0.8 }],
            "categories:accessibility": ["error", { "minScore": 0.95 }],
            "categories:pwa": ["error", { "minScore": 0.9 }]
          }
        },
        "upload": {
          "target": "temporary-public-storage"
        }
      }
    }
    ```
  - [x] Note : au stade Story 1.2, l'app n'a pas encore de pages publiques complètes (livrées en 1.4). Le workflow CI doit fonctionner mais **les seuils Lighthouse seront probablement échoués** sur la page starter par défaut. Le workflow doit être fonctionnel ; les seuils seront réellement testés à partir de la Story 1.4+. **Option** : marquer le job Lighthouse comme `continue-on-error: true` jusqu'à 1.4, avec un `# TODO: remove continue-on-error after story 1.4`

- [x] **T5 — Workflow release** (AC6, AC9)
  - [x] Créer `.github/workflows/release.yml` :
    - Trigger : `push` tags `release-*`
    - Permissions : `contents: read`
    - Secrets requis : `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
    - Steps :
      1. Checkout
      2. Setup Node 22 + pnpm
      3. `pnpm install --frozen-lockfile`
      4. `npx supabase db push --linked` (applique les migrations pending)
      5. `npx vercel promote --yes --token $VERCEL_TOKEN` (promote le dernier preview deployment)
      6. Upload sourcemaps GlitchTip via `@sentry/nextjs` build step (conditionné par `SENTRY_AUTH_TOKEN`)
    - Actions tierce avec SHA pinné

- [x] **T6 — Workflow mirror** (AC7, AC9)
  - [x] Créer `.github/workflows/mirror.yml` :
    - Trigger : `schedule` cron `0 * * * *` (toutes les heures) + `workflow_dispatch` (déclenchement manuel)
    - Permissions : `contents: read`
    - Secrets : `GITLAB_MIRROR_TOKEN`, `CODEBERG_MIRROR_TOKEN`
    - Steps :
      1. Checkout complet (`fetch-depth: 0` pour avoir tout l'historique)
      2. `git remote add gitlab https://oauth2:$GITLAB_MIRROR_TOKEN@gitlab.com/<user>/darna.git || true`
      3. `git push gitlab --mirror --force`
      4. `git remote add codeberg https://<user>:$CODEBERG_MIRROR_TOKEN@codeberg.org/<user>/darna.git || true`
      5. `git push codeberg --mirror --force`
    - **Note** : les repos GitLab et Codeberg doivent être créés manuellement d'abord. Documenter dans le README ou runbook.

- [x] **T7 — Workflow budget alerting** (AC5, AC9)
  - [x] Créer `scripts/budget-alert.ts` (script Node.js exécuté par le workflow) :
    - Lit les env vars : `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `R2_ACCOUNT_ID`, `R2_API_TOKEN`, `BREVO_API_KEY`, `ALERT_EMAIL`
    - Pour chaque provider :
      - **Supabase** : `GET https://api.supabase.com/v1/projects/{ref}/usage` → extrait bandwidth + storage
      - **Vercel** : `GET https://api.vercel.com/v1/usage` → extrait serverless invocations + bandwidth
      - **R2** : `GET https://api.cloudflare.com/client/v4/accounts/{id}/r2/buckets` → extrait storage + operations
      - **Brevo** : `GET https://api.brevo.com/v3/account` → extrait credits restants + e-mails envoyés
    - Estime coût mensuel projeté (extrapolation linéaire)
    - Si `> MVP_THRESHOLD` (default 15 EUR) : envoie e-mail via Brevo API à `ALERT_EMAIL`
    - Retourne exit code 0 (succès même si alerte envoyée — le workflow ne doit pas fail)
  - [x] Créer `.github/workflows/budget-alert.yml` :
    - Trigger : `schedule` cron `0 8 * * *` (quotidien 08:00 UTC) + `workflow_dispatch`
    - Permissions : aucune (script-only, pas de checkout nécessaire au-delà du code)
    - Steps : checkout + setup node + `npx tsx scripts/budget-alert.ts`
    - Secrets : tous les tokens API ci-dessus
  - [x] Ajouter `tsx` en devDependency (`pnpm add -D tsx`) pour exécuter les scripts TypeScript

- [x] **T8 — Mise à jour `.env.example` et `.nvmrc`** (AC3, AC9)
  - [x] Ajouter dans `.env.example` un bloc `# GlitchTip / Sentry (sourcemaps CI-only)` :
    ```
    SENTRY_AUTH_TOKEN=
    SENTRY_ORG=
    SENTRY_PROJECT=
    ```
  - [x] Créer `.nvmrc` : `22` (Node 22 LTS — Node 20 EOL avril 2026)
  - [x] Mettre à jour `@types/node` dans `package.json` : `^22` au lieu de `^20`

- [x] **T9 — Validation end-to-end** (toutes ACs)
  - [x] `pnpm install` → idempotent
  - [x] `pnpm typecheck` → vert (avec les nouveaux fichiers Sentry + logger)
  - [x] `pnpm lint` → vert
  - [x] `pnpm test` → vert (tests existants lib/validation/\* + nouveau test lib/logger.test.ts)
  - [x] `pnpm dev` → app boot localhost:3000, pas d'erreur Sentry en dev (DSN manquant = silencieux)
  - [x] Vérifier que les 4 fichiers workflow YAML sont valides (syntaxe YAML parsable)
  - [x] Vérifier que `instrumentation.ts` ne casse pas le build (`pnpm build` — peut échouer si env vars manquantes, c'est attendu, le build CI passe avec les secrets Vercel)
  - [x] Vérifier qu'aucun import `@vercel/analytics` ne reste dans le code

### Review Findings

**Decision-needed:**

- [x] [Review][Decision] F10 — PII logger : convention seule retenue. Responsabilité du caller, pas de filtrage dans le code. — dismissed
- [x] [Review][Patch] F11 — Release : inverser ordre migration/build → build d'abord, migration ensuite, promote en dernier [`release.yml:31-48`]
- [x] [Review][Patch] F12 — `vercel promote` : ajouter lookup deployment ID par SHA + `--deployment-id` [`release.yml:46-48`]
- [x] [Review][Patch] F13 — DSN client : utiliser `NEXT_PUBLIC_GLITCHTIP_DSN` dans `sentry.client.config.ts` + `.env.example` [`sentry.client.config.ts:4`]

**Patch:**

- [x] [Review][Patch] F1 — `process.exit(0)` masque les échecs → `process.exit(1)` [`scripts/budget-alert.ts:157`]
- [x] [Review][Patch] F2 — Secrets interpolés dans `run:` (injection risk) → passer via `env:` [`release.yml:34`, `ci.yml:62`]
- [x] [Review][Patch] F3 — Non-null assertions `!` sur env vars sans validation → fail-fast en début de `main()` [`scripts/budget-alert.ts:20-93`]
- [x] [Review][Patch] F4 — Pas de timeout sur fetch → `AbortSignal.timeout(30_000)` [`scripts/budget-alert.ts:13-16`]
- [x] [Review][Patch] F5 — Mirror : échec d'un remote skip l'autre → `continue-on-error: true` par step [`mirror.yml:23-31`]
- [x] [Review][Patch] F6 — `JSON.stringify` crashe sur ref circulaire → try/catch fallback [`lib/logger.ts:27`]
- [x] [Review][Patch] F7 — Polling preview ne détecte pas état ERROR → check `state=ERROR` [`ci.yml:63-66`]
- [x] [Review][Patch] F8 — CI Lighthouse gaspille 5 min si `VERCEL_TOKEN` absent → pre-check [`ci.yml:59-60`]
- [x] [Review][Patch] F9 — `sendBrevoAlert` failure non gérée → try/catch + `::warning::` [`scripts/budget-alert.ts:148`]

**Deferred:**

- [x] [Review][Defer] F14 — Projection jour-1 non fiable (extrapolation linéaire, limitation connue) [`scripts/budget-alert.ts:129`] — deferred, design limitation
- [x] [Review][Defer] F15 — `cacheComponents: true` option Next.js non standard (story 1-1) [`next.config.ts:5`] — deferred, pre-existing
- [x] [Review][Defer] F16 — Estimation R2 basée uniquement sur nombre de buckets (limitation API) [`scripts/budget-alert.ts:63-66`] — deferred, needs different API endpoint
- [x] [Review][Defer] F17 — Vercel API v1/usage format incertain [`scripts/budget-alert.ts:40-43`] — deferred, needs verification with actual API
- [x] [Review][Defer] F18 — Domaine expéditeur Brevo (`noreply@darna.app`) non vérifié [`scripts/budget-alert.ts:97`] — deferred, ops config

---

## Dev Notes

### Architecture compliance — règles non-négociables pour cette story

[Source: architecture.md#Infrastructure-Deployment, architecture.md#Implementation-Patterns]

1. **4 workflows GitHub Actions** (AR25) : `ci.yml`, `release.yml`, `mirror.yml`, `budget-alert.yml`. Noms exacts, pas de variante.
2. **GlitchTip Cloud EU** (AR26) : compatible Sentry SDK. DSN format `https://<key>@app.glitchtip.com/<id>`. **Free tier 1000 events/mois** — suffisant au MVP.
3. **Lighthouse CI seuils** (AR27) : PWA >= 0.90, Accessibility >= 0.95, Performance >= 0.80 (4G throttle). Scores en **floats 0-1**, pas en pourcentage.
4. **Sourcemaps** (AR26) : uploadées via `withSentryConfig()` dans `next.config.ts` **en CI uniquement** (conditionné par `SENTRY_AUTH_TOKEN`). En dev local, pas d'upload.
5. **Logger JSON structuré** (AR19) : `lib/logger.ts`, jamais de PII dans `payload`, corrélation via `request_id` (header `X-Darna-Request-Id`).
6. **Console.log banni** (AR23) : ESLint rule `no-console` (déjà configurée par story 1.1). `lib/logger.ts` est l'unique point d'entrée pour le logging.
7. **Zéro analytics client** (NFR16) : Vercel Analytics/Speed Insights désactivés. Aucun tracking côté navigateur.
8. **Node 22** : Node 20 a atteint EOL en avril 2026 et a été retiré des runners Ubuntu. Utiliser Node 22 LTS dans tous les workflows et le `.nvmrc`.

### Versions verrouillées (recherche web mai 2026)

[Source: architecture.md#Versions-vérifiées + recherche web actualisée]

| Paquet                 | Version         | Note                                                                                         |
| ---------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| `@sentry/nextjs`       | `^10.53`        | v10 compatible Next.js 16 + GlitchTip. Migration depuis v8 : OpenTelemetry deps v2, FID→INP. |
| `@lhci/cli`            | `0.15.x`        | Bundles Lighthouse 12.6.1. Requiert Node 18+.                                                |
| `tsx`                  | `^4`            | Exécution scripts TypeScript (budget-alert.ts). Alternative à ts-node, zéro config.          |
| Node.js                | `22`            | LTS courant. Node 20 EOL avril 2026, retiré des runners GitHub.                              |
| GitHub Actions runners | `ubuntu-latest` | Résout vers Ubuntu 24.04.                                                                    |

### GlitchTip Cloud EU — setup et configuration

[Source: architecture.md#Observabilité-errors, AR26]

- **Provider** : GlitchTip Cloud ([app.glitchtip.com](https://app.glitchtip.com)) — hébergé en Allemagne (EU).
- **Free tier** : 1000 events/mois, projets et membres illimités. Suffisant au MVP (~150 users, erreurs rares).
- **SDK** : `@sentry/nextjs` — drop-in compatible. Seul le DSN change (`https://...@app.glitchtip.com/...` au lieu de `@sentry.io`).
- **Sourcemaps** : uploadées via `withSentryConfig()` qui auto-upload pendant `next build` si `SENTRY_AUTH_TOKEN` est défini. GlitchTip accepte les mêmes API d'upload que Sentry.
- **Replay** : **désactivé** (`replaysSessionSampleRate: 0`). Privacy-first NFR16 — pas d'enregistrement de session.
- **Config Next.js 16** : `instrumentation.ts` avec `register()` + `onRequestError` (requis depuis Sentry SDK >= 8.28).

**Setup compte GlitchTip (pré-requis avant dev)** :

1. Créer un compte sur app.glitchtip.com
2. Créer un projet "Darna" → copier le DSN
3. Générer un auth token pour l'upload de sourcemaps
4. Stocker DSN dans `.env.local` + dans Vercel env vars
5. Stocker auth token dans GitHub Actions secrets (`SENTRY_AUTH_TOKEN`)

### Budget alerting — détails d'implémentation

[Source: architecture.md#Budget-alerting, AR28]

Le script `scripts/budget-alert.ts` est un **script standalone** exécuté par GitHub Actions. Il n'est pas une Server Action ni un Route Handler — il vit en dehors de l'app Next.js.

**APIs des providers (endpoints vérifiés mai 2026)** :

- **Supabase** : `GET https://api.supabase.com/v1/projects/{ref}/usage` (header `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>`)
- **Vercel** : `GET https://api.vercel.com/v1/usage?teamId={teamId}` (header `Authorization: Bearer <VERCEL_TOKEN>`)
- **Cloudflare R2** : `GET https://api.cloudflare.com/client/v4/accounts/{id}/r2/buckets` (header `Authorization: Bearer <R2_API_TOKEN>`)
- **Brevo** : `GET https://api.brevo.com/v3/account` (header `api-key: <BREVO_API_KEY>`)

**Seuils d'alerte** (configurables via env vars du workflow) :

- `BUDGET_THRESHOLD_MVP=15` (EUR)
- `BUDGET_THRESHOLD_GROWTH=50` (EUR)
- `ALERT_EMAIL=henry.stephane@gmail.com`

**Format e-mail** :

```
Subject: [Darna] Alerte budget — coût estimé {XX} EUR/mois
Body:
  Supabase: {X} EUR (bandwidth: {Y} GB, storage: {Z} GB)
  Vercel: {X} EUR (invocations: {Y}, bandwidth: {Z} GB)
  R2: {X} EUR (storage: {Y} GB, operations: {Z})
  Brevo: {X} EUR (emails: {Y}/{Z})
  TOTAL ESTIMÉ: {XX} EUR/mois
  Seuil actuel: {THRESHOLD} EUR
```

### Lighthouse CI — pipeline détaillé

[Source: architecture.md#Observabilité-perf, AR27]

**Challenge** : Lighthouse CI doit tourner contre la preview URL Vercel, qui n'est disponible qu'après le déploiement. Deux approches :

1. **`deployment_status` trigger** : le workflow écoute `deployment_status.state == 'success'` envoyé par l'intégration Vercel GitHub. Avantage : pas besoin de poll. Inconvénient : trigger séparé du `pull_request`.
2. **Wait for deployment dans le job** : le job CI attend la preview URL via l'API Vercel (`GET /v13/deployments?projectId=...&state=READY&meta.githubCommitSha=...`). Plus simple à coordonner.

**Recommandation** : approche 2 avec un timeout raisonnable (5 min max). Script inline dans le workflow qui poll l'API Vercel toutes les 15s.

**Note importante** : au stade Story 1.2, le site n'a que la page starter Supabase par défaut. Les seuils Lighthouse seront probablement **non atteints** (pas de manifest PWA ni pages publiques optimisées). Configurer le job Lighthouse avec `continue-on-error: true` et un commentaire clair indiquant que le seuil sera bloquant à partir de Story 1.4+.

### Release workflow — séquence précise

[Source: architecture.md#Migration-Release-flow]

Séquence déclenchée par un tag `release-vX.Y.Z` :

1. `supabase db push --linked` (applique les migrations SQL non encore appliquées en prod)
2. `pnpm build` (le build Vercel est déjà fait par le déploiement auto, mais on a besoin des sourcemaps)
3. Upload sourcemaps vers GlitchTip (via `SENTRY_AUTH_TOKEN`)
4. `vercel promote <deployment-url> --yes` (promote la preview Vercel la plus récente vers production)

**Note** : `supabase db push --linked` nécessite `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` en secrets GitHub. Le `supabase` CLI doit être installé dans le workflow (`npx supabase@latest`).

### Mirror workflow — sécurité des tokens

[Source: architecture.md#Git-mirror, NFR29]

- `git push --mirror --force` remplace **tout** le contenu du remote. Si les tokens sont compromis, le pire cas est une sur-écriture du mirror (pas de l'origin).
- Tokens à durée de vie longue (PAT GitLab, PAT Codeberg) — **lecture/écriture repo uniquement**, pas de scope admin.
- Les repos doivent être créés manuellement **avant** d'activer le workflow.
- `fetch-depth: 0` est requis pour avoir l'historique complet à mirrorer.

### Previous Story Intelligence (Story 1-1)

[Source: _bmad-output/implementation-artifacts/1-1-initialisation-projet-toolchain-de-developpement.md]

Story 1-1 a bootstrappé la toolchain de base. État pertinent pour cette story :

**Fichiers déjà créés par Story 1-1 (à ne pas recréer/écraser)** :

- `lib/env.ts` — parse `GLITCHTIP_DSN` via Zod (AC5 story 1.1). **Ne pas modifier** le schéma Zod de l'app — les tokens Sentry CI sont des secrets GitHub Actions, pas des env vars runtime.
- `lib/validation/*.ts` + tests — intacts, `pnpm test` doit rester vert après ajout de `lib/logger.test.ts`
- `.env.example` — contient déjà `GLITCHTIP_DSN=` dans le bloc GlitchTip. Ajouter les variables CI-only.
- `eslint.config.mjs` — règle `no-console` potentiellement déjà configurée. `lib/logger.ts` utilise `console.log` directement → ajouter une exception ESLint inline `// eslint-disable-next-line no-console` sur l'appel `console.log(JSON.stringify(output))` dans le logger uniquement.
- `next.config.ts` — contient `cacheComponents: true`. Wrapper avec `withSentryConfig()`.
- `package.json` — scripts `dev`, `build`, `start`, `lint` existent. Pas de `typecheck`, `test`, `test:watch`, `e2e`, `gen:types`, `dev:webpack`, `prepare` dans le package.json actuel (story 1.1 en cours). **Vérifier** si ces scripts existent quand story 1.2 démarre — sinon les ajouter.

**Patterns établis à respecter** :

- Fichiers kebab-case `.ts` dans `lib/`
- Tests co-localisés `*.test.ts`
- TypeScript strict, pas de `any` sans `// reason:`
- Prettier 3.x (`tabWidth: 2, singleQuote: true, trailingComma: 'all'`)

### Out-of-scope (NE PAS livrer dans cette story)

| Élément                                       | Story | Raison                                                |
| --------------------------------------------- | ----- | ----------------------------------------------------- |
| `e2e/security-rls.spec.ts` (tests RLS)        | 1.10  | Hardening — nécessite le schéma DB (story 1.3)        |
| `e2e/a11y.spec.ts` (tests axe-core)           | 1.10  | Hardening — nécessite les pages publiques (story 1.4) |
| Headers sécurité `next.config.ts` (CSP, HSTS) | 1.10  | Hardening                                             |
| Rate limiting Upstash                         | 1.10  | Hardening                                             |
| ADRs `0001-0008`                              | 1.10  | Documentation hardening                               |
| Pages publiques `/`, `/manifesto`, etc.       | 1.4   | i18n shell                                            |
| `app/manifest.ts` + `sw/index.ts`             | 1.5   | PWA                                                   |
| `lib/email/` Brevo client (app runtime)       | 1.6   | Magic link                                            |
| `scripts/invite-co-mods.ts`                   | 1.10  | Procédure ops post-deploy                             |
| `weekly-backup` Edge Function + cron          | 1.10  | Backup Supabase → R2                                  |

### Project Structure Notes

Fichiers créés par cette story :

```
SmartResidence/
├── .github/
│   └── workflows/
│       ├── ci.yml                     # NEW — AC1, AC2
│       ├── release.yml                # NEW — AC6
│       ├── mirror.yml                 # NEW — AC7
│       └── budget-alert.yml           # NEW — AC5
├── instrumentation.ts                 # NEW — AC3
├── sentry.server.config.ts            # NEW — AC3
├── sentry.edge.config.ts              # NEW — AC3
├── sentry.client.config.ts            # NEW — AC3
├── .lighthouserc.json                 # NEW — AC2
├── vercel.json                        # NEW — AC4
├── .nvmrc                             # NEW — T8
├── lib/
│   └── logger.ts                      # NEW — AC8
│   └── logger.test.ts                 # NEW — AC8
├── scripts/
│   └── budget-alert.ts               # NEW — AC5
├── next.config.ts                     # UPDATED — wrapper withSentryConfig()
├── package.json                       # UPDATED — ajout @sentry/nextjs, tsx
└── .env.example                       # UPDATED — ajout bloc CI-only
```

**Alignement avec l'architecture** : [Source: architecture.md:706-994]

- `instrumentation.ts` est à la racine (convention Next.js)
- `lib/logger.ts` est dans `lib/` (convention projet)
- `.github/workflows/` suit la convention GitHub Actions standard
- `scripts/budget-alert.ts` est dans `scripts/` (convention projet)

### References

- **Story complète (epic)** : [Source: _bmad-output/planning-artifacts/epics.md:435-472]
- **Infrastructure & Deployment** : [Source: _bmad-output/planning-artifacts/architecture.md:322-338]
- **Observabilité GlitchTip** : [Source: _bmad-output/planning-artifacts/architecture.md:332, AR26]
- **Lighthouse CI seuils** : [Source: _bmad-output/planning-artifacts/architecture.md:333, AR27]
- **Budget alerting** : [Source: _bmad-output/planning-artifacts/architecture.md:335, AR28]
- **Git mirror** : [Source: _bmad-output/planning-artifacts/architecture.md:337, NFR29]
- **Logger JSON structuré** : [Source: _bmad-output/planning-artifacts/architecture.md:509-527, AR19]
- **Release workflow** : [Source: _bmad-output/planning-artifacts/architecture.md:1126-1132]
- **CI workflow** : [Source: _bmad-output/planning-artifacts/architecture.md:329, AR25]
- **Vercel Analytics désactivé** : [Source: _bmad-output/planning-artifacts/epics.md:455-456, NFR16]
- **Naming conventions** : [Source: _bmad-output/planning-artifacts/architecture.md:368-409]
- **Story précédente (1-1)** : [Source: _bmad-output/implementation-artifacts/1-1-initialisation-projet-toolchain-de-developpement.md]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context)

### Debug Log References

- `next.config.ts` : option `disableSourceMapUpload` n'existe pas dans `@sentry/nextjs` v10. Corrigé en `sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN }`.
- `scripts/budget-alert.ts` : 4 warnings ESLint `no-console` — corrigé avec `/* eslint-disable no-console */` (script standalone).

### Completion Notes List

- T1 : `@sentry/nextjs@10.53.1` installé. 4 fichiers Sentry config créés (server, edge, client, instrumentation). `next.config.ts` wrappé avec `withSentryConfig()` — sourcemaps conditionnées par `SENTRY_AUTH_TOKEN`.
- T2 : `lib/logger.ts` — logger JSON structuré avec capture Sentry auto sur level `error`. 3 tests unitaires verts.
- T3 : `vercel.json` avec analytics et speedInsights désactivés. Aucune dépendance `@vercel/analytics` présente.
- T4 : `ci.yml` — 2 jobs (lint-typecheck-test + lighthouse). Actions SHA-pinnées. Lighthouse en `continue-on-error: true` (pages publiques story 1.4+).
- T5 : `release.yml` — tag `release-*` trigger, migrations Supabase + build sourcemaps + promote Vercel.
- T6 : `mirror.yml` — cron horaire, mirror vers GitLab et Codeberg.
- T7 : `budget-alert.ts` + `budget-alert.yml` — cron quotidien, 4 providers, alerte Brevo si > 15 EUR.
- T8 : `.nvmrc` 20→22, `@types/node` ^20→^22, `.env.example` + bloc CI-only Sentry.
- T9 : typecheck vert, lint propre, 19 tests verts, dev boot OK, YAML valides, 0 imports Vercel Analytics.

### Change Log

- 2026-05-24 : Implémentation complète story 1.2 — 4 workflows CI/CD, GlitchTip observabilité, Lighthouse CI, logger JSON structuré, budget alerting, mirror anti-bus-factor.

### File List

**Nouveaux fichiers :**

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/mirror.yml`
- `.github/workflows/budget-alert.yml`
- `.lighthouserc.json`
- `vercel.json`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `sentry.client.config.ts`
- `instrumentation.ts`
- `lib/logger.ts`
- `lib/logger.test.ts`
- `scripts/budget-alert.ts`

**Fichiers modifiés :**

- `next.config.ts` — wrappé avec `withSentryConfig()`
- `package.json` — ajout `@sentry/nextjs`, `tsx`, `@types/node` ^22
- `pnpm-lock.yaml` — mis à jour
- `.env.example` — ajout bloc CI-only Sentry
- `.nvmrc` — 20→22
