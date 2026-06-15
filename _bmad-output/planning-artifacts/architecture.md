---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-05-17'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief-SmartResidence.md
  - _bmad-output/planning-artifacts/product-brief-SmartResidence-distillate.md
  - _bmad-output/brainstorming/brainstorming-session-2026-05-05-1442.md
  - LocalVault/01-PROJECTS/Darna/decisions.md
  - LocalVault/01-PROJECTS/Darna/open-questions.md
project_name: 'Darna'
codename_repo: 'SmartResidence'
user_name: 'Stephane'
date: '2026-05-11'
---

# Architecture Decision Document — Darna

_Document construit collaborativement étape par étape. Les sections s'ajoutent au fur et à mesure des décisions architecturales._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (55 FRs en 9 familles)** :

- **Admission & Auth** (FR1-11) — magic link, file d'attente, validation manuelle co-mod, sessions 12 mois, droit d'effacement < 7j
- **Annuaire artisans** (FR12-22) — recherche full-text + filtres typés, fiche structurée, action `tel:`, consentement asynchrone artisan, notation typée multi-axes, pseudonyme par défaut
- **Contenu durable** (FR23-26) — Guide résident FAQ, Numéros utiles, Pack accueil
- **Contenu éphémère** (FR27-30) — Alertes auto-expirantes, Bons plans expirables
- **Modération** (FR31-35) — signalement, retrait, journal public, escalade juridique
- **Partage WhatsApp** (FR36-39) — URLs canoniques, deep linking, copie 1-tap
- **Notifications** (FR40-43) — 3 catégories opt-in, Web Push + fallback e-mail
- **Engagement léger** (FR43b-c) — 👍 sans modal, suggestion privée co-mods
- **PWA/i18n/A11y** (FR44-50) — page `/install` OS-aware, offline lecture, bascule FR/AR
- **Données & Conformité** (FR51-55) — compteurs publics agrégés, export RGPD, purge logs 30j

**Non-Functional Requirements (55 NFRs)** — drivers majeurs : Performance (FCP < 1.5s 4G, bundle < 150KB), Security/Privacy (TLS 1.3, juridiction UE stricte, zéro cookie tiers, soft-delete + audit), Scalability (150 users, ≤ 15€/mois MVP, multi-tenant paramétrable), Reliability (99% 7h-23h, mirror Git, runbook), Accessibility (Lighthouse ≥ 95, règle Aïcha 30s, « Geste = WhatsApp »), i18n (FR/AR + RTL via CSS logical properties), Maintainability (MIT public J1, Lighthouse CI, ADR).

### Scale & Complexity

- **Primary domain** : PWA full-stack (SPA + service worker + BaaS managé Supabase + storage R2)
- **Complexity level** : `medium` éclatée — fonctionnelle `low`, compliance `high`, a11y/i18n `high`, scaling `low`
- **Composants architecturaux estimés** : ~12-15
- **Cible utilisateurs** : 150 villas MVP, ~10 inscriptions/heure en pic

### Architectural Drivers (boussoles non-négociables)

8 vérités fondamentales qui doivent **pondérer toute décision architecturale** :

| Driver                                   | Combine                                                                                      | Implication                                                                                                                                                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1 — Sovereign data envelope**         | CNDP+RGPD double juridiction · communauté nominative · transparence radicale · privacy-first | Hébergement EU exclusif + DPA sous-traitants + RLS Postgres + soft-delete + audit log redacté + zéro service hors EU                                                                                                                                                  |
| **D2 — Perceived reactivity baseline**   | Règle Aïcha 30s · 4G médian MA · douleur tiède (rien ne presse)                              | Bundle < 150KB + cache HTTP agressif + SW app shell + optimistic UI. **Offline complet = bonus de confort, pas baseline.**                                                                                                                                            |
| **D3 — Linkable persistent identity**    | Cohabitation WhatsApp · mémoire structurée comme valeur centrale                             | URL canonique HTML standard par entité, stable, copiable. PWA install = couche de confort qui s'ajoute (les pages doivent fonctionner même non-installées)                                                                                                            |
| **D4 — Right-sized tenancy discipline**  | 150 users MVP · V3 multi-résidences = vision pas engagement                                  | **(a)** Colonne `residence_id` + scoping query au MVP (cheap). **(b)** RLS multi-resid + auth multi-resid déférés à V3 (cher).                                                                                                                                        |
| **D5 — Vendor-portable foundation**      | Solo dev · anti-bus-factor · bien commun MIT                                                 | Postgres standard + Web standards (SW, Push, manifest) + couche framework minimisée. Vercel functions = lock-in à mesurer. **Le choix Next.js doit être pondéré par la portabilité, pas pré-arbitré.**                                                                |
| **D6 — Cost as design pressure**         | Budget free-tier ≤ 15€/mois MVP · poste variable critique = SMS                              | SMS = à minimiser. E-mail = privilégier. **Magic link MVP = e-mail-only par défaut** ; SMS réservé au consentement artisan (où il est obligatoire car pas de compte permanent). **Notifications MVP = e-mail-only** ; Web Push différé V1.5 si bêta révèle le besoin. |
| **D7 — Bilingual-by-data-model**         | FR/AR + RTL · tags artisans bilingues structurés                                             | Tags artisans = entité bilingue dans le schéma BDD. UI i18n par-dessus. RTL via CSS logical properties + `dir="rtl"` conditionnel. Zéro chaîne hardcodée.                                                                                                             |
| **D8 — Recoverable by another solo dev** | Anti-bus-factor structurel · doc fork V1.5 · solo dev temps perso                            | Chaque choix tech pondéré par « solo dev tiers reprend en < 1 mois ». Standards > magie framework. Mirror Git auto. Secrets manager partagé co-mods. Runbook écrit.                                                                                                   |

### Architectural Constraints (hard requirements)

Décisions déjà prises et figées dans le PRD/decisions — non-révisables dans ce workflow :

| Catégorie    | Contrainte                                                                              | Source              |
| ------------ | --------------------------------------------------------------------------------------- | ------------------- |
| Souveraineté | Hébergement EU exclusif (Supabase `eu-central-1`, Vercel `fra1`, R2 `eu`, registrar EU) | Decision 2026-05-05 |
| Domaine      | `darna.org` chez registrar UE (Gandi/OVH/Porkbun)                                       | Decision 2026-05-10 |
| Auth         | Magic link uniquement (e-mail OU SMS au choix), zéro mot de passe, sessions 12 mois     | Decision 2026-05-05 |
| Admission    | File d'attente → validation manuelle 1/3-4 admins                                       | Decision 2026-05-07 |
| Frontend     | PWA installable SPA, pas de mobile natif, page `/install` OS-aware                      | NFR + hors-scope    |
| Open source  | MIT dès J1, GitHub + mirror GitLab/Codeberg < 24h                                       | Decision 2026-05-05 |
| Mesure       | Compteurs serveur agrégés uniquement, zéro analytics client                             | NFR16/52            |

### Architectural Decisions Deferred to This Workflow

À trancher dans les steps suivants — pondérées par les 8 drivers :

- **Framework PWA** (Next.js 14 App Router vs Vite + React vs SvelteKit) — D5 (portabilité) vs écosystème mature solo dev
- **Provider e-mail transactionnel** (Postmark EU / Resend EU / autre) — D1 + D6
- **Provider SMS** (Twilio EU / MessageBird / local MA conforme CNDP) — D1 + D6 (poste variable critique)
- **Stratégie URLs multilingues** (`/fr/`, `/ar/` vs param vs négociation Accept-Language) — D3 + D7 + SEO
- **Mécanisme search annuaire** — _pré-arbitré Postgres FTS au MVP_ (7500 entrées max, suffit) ; à confirmer
- **Stratégie temps réel** — _pré-arbitrée polling à l'ouverture pour co-mods + pas de WebSocket au MVP_ (D5 + D6) ; à confirmer
- **Web Push** — _pré-arbitré déféré V1.5_ (D6 + iOS<16.4 fallback obligatoire de toute façon) ; à confirmer
- **Tooling service worker** (Workbox vs implémentation directe) — D5 + D8

### Cross-Cutting Concerns (manifestations des drivers)

Préoccupations transverses (≥ 3 modules) issues de l'analyse PRD + pre-mortem + first principles :

| #   | Concern                                                                                                                     | Driver(s) ancrant |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | i18n FR/AR + RTL (UI, contenu, SMS templates, slugs, SEO `hreflang`)                                                        | D7                |
| 2   | A11y WCAG AA + règle Aïcha 30s + « Geste = WhatsApp »                                                                       | D2                |
| 3   | Auth & rôles vérifiés serveur (RLS Postgres)                                                                                | D1                |
| 4   | Consentement & droit de réponse artisan (workflow async 2 étapes)                                                           | D1, D6            |
| 5   | Soft-delete + journal public d'audit                                                                                        | D1                |
| 6   | Effacement RGPD < 7j avec cascade contributions                                                                             | D1                |
| 7   | URLs canoniques + deep linking                                                                                              | D3                |
| 8   | Offline lecture (cache HTTP + SW app shell)                                                                                 | D2                |
| 9   | Multi-tenant `residence_id` discipline (J1 cheap, RLS V3)                                                                   | D4                |
| 10  | Privacy-first observability (compteurs agrégés serveur, purge logs 30j)                                                     | D1                |
| 11  | Anti-bus-factor & recovery (mirror Git, secrets, runbook)                                                                   | D8                |
| 12  | Cost gate sur chaque décision                                                                                               | D6                |
| 13  | **Anchored ergonomic baseline** — appareil de référence nominal + scope Aïcha pré-connexion + patterns WhatsApp décomposés  | D2                |
| 14  | **CNDP/RGPD operational gates** — DPA sous-traitants + log sanitization + journal public redaction + provider checklist     | D1                |
| 15  | **Recoverability profile** — chaque choix tech évalué « solo dev tiers reprend en < 1 mois »                                | D5, D8            |
| 16  | **Server-side observability** — error tracking + perf traces + budget alerting, distincts du privacy-first client           | D6, D8            |
| 17  | **Multi-tenancy operational concerns** — slug namespace, RLS scoping convention, cross-tenant policies, account portability | D4                |
| 18  | **Cost envelope per component** — free tier seuils chiffrés + postes variables identifiés (SMS, egress, search reindex)     | D6                |
| 19  | **Tombstone & redaction policy** — sort des URLs canoniques sur entités supprimées + scope du journal public                | D1, D3            |
| 20  | **Asynchronous workflow lifecycle** (consentement artisan) — états + timeouts + retry + visibilité par rôle                 | D1, D6            |

### Architectural Risk Register (pre-mortem-derived)

7 scénarios d'échec à 12 mois post-lancement à conserver comme guidons pendant les décisions suivantes :

| #   | Scénario                                                       | Causes-racine                                                                                                                                                           | Driver(s) à invoquer |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| R1  | Aïcha n'a jamais ouvert Darna seule (bêta validée, prod ratée) | Scope ergonomique pré-connexion non borné · « Geste = WhatsApp » non décomposé · pas d'appareil référence nominal                                                       | D2 + CC #13          |
| R2  | CNDP ouvre un dossier (logs serveur contenaient e-mails)       | Catégorisation flux nominatifs incomplète · journal public expose noms co-mods · DPA sous-traitants non listés · critère « provider conforme CNDP » flou                | D1 + CC #14          |
| R3  | Stephane craque mois 8 ; contact secours ne reprend pas        | Stack trop magique (Next.js App Router + RSC + Workbox + i18n RTL = expertise rare MA) · doc fork différée V1.5 sans pression J1                                        | D5 + D8 + CC #15     |
| R4  | Perf dégrade à 100 villas sans visibilité                      | Privacy-first client confondue avec absence d'observabilité serveur · NFR9 sans pipeline · error tracking absent                                                        | D6 + CC #16          |
| R5  | Refactor multi-tenant V3 massif                                | `residence_id` activable annoncé sans préciser slug namespace, RLS scoping, account portability                                                                         | D4 + CC #17          |
| R6  | Coût explose à 60€/mois mois 7                                 | SMS = poste variable non borné · free tier seuils non chiffrés · egress R2 sur deep links viraux non évalué                                                             | D6 + CC #18          |
| R7  | Signalement viralisé via screenshot — doxxing inverse          | Journal public sans politique de redaction · sort des URLs canoniques sur entités retirées non défini · signalement abusif (harassment via file modération) non analysé | D1 + D3 + CC #19     |

## Starter Template Evaluation

### Primary Technology Domain

PWA full-stack (Next.js App Router + Supabase BaaS + R2 storage). Confirmé par PRD + drivers D1-D8.

### Versions vérifiées (recherche web mai 2026)

- **Next.js 16.2** — dernière stable (mai 2026). Patches de sécurité majeurs publiés en mai 2026 (13 CVEs corrigés) — partir sur 16.2 patché.
- **Turbopack** — bundler par défaut depuis Next 16. Compilations dev rapides ; _caveat PWA_ : Serwist désactivé en dev sous Turbopack → lancer `next dev --webpack` pour tester le service worker localement, la prod marche normalement.
- **Clés Supabase** — migration des anciennes `anon`/`service_role` vers `sb_publishable_xxx`/`sb_secret_xxx`. Adopter les nouvelles dès J1.

### Starter Options Considered

| Option                                                            | Évaluation                                                                                                                                                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`with-supabase` (template officiel Vercel/Supabase)** ✅ Retenu | Maintenu officiellement par les deux vendors. Couvre Next.js 16 + TypeScript + Tailwind 4 + Auth cookies + `@supabase/ssr`. Démo en prod. Surface couverte / magie ratio optimal. Conforme à D8 (recoverabilité). |
| `Nextbase Lite` (imbhargav5)                                      | Bon mais ajoute du SaaS-boilerplate (paiements, dashboards) inutile au MVP. Viole D2 (bundle) et D8 (surface à comprendre).                                                                                       |
| `supa-next-starter` (michaeltroya)                                | Inclut shadcn/ui (intérêt à terme) mais opinionatedness Tailwind + Radix lourde pour solo dev apprenti. Composants UI reportables en V1.5.                                                                        |
| `nextjs-pwa-template` (AjayKanniyappan)                           | PWA bien câblée mais sans Supabase — démarrer ici = re-câbler l'auth nous-mêmes (anti-D8).                                                                                                                        |

### Selected Starter: `with-supabase` (template officiel Vercel/Supabase)

**Rationale for Selection :**

- **Officiel + maintenu** par Vercel + Supabase → conforme à D8 (un solo dev tiers peut reprendre, la doc est à jour côté éditeur)
- **Couvre ~70% de notre stack en zéro config** : Next.js 16 + TypeScript + Tailwind 4 + Supabase Auth cookies + `@supabase/ssr`
- **Les 30% restants** (PWA, i18n FR/AR, tests) s'ajoutent par-dessus en 3 paquets standards — pas de fork du starter, pas de patch
- **Cookie-based auth via `@supabase/ssr`** = critique pour Server Components Next 16 App Router (sessions accessibles côté serveur sans round-trip client)
- **Permet `signInWithOtp()`** pour magic link e-mail (notre D6 — magic link e-mail-only au MVP)

### Briques manquantes à ajouter par-dessus

Le starter de base ne couvre pas 3 briques critiques pour Darna. Solutions retenues (versions vérifiées mai 2026) :

| Brique                               | Paquet                                                                                                          | Pourquoi celui-là                                                                                                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PWA (manifeste + service worker)** | `@serwist/next` + `@serwist/precaching` + `@serwist/sw` + `idb`                                                 | Successeur officiel de `next-pwa` (qui n'est plus maintenu). Compatible Next 16 + Turbopack. Cache offline + app shell + manifeste. Couvre D2 (perceived reactivity) et FR45 (offline lecture). |
| **i18n FR/AR + RTL**                 | `next-intl`                                                                                                     | 2KB. Server Components natifs. Routing par locale (`/fr/...` `/ar/...`). Gère `dir="rtl"` selon la locale. Couvre D7 (bilingual-by-data-model) et D2 (bundle léger).                            |
| **Tests + E2E**                      | `vitest` + `@vitejs/plugin-react` + `@testing-library/react` + `@testing-library/jest-dom` + `@playwright/test` | Vitest = rapide, compatible Vite engine. Playwright = supporte iOS Safari simulator (critique pour tester `/install` flow Journey 3).                                                           |

### Initialization Command

Composition en 2 étapes :

```bash
# Étape 1 : créer le projet de base avec le starter officiel
npx create-next-app@latest --example with-supabase darna

# Étape 2 : ajouter les 3 briques manquantes
cd darna
npm install @serwist/next @serwist/precaching @serwist/sw idb next-intl
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @playwright/test
npx playwright install
```

### Architectural Decisions Provided by Starter

**Langage & runtime :**

- TypeScript strict (config par défaut Next.js)
- Node.js runtime côté serveur ; Edge runtime à pondérer cas par cas pour D5 (portabilité)

**Styling :**

- **Tailwind CSS 4** — utility-first. Match parfait avec la règle Aïcha (contrôle pixel-près des contrastes WCAG AA, espacements, cibles tactiles ≥ 48×48px). Match parfait avec RTL via `me-4` / `ps-2` (margin-end, padding-start) qui s'inversent automatiquement selon `dir="rtl"`.

**Build & bundler :**

- **Turbopack** (défaut Next 16). Hot reload rapide.
- _Caveat dev PWA_ : Serwist désactivé sous Turbopack en dev → utiliser `next dev --webpack` quand on travaille sur le service worker. La prod (`next build`) fonctionne normalement.

**Testing :**

- Unit + composants : **Vitest** (rapide, watch mode, compatible Vite)
- E2E : **Playwright** (iOS Safari simulator + Android Chrome via webkit/chromium drivers)
- Aucun framework de tests dans le starter de base → ajout via étape 2

**Code organization (App Router + i18n + PWA composés) :**

```
darna/
├── app/                    # Routes Next.js App Router (chaque dossier = une URL)
│   ├── [locale]/          # Wrapping i18n (fr / ar)
│   ├── api/               # Routes serveur (auth callbacks, webhooks consentement)
│   ├── manifest.ts        # Manifeste PWA (icônes, theme color)
│   └── layout.tsx         # Layout racine
├── components/             # Composants React partagés
├── lib/                    # Logique métier non-UI
│   ├── supabase/          # Clients server / client / middleware (depuis starter)
│   └── i18n/              # Config next-intl
├── messages/               # Traductions (fr.json, ar.json)
├── public/                 # Assets statiques (icônes PWA, robots.txt, sitemap.xml)
├── sw/                     # Source service worker (Serwist)
├── tests/                  # Vitest unit + composants
├── e2e/                    # Playwright scénarios bout-en-bout
└── middleware.ts           # Routing i18n + Auth guards
```

**Development Experience :**

- Hot reload Turbopack (rapide en dev)
- Type-safe Supabase via `supabase gen types typescript` (types DB générés depuis le schéma)
- Lint+Format avec ESLint + Prettier par défaut Next
- Vitest watch mode + Playwright UI mode

### Trade-offs documentés (re-pondérables si signal en bêta)

Le choix de Next.js App Router introduit un couplage Vercel modéré (Edge runtime, `next/image` optimization, ISR). Driver D5 (portabilité) appliqué via :

- Éviter Vercel-specific APIs quand un standard existe (préférer Server Actions standards à `vercel/og` etc.)
- Documenter dans le runbook les chemins de migration possibles (Cloudflare Pages + Workers, ou pull la stack en self-host Postgres + Node)
- ADR systématique pour toute dépendance Vercel-specific

### Note pour le step suivant

L'initialisation du projet via la commande ci-dessus sera la **première story d'implémentation**. Les choix faits par le starter (TS strict, Tailwind 4, App Router, Supabase Auth cookies, `@supabase/ssr`, Turbopack) ne seront pas redébattus dans les ADRs à venir — ils sont actés par ce choix de starter. Les ADRs à venir traitent les décisions **par-dessus** : modèle de données, RLS Postgres, providers e-mail/SMS, stratégie de slugs i18n, politique soft-delete, etc.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation)** :

- Database engine + provider, authentification, e-mail provider, validation runtime, RLS Postgres, gouvernance migrations, patrons API, stratégie i18n URLs, stratégie slugs

**Important Decisions (Shape Architecture)** :

- State management, observabilité serveur, rate limiting, caching, logger, discipline multi-tenant J1

**Deferred Decisions (Post-MVP)** :

- Web Push (V1.5 si bêta révèle le besoin · iOS Safari < 16.4 fallback obligatoire)
- SMS magic link pour résidents (V1.5 — au MVP, SMS réservé au consentement artisan)
- Drizzle ORM (V1.5 si complexité queries justifie · Supabase CLI continue à gouverner migrations)
- Zustand client store (V1.5 si état UI client justifie)
- Pino logger structuré (V1.5 si volume justifie)
- Upstash Redis rate limiting (si les 3 couches gratuites s'avèrent insuffisantes)
- RLS multi-résidence isolation (V3)

### Data Architecture

| Décision                           | Choix                                                                                                                                      | Version vérifiée                                          | Rationale (drivers)                                   | Source         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------------------- | -------------- |
| **Database engine**                | PostgreSQL via Supabase Cloud                                                                                                              | Supabase 2026 (clés `sb_publishable_xxx`/`sb_secret_xxx`) | D1 + Decision 2026-05-05                              | PRD figé       |
| **Region**                         | `eu-central-1` (Francfort)                                                                                                                 | —                                                         | D1 + CNDP art. 43                                     | PRD figé       |
| **Schema authoring**               | SQL pur dans `supabase/migrations/*.sql` versionnées                                                                                       | Supabase CLI native                                       | D5 (portable Postgres standard) + D8 (peu de magie)   | Décidé step-04 |
| **Types TypeScript depuis schéma** | `supabase gen types typescript` à chaque migration                                                                                         | —                                                         | D8 + ergonomie apprenti                               | Décidé step-04 |
| **ORM/Query builder**              | `@supabase/supabase-js` direct (pas de Drizzle au MVP)                                                                                     | supabase-js 2.x                                           | D5 + D8                                               | Décidé step-04 |
| **Validation runtime**             | Zod v4 sur toutes les frontières (Server Actions inputs, Route Handlers bodies, env vars)                                                  | Zod 4.x                                                   | D8 (écosystème + AI training) > D2 (compromis bundle) | Décidé step-04 |
| **Multi-tenant discipline**        | Colonne `residence_id uuid not null references residences(id)` sur toutes les entités utilisateur dès J1 ; scoping query implicite via RLS | —                                                         | D4 (right-sized tenancy)                              | Step-02        |
| **Caching**                        | HTTP cache headers + Service Worker app shell (Serwist) + Next.js Server Component cache + `revalidateTag` sur mutations                   | —                                                         | D2 (perceived reactivity) + D6 (pas de Redis)         | Décidé step-04 |
| **Backups**                        | Snapshots auto Supabase quotidiens (rétention 7j free tier) + export hebdomadaire SQL → R2 EU (script GitHub Actions cron)                 | —                                                         | NFR33 + D8 (anti-bus-factor)                          | Décidé step-04 |

### Authentication & Security

| Décision                           | Choix                                                                                                                                                                          | Rationale                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Méthode auth résidents**         | Magic link **e-mail-only au MVP** via `supabase.auth.signInWithOtp({ email })`                                                                                                 | D6 (SMS = poste variable, e-mail = quasi-gratuit) · SMS différé V1.5                                                          |
| **Méthode auth artisans**          | Magic link **SMS** via Brevo SMS API (ou provider SMS dédié, décision en step-05 si Brevo ne couvre pas SMS Maroc)                                                             | FR17-18 · consentement asynchrone obligatoire · pas de compte permanent                                                       |
| **Magic link config**              | Expiration 15 min · usage unique · cooldown 60s natif Supabase                                                                                                                 | NFR12                                                                                                                         |
| **Session**                        | Cookies httpOnly + Secure + SameSite=Lax via `@supabase/ssr` · validité 12 mois · refresh silencieux                                                                           | NFR13 + FR9                                                                                                                   |
| **Provider e-mail transactionnel** | **Brevo (Sendinblue, France)**                                                                                                                                                 | EU-résident · GDPR-native · free tier 300 e-mails/jour (~9000/mois couvre MVP) · French co aligne narrative bien commun MA+UE |
| **Authorization model**            | Row-Level Security Postgres sur **toutes** les tables · policies par rôle (résident, co-mod, demandeur, public anonyme) · `auth.uid()` + `auth.jwt()->>'role'`                 | NFR21 + D1                                                                                                                    |
| **Rôles**                          | `resident` (par défaut post-admission) · `co-mod` (3-4 admins) · `demandeur` (en file d'attente, lecture limitée) · `public` (visiteur non-auth, lecture pages publiques)      | PRD §Functional Requirements                                                                                                  |
| **Soft-delete & audit**            | Colonne `deleted_at timestamptz` + `deleted_by uuid` + `deletion_reason text` sur entités modérables · trigger Postgres pour audit log immutable                               | NFR17 + FR33-34                                                                                                               |
| **Effacement RGPD**                | Procédure cron : marquage soft-delete immédiat sur demande · purge dure (DELETE cascade) à J+7 · script SQL audité versionné                                                   | NFR18 + FR11                                                                                                                  |
| **Rate limiting**                  | 3 couches gratuites : Supabase Auth built-in (60s magic link cooldown) + middleware Next.js token bucket en mémoire (signalement, suggestion) + Vercel WAF (1k req/min global) | D6 (pas d'Upstash MVP)                                                                                                        |
| **TLS & headers**                  | TLS 1.3 obligatoire · HSTS `max-age=31536000; includeSubDomains; preload` · CSP strict · X-Frame-Options DENY · `Permissions-Policy` minimal                                   | NFR10                                                                                                                         |
| **Cookies**                        | **Strictement essentiels** (session auth uniquement) · pas de bandeau cookies à afficher car aucun cookie tiers                                                                | NFR16                                                                                                                         |
| **DPA fournisseurs**               | Contrats signés avant lancement : Supabase, Vercel, Cloudflare R2, Brevo, GlitchTip, provider SMS · stockés dans le runbook                                                    | CC #14                                                                                                                        |

### API & Communication Patterns

| Décision                         | Choix                                                                                                                                                                            | Rationale                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Patron par défaut**            | **Server Actions Next.js** pour toutes les mutations issues de forms (admission, fiche artisan, notation, signalement, suggestion)                                               | Ergonomie Next 16 App Router + types end-to-end Zod      |
| **Route Handlers REST**          | Pour : webhook consentement artisan SMS callback · sitemap.xml dynamique · manifest.ts dynamique · `/transparence.json` (compteurs publics agrégés) · `/api/health` (monitoring) | Cas où Server Actions ne s'appliquent pas                |
| **Read path**                    | **Server Components** par défaut (RSC) · pas de duplication client/serveur · `cookies()` + Supabase server client pour requêtes auth                                             | D2 (bundle léger) + D5                                   |
| **Error handling**               | `error.tsx` boundaries Next.js par route + `notFound()` pour 404 + GlitchTip capture côté serveur + UI fallback i18n FR/AR                                                       | NFR-Reliability                                          |
| **Documentation API**            | Pas d'OpenAPI/Swagger au MVP (solo dev · pas d'API externe à intégrer) · README + commentaires JSDoc sur Server Actions exposées · ADRs pour décisions cross-cutting             | D8 (apprenti, économie de surface)                       |
| **Communication temps réel**     | **Polling à l'ouverture** sur dashboard co-mods (file admission · signalements) · pas de WebSocket · pas de Supabase Realtime au MVP                                             | Step-02 · 3-4 co-mods, charge ~2h/mois, polling = suffit |
| **Webhook consentement artisan** | Endpoint Route Handler `POST /api/webhook/sms-consent` · signature HMAC validée · idempotence via `event_id` UUID stocké en DB · token magique URL expirant 7 jours              | FR17-18 · CC #20 (async lifecycle)                       |

### Frontend Architecture

| Décision                    | Choix                                                                                                                                                                                                                                           | Rationale                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Architecture composants** | Composition par feature (`app/[locale]/(public)/install`, `app/(community)/annuaire`, ...) · shared UI primitives dans `components/ui/` (kebab-case) · sans bibliothèque UI au MVP                                                              | D5 + D8 (pas de shadcn/Radix au MVP — reportable V1.5 si besoin émerge) |
| **State management**        | **Pas de store global au MVP** · React state local + Server Actions revalidate · `useTransition` pour optimistic UI                                                                                                                             | D2 + D8                                                                 |
| **Routing**                 | App Router avec `[locale]` segment pour pages publiques uniquement (`app/[locale]/(public)/...`) · entités communautaires routées sans locale (`app/(community)/artisan/[slug]/page.tsx`) · locale lue depuis cookie utilisateur via middleware | Décidé step-04 (réponse Stephane)                                       |
| **i18n library**            | `next-intl` · dictionnaires `messages/fr.json` `messages/ar.json` · `getTranslations()` côté serveur, `useTranslations()` côté client minimal                                                                                                   | D7 + Step-03                                                            |
| **RTL**                     | `dir={getDirection(locale)}` sur `<html>` · Tailwind logical properties (`me-4`, `ps-2`, `start-0`) systématiquement · zero `mr-*` / `pl-*`                                                                                                     | D7 + NFR45                                                              |
| **Performance**             | Bundle initial < 150KB gzip (NFR6) · `next/dynamic` pour modération + ADR co-mods (lazy load) · `next/image` pour photos artisans R2 · critical CSS inline via Tailwind 4                                                                       | D2 + NFR1-6                                                             |
| **Cibles tactiles & a11y**  | Tokens Tailwind dédiés (`size-12 min-h-12` = 48×48px) · plugin `@tailwindcss/forms` pour focus visible · `prefers-reduced-motion` respecté via `motion-safe:`                                                                                   | NFR36-39 + D2                                                           |
| **Manifest PWA**            | `app/manifest.ts` (dynamic) avec `name`, `short_name="Darna"`, `theme_color`, `display="standalone"`, `start_url="/"` · icônes générées (192/256/512)                                                                                           | FR44                                                                    |
| **Service worker**          | Serwist `defaultCache` + cache de l'annuaire artisans précomputed + queue background sync pour contributions hors-ligne                                                                                                                         | FR45 + D2                                                               |
| **Schéma de chargement**    | Skeleton screens via `loading.tsx` Next.js (jamais spinner seul · règle Aïcha = pas d'attente sans contexte)                                                                                                                                    | NFR40                                                                   |

### Infrastructure & Deployment

| Décision                 | Choix                                                                                                                                                                                                          | Rationale             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **Hosting frontend**     | Vercel `fra1` (Francfort)                                                                                                                                                                                      | PRD figé              |
| **Database**             | Supabase Cloud `eu-central-1` (Francfort)                                                                                                                                                                      | PRD figé              |
| **File storage**         | Cloudflare R2 juridiction `eu` · CDN auto · public-read avec signed URLs pour artisans verified                                                                                                                | PRD figé              |
| **CI/CD**                | GitHub Actions · workflow `ci.yml` (lint + typecheck + Vitest + Lighthouse CI sur PR) · workflow `e2e.yml` (Playwright sur main) · workflow `mirror.yml` (sync vers GitLab/Codeberg toutes les heures)         | NFR52 + NFR29         |
| **Environments**         | `production` (Vercel branche main → darna.org) · `preview` (Vercel auto-deploy sur PR) · `local` (Supabase local via CLI + .env.local)                                                                         | Standard              |
| **Secrets management**   | Vercel env vars (production + preview) · GitHub Actions secrets (CI) · `.env.example` dans repo · gestionnaire de mots de passe partagé co-mods (1Password Families ou Bitwarden Org) pour secrets de recovery | NFR31 + D8            |
| **Observabilité errors** | **GlitchTip Cloud (EU/Allemagne)** · SDK Sentry-compatible (`@sentry/nextjs` pointe vers DSN GlitchTip) · capture serveur + client · sourcemaps uploadées via CI                                               | CC #16 + D1 + D6 + D8 |
| **Observabilité perf**   | Lighthouse CI sur chaque PR · seuil de blocking : PWA ≥ 90, Accessibility ≥ 95, Performance ≥ 80 (4G throttle) · Vercel Analytics **désactivé** (privacy-first NFR16)                                          | NFR1-9 + NFR16        |
| **Logs serveur**         | `console.log` JSON structuré + Vercel logs (rétention 30j native) · GlitchTip pour erreurs · pas de service externe pour les logs                                                                              | NFR55 + D6            |
| **Budget alerting**      | Email automatique via Brevo + GitHub Actions cron quotidien qui pull les usages (Supabase API + Vercel API + R2 API + Brevo API) et alerte si > seuil (15€/mois MVP, 50€/mois à 100 villas)                    | CC #18 + D6           |
| **Domain**               | `darna.org` chez registrar EU (Gandi recommandé · OVH ou Porkbun en alternative) · auto-renew · transfer lock activé · 2FA sur compte                                                                          | Decision 2026-05-10   |
| **Git mirror**           | GitHub origin · GitLab.com + Codeberg mirrors via GitHub Action toutes les heures (token déposé en repo secret)                                                                                                | NFR29 + D8            |

### Decision Impact Analysis

**Implementation Sequence (proposed order for first epics)** :

1. **Story 1 — Project bootstrap** : `create-next-app --example with-supabase darna` + ajout Serwist + next-intl + Vitest + Playwright (cf. step-03)
2. **Story 2 — Schema initial** : tables `residences`, `users`, `artisans`, `ratings`, `alerts`, `tips`, `guide_entries`, `useful_numbers`, `pack_entries`, `moderation_log`, `suggestions`, `notifications_prefs`, `admission_requests` + RLS policies + migrations versionnées + `supabase gen types`
3. **Story 3 — Auth & admission** : magic link e-mail via Brevo + file admission + validation co-mod + i18n FR/AR sur pages publiques + middleware locale/auth
4. **Story 4 — Annuaire artisans (read)** : liste + recherche FTS Postgres + filtres + fiche détaillée + `tel:` action + cache HTTP/SW
5. **Story 5 — Annuaire artisans (write)** : création fiche + consentement asynchrone artisan via SMS webhook Brevo (ou autre provider SMS arbitré) + notation typée multi-axes + 👍
6. **Story 6 — Contenu durable** : Guide résident · Numéros utiles · Pack accueil · interface co-mod CRUD
7. **Story 7 — Contenu éphémère** : alertes + bons plans + expiration auto (cron Supabase Edge Function)
8. **Story 8 — Modération** : file admission · signalement · retrait · journal public · soft-delete cascade
9. **Story 9 — Partage WhatsApp** : URLs canoniques · copy-to-clipboard · OG tags pages publiques · deep linking PWA
10. **Story 10 — Conformité** : page transparence · export RGPD JSON · purge logs 30j cron · pages légales

**Cross-Component Dependencies (cascades)** :

- **Schema initial** débloque tout le reste — première story critique
- **RLS policies** doivent être en place avant TOUTE écriture (sinon données utilisateurs cross-leakable)
- **Brevo e-mail** débloque admission · si SMS Brevo insuffisant pour Maroc, story 5 (consentement artisan) attend choix provider SMS
- **i18n FR/AR** doit être en place avant story 3 (admission a templates SMS+email bilingues)
- **GlitchTip** doit être instrumenté avant la bêta (story 4 ou 5) sinon on perd les erreurs des testeurs
- **Migration anciennes clés Supabase → nouvelles clés** : faire dès J1, pas en V1.5 (deprecation fin 2026)

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified** : 28 zones où des agents IA pourraient faire des choix divergents (naming DB, naming code, structure dossiers, format réponses, format dates, loading/error, etc.). Toutes alignées sur les conventions standard de l'écosystème Next.js 16 + Postgres + Supabase, conformément aux drivers D5 (vendor-portable) et D8 (recoverable by another solo dev).

### Naming Patterns

**Database Naming Conventions (Postgres standard) :**

| Élément          | Convention                  | Exemple                                                                                  |
| ---------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| Tables           | `snake_case` au **pluriel** | `users`, `artisans`, `moderation_log` (sauf log au singulier = entité journal collectif) |
| Colonnes         | `snake_case`                | `residence_id`, `created_at`, `deleted_at`, `display_name_fr`, `display_name_ar`         |
| Foreign keys     | `<entity>_id`               | `user_id`, `residence_id`, `artisan_id`                                                  |
| Timestamps       | `_at` suffix `timestamptz`  | `created_at`, `updated_at`, `deleted_at`, `published_at`                                 |
| Booleans         | `is_*` ou `has_*`           | `is_published`, `has_invoice`                                                            |
| Bilingual fields | `<field>_<lang>` (fr/ar)    | `description_fr`, `description_ar`                                                       |
| Indexes          | `idx_<table>_<colonnes>`    | `idx_artisans_residence_id`, `idx_ratings_artisan_id_created_at`                         |
| RLS policies     | `<table>_<role>_<action>`   | `artisans_resident_select`, `ratings_resident_insert`, `moderation_log_public_select`    |
| Functions DB     | `snake_case` verbeNom       | `soft_delete_artisan`, `purge_expired_alerts`                                            |
| Triggers         | `trg_<table>_<event>`       | `trg_artisans_updated_at`, `trg_audit_moderation`                                        |
| ENUMs valeurs    | `snake_case`                | `'resident'`, `'co_mod'`, `'demandeur'`, `'public'`                                      |

**API Naming Conventions :**

| Élément        | Convention                  | Exemple                                               |
| -------------- | --------------------------- | ----------------------------------------------------- |
| Route Handlers | `kebab-case` pluriel        | `/api/admission-requests`, `/api/webhook/sms-consent` |
| Params Next.js | `[<name>]` ou `[...<name>]` | `[slug]`, `[locale]`, `[...rest]`                     |
| Query params   | `snake_case`                | `?residence_id=...`, `?sort_by=rating_desc`           |
| Headers custom | `X-Darna-<Name>` PascalCase | `X-Darna-Request-Id` (correlation ID en logs)         |

**Code Naming Conventions :**

| Élément                    | Convention                                     | Exemple                                                                                   |
| -------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Fichiers composants        | `kebab-case.tsx`                               | `artisan-card.tsx`, `magic-link-form.tsx`                                                 |
| Noms composants React      | `PascalCase`                                   | `ArtisanCard`, `MagicLinkForm`                                                            |
| Hooks                      | `camelCase` préfixe `use`                      | `useArtisanFilters`, `useLocale`                                                          |
| Fichiers Server Actions    | `<feature>.actions.ts`                         | `artisan.actions.ts`, `admission.actions.ts`                                              |
| Server Actions (fonctions) | `camelCase` verbeNom                           | `createArtisan`, `validateAdmission`, `rejectAdmission`                                   |
| Fichiers schémas Zod       | `<feature>.schema.ts`                          | `artisan.schema.ts` exporte `createArtisanInputSchema` + type inféré `CreateArtisanInput` |
| Types TypeScript           | `PascalCase`                                   | `Artisan`, `ArtisanInput`, `Locale`, `ModerationAction`                                   |
| Constantes                 | `SCREAMING_SNAKE_CASE` dans `lib/constants.ts` | `MAX_ARTISAN_PHOTOS = 3`, `ADMISSION_SLA_HOURS = 24`                                      |
| Env vars                   | `SCREAMING_SNAKE_CASE` avec préfixe            | `NEXT_PUBLIC_SUPABASE_URL`, `BREVO_API_KEY`, `GLITCHTIP_DSN`                              |
| Slugs URLs                 | `kebab-case` ASCII lowercase                   | `hassan-plombier`, `coupure-eau-2026-09-14`                                               |

### Structure Patterns

**Project Organization** (App Router avec route groups) :

```
darna/
├── app/
│   ├── [locale]/                # Wrapping i18n pour pages publiques uniquement
│   │   ├── (public)/            # Route group = ne change pas l'URL
│   │   │   ├── page.tsx         # → /fr ou /ar
│   │   │   ├── install/page.tsx
│   │   │   ├── manifesto/page.tsx
│   │   │   ├── transparence/page.tsx
│   │   │   └── legal/[document]/page.tsx
│   │   └── layout.tsx           # Layout avec dir + lang + i18n provider
│   ├── (community)/             # Entités communautaires SANS locale dans URL
│   │   ├── annuaire/
│   │   │   ├── page.tsx
│   │   │   ├── _components/     # Composants locaux (underscore = exclu routing)
│   │   │   ├── actions.ts       # Server Actions
│   │   │   └── schema.ts        # Schémas Zod
│   │   ├── artisan/[slug]/page.tsx
│   │   ├── alertes/page.tsx
│   │   └── guide/[entry]/page.tsx
│   ├── (comod)/                 # Routes co-mod
│   │   ├── moderation/
│   │   └── admission/
│   ├── api/                     # Route Handlers
│   │   ├── webhook/sms-consent/route.ts
│   │   ├── sitemap.xml/route.ts
│   │   └── health/route.ts
│   ├── manifest.ts              # PWA manifest dynamique
│   ├── error.tsx                # Error boundary racine
│   ├── not-found.tsx
│   └── layout.tsx               # Layout racine
├── components/
│   └── ui/                      # Primitives UI partagées (button, input, ...)
├── lib/
│   ├── supabase/                # Clients serveur/client/middleware (depuis starter)
│   ├── auth/                    # Helpers session + RBAC
│   ├── i18n/                    # Config next-intl
│   ├── email/                   # Brevo client + templates
│   ├── slug/                    # Slugify FR/AR
│   ├── validation/              # Schémas Zod partagés
│   ├── constants.ts
│   └── logger.ts                # console.log JSON structuré
├── messages/                    # Traductions next-intl
│   ├── fr.json
│   └── ar.json
├── supabase/
│   ├── migrations/              # SQL versionné
│   ├── seed.sql
│   └── functions/               # Edge Functions (cron purge, expiration alertes)
├── e2e/                         # Playwright scénarios
├── public/                      # Assets statiques
├── sw/                          # Service worker Serwist
└── middleware.ts                # Routing locale + auth guards
```

**File Structure Patterns :**

- **Tests unit/composants** : co-localisés `*.test.tsx` (`artisan-card.tsx` → `artisan-card.test.tsx` à côté)
- **Tests E2E** : `e2e/<journey>.spec.ts` (5 journeys du PRD = 5 specs minimum)
- **ADRs** : `docs/adr/NNNN-<titre>.md` (`0001-postgres-fts-search.md`, `0002-brevo-email-provider.md`)
- **Runbook** : `docs/runbook.md` (recovery + secrets + procédures co-mods)
- **Scripts opérationnels** : `scripts/<name>.ts` (`scripts/export-rgpd.ts`, `scripts/budget-alert.ts`)
- **Pas de barrel files `index.ts`** dans les dossiers sauf si export agrégé explicite — éviter de casser le tree-shaking

### Format Patterns

**API & Server Actions Response Formats :**

- **Convention `snake_case` end-to-end** dans la codebase (DB ↔ types ↔ JSON) — on n'ajoute PAS de transform layer camelCase, parce que les types générés par `supabase gen types` sont déjà snake_case. Anti-D8 d'ajouter une couche de mapping qui peut diverger.
- **Server Actions retour** : discriminated union `Result<T>` :
  ```ts
  type Result<T> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message_key: string } };
  ```
  `code` = identifiant stable, `message_key` = clé i18n pour `next-intl` (jamais de texte hardcodé)
- **Route Handlers retour** : JSON `Response.json(...)` avec `{ data }` ou `{ error: { code, message_key } }` selon résultat. Status codes REST standards.
- **HTTP status codes** : 200 (read), 201 (create), 204 (delete), 400 (bad input), 401 (no auth), 403 (no permission), 404 (not found), 409 (conflict — déjà existe), 422 (validation failed), 429 (rate limit), 500 (server error)

**Data Exchange Formats :**

- **Dates** : ISO 8601 strings (`"2026-09-14T18:30:00.000Z"`) dans la DB (`timestamptz`) → ISO strings dans toute la stack → rendu en UI via `Intl.DateTimeFormat(locale)` (jamais `.toLocaleString()` qui dépend du navigateur)
- **Booléens** : `true` / `false` (jamais `1`/`0` même en DB)
- **Null handling** : `null` explicite préféré à `undefined` dans la couche données (cohérent avec Postgres NULL) ; `undefined` autorisé en TypeScript côté composants
- **Array vs object** : tableaux pour collections même si 0 ou 1 élément (jamais `null` pour collection vide)
- **Trailing slash URL** : pas de trailing slash (Next.js default)

### Communication Patterns

**Inter-module communication :**

- **Pas d'event bus interne au MVP** — Server Actions appellent directement les helpers de feature voisine via imports `lib/*`
- **Side effects après mutation** : exécutés dans la Server Action elle-même (ex. `validateAdmission` envoie l'e-mail Brevo en série avant de retourner)
- **Pas de queue de jobs au MVP** — si latence devient un problème en bêta, ajout d'Inngest EU ou Trigger.dev EU en V1.5
- **Supabase Realtime** : pas utilisé au MVP (cf. step-04)
- **Notifications inter-utilisateurs** : insertion DB → side effect Brevo email envoyé immédiatement (pas d'event-sourcing)

**Logging Format (JSON structuré) :**

```ts
// lib/logger.ts
type LogEntry = {
  ts: string; // ISO timestamp
  level: 'info' | 'warn' | 'error';
  event: string; // ex: 'admission.validated'
  user_id: string | null;
  residence_id: string | null;
  request_id: string | null; // correlation ID depuis X-Darna-Request-Id
  payload?: Record<string, unknown>; // jamais PII
};
console.log(JSON.stringify(entry));
```

- **Jamais de PII dans `payload`** (pas d'e-mails, pas de noms — `user_id` UUID suffit)
- **GlitchTip capture** automatique sur `level: 'error'`

### Process Patterns

**Error Handling :**

- **Boundary `error.tsx`** par route principale (ex. `app/(community)/annuaire/error.tsx`) avec UI fallback i18n + bouton retry
- **`notFound()`** Next.js pour 404 (page `not-found.tsx` racine i18n)
- **Server Actions** : ne `throw` que pour erreurs imprévues (capturées par GlitchTip + UI montre erreur générique) ; pour erreurs métier attendues (validation, conflit, rate limit), retourner `{ ok: false, error: { code, message_key } }`
- **Route Handlers** : `try/catch` autour de la logique métier → JSON `Response` avec status + `{ error: { code, message_key } }` ; `throw` capturé par GlitchTip
- **Messages utilisateur** : toujours via `message_key` next-intl, jamais hardcodé. Convention de clés : `errors.<domain>.<code>` (`errors.admission.villa_out_of_range`)

**Loading States :**

- **`loading.tsx`** par route principale = skeleton screens (jamais spinner seul — règle Aïcha, NFR40)
- **Optimistic UI** : `useOptimistic` + `useTransition` pour mutations rapides (notation, 👍)
- **Pas de loading global** — chaque route gère son propre loading
- **Suspense boundaries** pour streaming de Server Components (annuaire avec filtres = Suspense par section)

**Validation :**

- **Zod sur 3 frontières strictes** : (1) inputs Server Actions, (2) bodies Route Handlers, (3) env vars (`zod-env` pattern dans `lib/env.ts` qui parse `process.env` au démarrage)
- **Schéma co-localisé** : `app/(community)/annuaire/schema.ts` pour les schémas de cette feature
- **Schémas partagés** dans `lib/validation/` (ex. `lib/validation/villa-number.ts` pour la validation 1-150)
- **Validation côté client** : optionnelle, copie le schéma serveur via Zod pour préview UX ; le serveur reste source de vérité

**Auth flow :**

- **`middleware.ts`** racine : check session Supabase + redirect si route protégée et pas authentifié + assigne le locale depuis cookie
- **Server Components** : `const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();` au début de chaque route protégée
- **Route Handlers protégés** : même pattern, retour 401 si pas d'user
- **Server Actions protégées** : `'use server'` + check user en première ligne, throw si pas authentifié
- **Pages publiques** : pas de check auth, mais layout peut afficher état différemment si user présent (lien "Mon profil" vs "S'inscrire")

**Retry :**

- **Pas de retry custom au MVP** — délégué au comportement natif Next.js / Supabase / Brevo
- **Erreurs réseau** côté client : affichage UI avec bouton "Réessayer" qui re-soumet la Server Action

### Enforcement Guidelines

**All AI Agents MUST :**

1. **Suivre les conventions de naming** ci-dessus systématiquement — pas d'invention
2. **Co-localiser** Server Actions, schémas Zod et composants locaux dans le dossier de leur feature
3. **Utiliser les types générés** par `supabase gen types typescript` plutôt que retyper à la main
4. **Valider toute entrée externe** avec Zod (Server Actions inputs, Route Handlers bodies, env vars)
5. **Loguer en JSON structuré** sans PII via `lib/logger.ts`
6. **Renvoyer en i18n** : `message_key` toujours, jamais de texte hardcodé en français ou arabe
7. **Utiliser CSS logical properties** Tailwind (`me-*`, `ps-*`, `start-*`) — jamais `mr-*`, `pl-*`, `left-*`
8. **Préfixer les routes locale-routables** avec `[locale]` (uniquement pages publiques)
9. **Écrire les tests** co-localisés `.test.tsx` pour composants et `.test.ts` pour helpers
10. **Documenter via ADR** toute décision qui dévie des patterns définis ici

**Pattern Enforcement (mécanique) :**

- **ESLint** : config Next + règles custom :
  - Bannir `mr-`, `ml-`, `pl-`, `pr-`, `left-`, `right-` dans className Tailwind (eslint-plugin-tailwindcss + custom rule)
  - Bannir `console.log` direct (forcer via `lib/logger`)
  - `@typescript-eslint/no-floating-promises` strict
- **TypeScript strict** : pas de `any`, pas de `@ts-ignore` sans `// reason: <explication>`
- **Prettier** : tabWidth 2, single quotes, trailing comma all
- **Pre-commit hook** (Husky + lint-staged) : eslint + prettier + tsc --noEmit sur staged files
- **CI fail** : workflow `ci.yml` fail si lint, typecheck ou tests cassent

**Documentation des violations :**

- Toute déviation doit être documentée dans un **ADR** dans `docs/adr/NNNN-<titre>.md` au moment du commit qui l'introduit
- Référence l'ADR dans le commit message (`Reasoning: docs/adr/0007-...md`)

**Process pour mettre à jour les patterns :**

- Tout changement de pattern global = nouvelle entrée dans `docs/adr/` + PR avec migration des cas existants (ou TODO trackés)
- Le fichier `architecture.md` (ce document) reste source de vérité, mis à jour à la même PR

### Pattern Examples

**Good Examples :**

```ts
// app/(community)/annuaire/schema.ts
import { z } from 'zod';
export const createArtisanInputSchema = z.object({
  display_name_fr: z.string().min(2).max(80),
  display_name_ar: z.string().min(2).max(80).optional(),
  phone_e164: z.string().regex(/^\+212\d{9}$/),
  competencies: z.array(z.enum(['plumbing', 'electric', 'painting'])).min(1),
  price_relative: z.enum(['$', '$$', '$$$', '$$$$']),
  has_invoice: z.boolean(),
});
export type CreateArtisanInput = z.infer<typeof createArtisanInputSchema>;
```

```ts
// app/(community)/annuaire/actions.ts
'use server';
import { createArtisanInputSchema } from './schema';
import { createClient } from '@/lib/supabase/server';
import { log } from '@/lib/logger';

export async function createArtisan(formData: FormData): Promise<Result<{ slug: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, error: { code: 'unauthenticated', message_key: 'errors.auth.required' } };

  const parsed = createArtisanInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      ok: false,
      error: { code: 'validation_failed', message_key: 'errors.artisan.invalid' },
    };

  const slug = slugify(parsed.data.display_name_fr);
  const { error } = await supabase.from('artisans').insert({
    ...parsed.data,
    slug,
    residence_id: user.app_metadata.residence_id,
  });
  if (error) {
    log({
      level: 'error',
      event: 'artisan.create.failed',
      user_id: user.id,
      residence_id: user.app_metadata.residence_id,
      payload: { code: error.code },
    });
    return { ok: false, error: { code: 'db_error', message_key: 'errors.generic' } };
  }

  log({
    level: 'info',
    event: 'artisan.created',
    user_id: user.id,
    residence_id: user.app_metadata.residence_id,
    payload: { slug },
  });
  return { ok: true, data: { slug } };
}
```

**Anti-Patterns à éviter :**

```ts
// ❌ camelCase quand le DB est snake_case → confusion
const { displayName } = artisan; // mauvais
const { display_name_fr } = artisan; // bon

// ❌ Texte hardcodé
return <p>Erreur de validation</p>; // mauvais — viole D7 (bilingue) + NFR i18n
return <p>{t('errors.artisan.invalid')}</p>; // bon

// ❌ Spinner sans contexte
return <Spinner />; // mauvais — viole NFR40 règle Aïcha
return <ArtisanCardSkeleton />; // bon

// ❌ Tailwind directionnel non-logique
<div className="ml-4 pl-2"> // mauvais — casse en RTL
<div className="ms-4 ps-2"> // bon

// ❌ console.log direct
console.log('user created', email); // mauvais — PII + non-structuré
log({ level: 'info', event: 'user.created', user_id: user.id, residence_id }); // bon

// ❌ Try/catch silencieux
try { await something(); } catch {} // mauvais — erreur disparait
try { await something(); } catch (err) { log({ level: 'error', event: '...', payload: { err: String(err) } }); throw err; } // bon
```

## Project Structure & Boundaries

### Requirements → Components Mapping

Les 9 familles FR du PRD sont mappées comme suit aux dossiers de l'application :

| Famille FR                            | Localisation primaire                                        | Localisation secondaire                                                       |
| ------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **F1. Admission / inscription**       | `app/(community)/admission/` (demandeur dépose sa requête)   | `app/(comod)/admission/` (co-mod valide/refuse)                               |
| **F2. Annuaire artisans**             | `app/(community)/annuaire/` (liste + filtres)                | `app/(community)/artisan/[slug]/` (fiche), `app/(comod)/moderation/artisans/` |
| **F3. Alertes communautaires**        | `app/(community)/alertes/`                                   | `app/(comod)/moderation/alertes/`                                             |
| **F4. Guide pratique**                | `app/(community)/guide/[entry]/`                             | `app/(comod)/moderation/guide/`                                               |
| **F5. Modération transverse**         | `app/(comod)/moderation/` (dashboard + actions)              | `lib/moderation/` (helpers, journal log)                                      |
| **F6. Compte utilisateur / profil**   | `app/(community)/profil/`                                    | `app/auth/` (magic link callback)                                             |
| **F7. Transparence / governance**     | `app/[locale]/(public)/transparence/`                        | `app/(comod)/admin/transparence/` (édition co-mods)                           |
| **F8. Pages publiques / PWA install** | `app/[locale]/(public)/` (racine, install, manifesto, legal) | `app/manifest.ts`, `sw/`                                                      |
| **F9. Admin résidence**               | `app/(comod)/admin/` (config résidence, gestion co-mods)     | `lib/admin/`                                                                  |

**Cross-cutting (transversaux) :**

- **Auth** → `middleware.ts` (racine) + `lib/auth/` + `lib/supabase/` clients
- **i18n FR/AR + RTL** → `messages/`, `lib/i18n/`, layout `app/[locale]/layout.tsx`
- **E-mail Brevo** → `lib/email/` (client + templates)
- **Observabilité** → `lib/logger.ts` + `instrumentation.ts` (GlitchTip Next.js intégration)
- **Storage R2** → `lib/storage/`
- **PWA service worker** → `sw/` (Serwist)
- **RLS / sécurité DB** → `supabase/migrations/` (policies SQL versionnées)

### Complete Project Directory Structure

```
darna/
├── README.md                          # OSS pitch + quickstart + lien manifesto
├── LICENSE                            # MIT
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── SECURITY.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts                     # PWA, i18n, headers sécurité (CSP, HSTS)
├── tailwind.config.ts                 # Tailwind 4 (RTL plugin, design tokens)
├── postcss.config.mjs
├── eslint.config.mjs                  # Flat config (next + custom rules)
├── prettier.config.mjs
├── vitest.config.ts
├── playwright.config.ts
├── .env.example                       # NEXT_PUBLIC_SUPABASE_URL, BREVO_API_KEY, GLITCHTIP_DSN, ...
├── .env.local                         # Local dev (gitignored)
├── .gitignore
├── .editorconfig
├── .nvmrc
├── .husky/
│   └── pre-commit                     # lint-staged trigger
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                     # lint + typecheck + test sur PR
│   │   ├── e2e.yml                    # Playwright nightly
│   │   ├── release.yml                # Tag release-* → supabase db push + Vercel promote
│   │   └── budget-alert.yml           # Cron mensuel scan dépenses
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug.yml
│   │   ├── feature.yml
│   │   └── security.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── app/                               # Next.js App Router
│   ├── layout.tsx                     # Layout racine HTML
│   ├── error.tsx                      # Error boundary global
│   ├── not-found.tsx
│   ├── manifest.ts                    # PWA manifest dynamique
│   ├── robots.ts
│   ├── sitemap.ts
│   ├── globals.css
│   ├── icon.tsx
│   ├── apple-icon.tsx
│   ├── [locale]/                      # locale-routing UNIQUEMENT pour pages publiques
│   │   ├── layout.tsx                 # next-intl provider + dir="rtl/ltr" + lang
│   │   ├── error.tsx
│   │   └── (public)/
│   │       ├── page.tsx               # → /fr ou /ar — landing publique
│   │       ├── install/
│   │       │   ├── page.tsx
│   │       │   ├── _components/
│   │       │   │   ├── ios-steps.tsx
│   │       │   │   └── android-steps.tsx
│   │       │   └── loading.tsx
│   │       ├── manifesto/page.tsx
│   │       ├── transparence/
│   │       │   ├── page.tsx
│   │       │   └── _components/
│   │       │       ├── stats-block.tsx
│   │       │       └── governance-rules.tsx
│   │       └── legal/
│   │           ├── [document]/page.tsx       # privacy, terms, cnil, cookies
│   │           └── _components/
│   │               └── legal-toc.tsx
│   ├── (community)/                   # Routes communauté (auth obligatoire)
│   │   ├── layout.tsx                 # Auth guard + nav + bottom-tab PWA
│   │   ├── admission/                 # F1 demandeur
│   │   │   ├── page.tsx
│   │   │   ├── pending/page.tsx
│   │   │   ├── actions.ts             # submitAdmissionRequest()
│   │   │   ├── schema.ts
│   │   │   ├── _components/
│   │   │   │   ├── admission-form.tsx
│   │   │   │   └── villa-picker.tsx
│   │   │   └── error.tsx
│   │   ├── annuaire/                  # F2 liste
│   │   │   ├── page.tsx
│   │   │   ├── loading.tsx
│   │   │   ├── actions.ts
│   │   │   ├── schema.ts
│   │   │   ├── _components/
│   │   │   │   ├── artisan-card.tsx
│   │   │   │   ├── artisan-card.test.tsx
│   │   │   │   ├── filters-bar.tsx
│   │   │   │   ├── filters-bar.test.tsx
│   │   │   │   ├── search-input.tsx
│   │   │   │   └── empty-state.tsx
│   │   │   └── error.tsx
│   │   ├── artisan/[slug]/
│   │   │   ├── page.tsx
│   │   │   ├── actions.ts             # submitRating, requestConsent
│   │   │   ├── schema.ts
│   │   │   ├── _components/
│   │   │   │   ├── artisan-detail.tsx
│   │   │   │   ├── ratings-list.tsx
│   │   │   │   ├── ratings-list.test.tsx
│   │   │   │   └── rate-form.tsx
│   │   │   └── error.tsx
│   │   ├── alertes/                   # F3
│   │   │   ├── page.tsx
│   │   │   ├── nouveau/page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   ├── actions.ts
│   │   │   ├── schema.ts
│   │   │   ├── _components/
│   │   │   │   ├── alert-card.tsx
│   │   │   │   ├── alert-feed.tsx
│   │   │   │   ├── alert-form.tsx
│   │   │   │   ├── comment-thread.tsx
│   │   │   │   └── thumbs-up-button.tsx
│   │   │   └── loading.tsx
│   │   ├── guide/                     # F4
│   │   │   ├── page.tsx
│   │   │   ├── [entry]/page.tsx
│   │   │   ├── proposer/page.tsx
│   │   │   ├── actions.ts
│   │   │   ├── schema.ts
│   │   │   └── _components/
│   │   │       ├── guide-toc.tsx
│   │   │       └── markdown-render.tsx
│   │   └── profil/                    # F6
│   │       ├── page.tsx
│   │       ├── parametres/page.tsx
│   │       ├── export/page.tsx        # RGPD export self-service
│   │       ├── supprimer/page.tsx     # RGPD suppression compte
│   │       ├── actions.ts
│   │       ├── schema.ts
│   │       └── _components/
│   │           ├── profile-form.tsx
│   │           └── danger-zone.tsx
│   ├── (comod)/                       # Routes co-modérateurs (rôle co_mod)
│   │   ├── layout.tsx                 # Auth guard + check role
│   │   ├── admission/                 # F1 co-mod
│   │   │   ├── page.tsx               # File d'attente
│   │   │   ├── [id]/page.tsx
│   │   │   ├── actions.ts             # validateAdmission, rejectAdmission
│   │   │   ├── schema.ts
│   │   │   └── _components/
│   │   │       ├── admission-queue.tsx
│   │   │       └── decision-form.tsx
│   │   ├── moderation/                # F5
│   │   │   ├── page.tsx               # Dashboard
│   │   │   ├── artisans/page.tsx
│   │   │   ├── alertes/page.tsx
│   │   │   ├── guide/page.tsx
│   │   │   ├── journal/page.tsx       # Journal public (transparence)
│   │   │   ├── actions.ts
│   │   │   ├── schema.ts
│   │   │   └── _components/
│   │   │       ├── moderation-queue.tsx
│   │   │       ├── action-button.tsx
│   │   │       └── log-entry.tsx
│   │   └── admin/                     # F9
│   │       ├── page.tsx
│   │       ├── co-mods/page.tsx
│   │       ├── transparence/page.tsx
│   │       ├── actions.ts
│   │       └── schema.ts
│   ├── auth/                          # Magic link callback
│   │   ├── confirm/route.ts
│   │   └── signout/route.ts
│   └── api/                           # Route Handlers
│       ├── webhook/
│       │   └── brevo/route.ts         # HMAC-signed
│       ├── cron/
│       │   └── purge-expired/route.ts # Vercel cron
│       ├── sitemap.xml/route.ts
│       └── health/route.ts
├── components/
│   └── ui/                            # Primitives partagées
│       ├── button.tsx                 # Touch target ≥ 56px (NFR Aïcha)
│       ├── button.test.tsx
│       ├── input.tsx
│       ├── textarea.tsx
│       ├── select.tsx
│       ├── badge.tsx
│       ├── dialog.tsx
│       ├── skeleton.tsx
│       ├── toast.tsx
│       └── icon.tsx                   # lucide-react wrapper
├── lib/
│   ├── supabase/
│   │   ├── server.ts
│   │   ├── client.ts
│   │   ├── middleware.ts
│   │   └── types.generated.ts         # supabase gen types output (versionné)
│   ├── auth/
│   │   ├── session.ts                 # getUser(), getRole()
│   │   ├── rbac.ts                    # requireRole('co_mod'), requireResident()
│   │   └── magic-link.ts
│   ├── i18n/
│   │   ├── config.ts
│   │   ├── request.ts
│   │   └── routing.ts
│   ├── email/
│   │   ├── client.ts                  # Brevo SDK init
│   │   ├── send.ts                    # sendTransactionalEmail()
│   │   └── templates/
│   │       ├── admission-validated.fr.ts
│   │       ├── admission-validated.ar.ts
│   │       ├── admission-rejected.fr.ts
│   │       ├── admission-rejected.ar.ts
│   │       ├── magic-link.fr.ts
│   │       ├── magic-link.ar.ts
│   │       └── alert-notify.fr.ts
│   ├── storage/
│   │   ├── r2-client.ts               # S3 client → R2 endpoint
│   │   └── upload.ts
│   ├── moderation/
│   │   ├── log.ts                     # writeModerationLog(action, ...)
│   │   └── actions.ts
│   ├── slug/
│   │   ├── slugify.ts                 # Translittération FR/AR → ASCII kebab-case
│   │   └── slugify.test.ts
│   ├── validation/
│   │   ├── villa-number.ts            # zVillaNumber: 1-150
│   │   ├── phone-e164.ts              # zPhoneMaroc
│   │   └── email.ts
│   ├── search/
│   │   └── fts.ts                     # Postgres FTS query builder bilingue
│   ├── constants.ts
│   ├── env.ts                         # Zod-parse process.env au démarrage
│   ├── logger.ts                      # JSON structuré
│   └── utils/
│       ├── cn.ts                      # clsx + tailwind-merge
│       ├── format-date.ts             # Intl.DateTimeFormat wrappers
│       └── format-date.test.ts
├── messages/
│   ├── fr.json
│   └── ar.json
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20260601000001_init_schema.sql
│   │   ├── 20260601000002_init_rls.sql
│   │   ├── 20260601000003_init_fts.sql
│   │   ├── 20260601000004_init_indexes.sql
│   │   ├── 20260601000005_init_enums.sql
│   │   └── 20260601000006_seed_residence.sql
│   ├── seed.sql
│   └── functions/                     # Supabase Edge Functions
│       ├── purge-expired-alerts/index.ts
│       └── _shared/
├── sw/
│   └── index.ts                       # Serwist stratégies cache + offline fallback
├── public/
│   ├── icons/
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   ├── icon-maskable-512.png
│   │   └── apple-touch-icon.png
│   ├── og/
│   │   ├── og-default-fr.png
│   │   └── og-default-ar.png
│   ├── fonts/                         # Auto-hostées (D5 portabilité + D1 EU-only)
│   │   ├── inter-var.woff2
│   │   └── noto-sans-arabic-var.woff2
│   ├── manifest.webmanifest           # Fallback (généré aussi par app/manifest.ts)
│   ├── favicon.ico
│   └── robots.txt
├── e2e/                               # Playwright (5 user journeys du PRD)
│   ├── admission-flow.spec.ts
│   ├── artisan-discovery.spec.ts
│   ├── alert-creation.spec.ts
│   ├── guide-consultation.spec.ts
│   ├── profile-rgpd.spec.ts
│   └── fixtures/
│       └── auth.ts                    # Fixture login magic-link mock
├── docs/
│   ├── runbook.md                     # Recovery, secrets rotation, procédures co-mods
│   ├── adr/                           # Architecture Decision Records
│   │   ├── 0001-postgres-fts-search.md
│   │   ├── 0002-brevo-email-provider.md
│   │   ├── 0003-locale-routing-public-only.md
│   │   └── 0004-rls-vs-fk-discipline.md
│   ├── playbook-co-mods.md            # Onboarding co-modérateurs
│   └── architecture.md                # ← ce document (source de vérité)
├── scripts/
│   ├── export-rgpd.ts                 # Export user → JSON (RGPD art. 20)
│   ├── budget-alert.ts                # Cron mensuel scan dépenses
│   ├── generate-types.sh              # Wrapper supabase gen types
│   └── migrate-keys.ts                # Migration anciennes clés Supabase → nouvelles
├── instrumentation.ts                 # Next.js hook → init GlitchTip
└── middleware.ts                      # Routing locale + auth guards
```

### Architectural Boundaries

**API Boundaries :**

- **Routes publiques (`app/[locale]/(public)/*`)** : pas de check auth, lecture seule, accessibles sans cookie session
- **Routes communauté (`app/(community)/*`)** : auth obligatoire (rôle `resident` ou `co_mod`), enforced par `middleware.ts` + double-check Server Components
- **Routes co-mod (`app/(comod)/*`)** : auth + check `role === 'co_mod'`, échec → 403
- **Route Handlers `app/api/*`** : status REST + payloads `{data}` ou `{error: {code, message_key}}`
- **Webhooks externes (`app/api/webhook/brevo`)** : vérification HMAC signature header avant traitement
- **Crons (`app/api/cron/*`)** : protégés par `Authorization: Bearer ${CRON_SECRET}` (Vercel-injected)

**Component Boundaries :**

- **Server Components par défaut** — `'use client'` uniquement quand interactivité nécessaire (forms, optimistic UI)
- **Composants locaux dans `_components/`** sous chaque route (underscore exclut du routing)
- **Composants partagés dans `components/ui/`** — primitives sans dépendance métier
- **Pas de re-export depuis dossier parent** — import direct (`from './_components/artisan-card'`)
- **Props passing** : pas de Context API au MVP, on passe par props ou via Server Component fetching

**Service Boundaries :**

- **Tout accès DB passe par `lib/supabase/{server,client}.ts`** — jamais `pg` direct, jamais SQL string-construit
- **Tout envoi e-mail passe par `lib/email/send.ts`** — pas d'appel Brevo direct depuis Server Action
- **Tout upload fichier passe par `lib/storage/upload.ts`** — pas de fetch R2 direct
- **Tout log passe par `lib/logger.ts`** — `console.log` direct banni par ESLint
- **Validation Zod aux 3 frontières** (Server Action inputs, Route Handler bodies, `lib/env.ts`)

**Data Boundaries :**

- **Postgres = source de vérité** pour toutes les données métier
- **R2 = stockage fichiers seul** (photos artisans, exports RGPD éphémères 24h, jamais de données structurées)
- **Pas de cache applicatif au MVP** — Next.js cache (data cache + full route cache) géré via `revalidatePath()`/`revalidateTag()`
- **RLS sur 100% des tables avec données utilisateur** — `users`, `artisans`, `ratings`, `alerts`, `alert_comments`, `guide_entries`, `admission_requests`, `profiles`. Exception : `moderation_log` (lecture publique pour transparence, écriture system uniquement)
- **`residence_id` column discipline** : présent sur toutes les tables métier (FK vers `residences`), filtré par RLS

### Integration Points

**Internal Communication (intra-app) :**

- Server Components ↔ Server Components : via `await` direct (App Router rendering)
- Server Actions → DB : via Supabase client serveur
- Server Actions → e-mail Brevo : via `lib/email/send.ts` (synchrone, dans la transaction logique)
- Server Actions → log : via `lib/logger.ts` après chaque étape critique
- Client Components ↔ Server : via Server Actions (form actions ou `useTransition` + appel direct)

**External Integrations :**

| Service                    | Direction               | Boundary file                                          | Auth                                                                 |
| -------------------------- | ----------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| Supabase Auth (magic link) | sortie + callback       | `lib/supabase/server.ts` + `app/auth/confirm/route.ts` | publishable key (client) + service role key (server, jamais exposée) |
| Supabase DB Postgres       | sortie                  | `lib/supabase/server.ts`                               | RLS via session JWT                                                  |
| Brevo (e-mail FR)          | sortie + webhook entrée | `lib/email/send.ts` + `app/api/webhook/brevo/route.ts` | API key serveur + HMAC webhook                                       |
| Cloudflare R2              | sortie                  | `lib/storage/r2-client.ts`                             | S3 access key + secret (serveur uniquement)                          |
| GlitchTip Cloud EU         | sortie                  | `instrumentation.ts`                                   | DSN                                                                  |
| Vercel Cron                | entrée                  | `app/api/cron/purge-expired/route.ts`                  | `CRON_SECRET` bearer                                                 |

**Data Flow (exemple Journey 1 — Admission) :**

```
1. Demandeur sur /[locale]/(public)/  →  clique "Demander accès"
2. /admission/ Server Component  →  formulaire client
3. Submit  →  Server Action submitAdmissionRequest(formData)
4. Server Action :
   a. Zod validate → fail → return Result.error
   b. supabase.from('admission_requests').insert(...)
   c. lib/email/send.ts → Brevo → notify co-mods (3-4 destinataires)
   d. log({event: 'admission.requested', ...})
   e. return Result.ok({queue_position})
5. Demandeur redirigé → /admission/pending/
6. Co-mod connecté sur /(comod)/admission/  →  liste file (Server Component fetch)
7. Co-mod clique "Valider"  →  Server Action validateAdmission(id)
8. Server Action :
   a. requireRole('co_mod')
   b. supabase update admission_requests + create user + assign residence_id
   c. moderation_log.insert (transparence)
   d. lib/email/send.ts → Brevo → magic-link au nouveau résident
   e. log + return
9. Nouveau résident reçoit e-mail Brevo  →  clique  →  /auth/confirm  →  session  →  /(community)/profil/
```

### File Organization Patterns

**Configuration Files :**

- **Racine** : tout ce qui est outillage projet (`next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `eslint.config.mjs`, `prettier.config.mjs`, `vitest.config.ts`, `playwright.config.ts`)
- **Sous-projets** : `supabase/config.toml` pour le CLI Supabase, `.github/workflows/` pour CI
- **Env files** : `.env.example` versionné (tous les noms, vides), `.env.local` gitignored

**Source Organization :**

- **`app/`** = pages + Server Actions + composants locaux (co-localisation feature)
- **`components/ui/`** = primitives réutilisables (pas de logique métier)
- **`lib/`** = helpers + intégrations externes (organisé par domaine, pas par type)
- **`supabase/migrations/`** = SQL versionné, ordre garanti par timestamp filename

**Test Organization :**

- **Tests unitaires & composants** : `*.test.ts(x)` co-localisés (`artisan-card.tsx` → `artisan-card.test.tsx`)
- **Tests E2E** : `e2e/<journey>.spec.ts` (5 journeys = 5 specs minimum)
- **Fixtures partagées** : `e2e/fixtures/*.ts`
- **Pas de dossier `__tests__/`** centralisé — co-localisation = lecture facilitée

**Asset Organization :**

- **Static** : `public/` (icons PWA, fonts auto-hostées, OG images, favicon, robots.txt)
- **Fonts** : `public/fonts/` auto-hostées (pas de Google Fonts → D5 portabilité + D1 EU-only)
- **Uploads runtime** : Cloudflare R2 (jamais dans le repo), URLs stockées en DB

### Development Workflow Integration

**Development Server Structure :**

- `pnpm dev` → Next 16 Turbopack + service worker dev mode
- `pnpm supabase start` → stack locale (Postgres + Auth + Storage en Docker)
- Migration locale : `pnpm supabase migration new <name>` → édition SQL → `pnpm supabase db reset`
- Types regen après migration : `pnpm run gen:types` (wrapper `scripts/generate-types.sh`)

**Build Process Structure :**

- `pnpm build` → Next compile + Tailwind purge + service worker Serwist build
- Output `.next/` (gitignored)
- Vercel build : `pnpm build` + cache des `node_modules/.pnpm/`

**Deployment Structure :**

- **Production** : push `main` → Vercel deploy `fra1` (region EU)
- **Preview** : chaque PR → Vercel preview URL (datacentre EU, env preview Supabase optionnel)
- **DB migrations** : appliquées via GitHub Actions sur tag `release-*` → `supabase db push --linked` (pas en build runtime)
- **Secrets** : Vercel Environment Variables (Production / Preview / Development) + Vercel Encrypted

**Migration & Release flow :**

1. Dev local → migration SQL → test
2. PR → CI lint + typecheck + tests + e2e
3. Merge `main` → preview Vercel auto-déployée
4. Tag `release-vX.Y` → workflow `release.yml` → `supabase db push` + Vercel promote preview → prod

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility :**

Toutes les briques choisies en step-04 sont mutuellement compatibles et leurs versions sont alignées (mai 2026) :

| Couche        | Choix                                        | Compatibilité vérifiée                                     |
| ------------- | -------------------------------------------- | ---------------------------------------------------------- |
| Frontend      | Next.js 16.2 (App Router + Turbopack)        | ✅ Compatible Tailwind 4, next-intl, Serwist, Supabase SSR |
| Auth          | Supabase Auth magic-link via `@supabase/ssr` | ✅ Compatible Next.js middleware + Server Components       |
| DB            | Supabase Postgres + RLS                      | ✅ Compatible types generated, FTS bilingue                |
| Storage       | Cloudflare R2 (S3-compat)                    | ✅ Compatible AWS SDK v3, EU-resident                      |
| E-mail        | Brevo France                                 | ✅ Compatible nodejs + webhook HMAC standard               |
| Observabilité | GlitchTip Cloud EU (Sentry SDK compat)       | ✅ Compatible `instrumentation.ts` Next 16                 |
| PWA           | Serwist (successeur next-pwa)                | ✅ Compatible App Router + Turbopack                       |
| i18n          | next-intl 3.x + RTL via CSS logical          | ✅ Compatible Server Components                            |
| Validation    | Zod v4                                       | ✅ Compatible types generated Supabase                     |
| Tests         | Vitest 2 + Playwright 1.50                   | ✅ Compatible Turbopack + RSC                              |
| Déploiement   | Vercel fra1                                  | ✅ Compatible Supabase eu-central-1 (latence < 50ms)       |

**Aucune incompatibilité ni contradiction détectée** entre les couches.

**Pattern Consistency :**

- ✅ `snake_case` end-to-end DB ↔ types ↔ JSON cohérent avec types générés Supabase
- ✅ Discriminated union `Result<T>` cohérent entre Server Actions et Route Handlers
- ✅ Conventions de naming alignées avec écosystème Next.js + Postgres standard
- ✅ Logical CSS properties Tailwind cohérent avec RTL FR/AR (driver D7)
- ✅ Co-localisation Server Actions + schemas + composants cohérent avec App Router

**Structure Alignment :**

- ✅ Route groups `(public)`, `(community)`, `(comod)` séparent clairement les auth boundaries
- ✅ `app/[locale]/(public)/*` vs `app/(community)/*` cohérent avec décision locale-routing-public-only (ADR 0003)
- ✅ `lib/` organisé par domaine (supabase, auth, email, storage) — pas par type technique
- ✅ Tests co-localisés `.test.ts(x)` alignés avec conventions Vitest 2

### Requirements Coverage Validation ✅

**Couverture des 9 familles FR du PRD :**

| Famille FR               | Couverture architecturale                                                                                                                  | Status                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| F1 Admission             | `app/(community)/admission/` (demandeur) + `app/(comod)/admission/` (co-mod) + table `admission_requests` + e-mail Brevo + magic-link auth | ✅ Complet              |
| F2 Annuaire artisans     | `app/(community)/annuaire/` + `artisan/[slug]/` + table `artisans` + FTS bilingue + R2 photos                                              | ✅ Complet              |
| F3 Alertes               | `app/(community)/alertes/` + tables `alerts` + `alert_comments` + cron purge expirées                                                      | ✅ Complet              |
| F4 Guide                 | `app/(community)/guide/` + table `guide_entries` + workflow proposition/modération                                                         | ✅ Complet              |
| F5 Modération            | `app/(comod)/moderation/` + table `moderation_log` (lecture publique transparence)                                                         | ✅ Complet              |
| F6 Profil + RGPD         | `app/(community)/profil/` + scripts `export-rgpd.ts` + flow suppression cascade                                                            | ⚠️ Partiel (cf. Gap #5) |
| F7 Transparence          | `app/[locale]/(public)/transparence/` + lecture publique `moderation_log`                                                                  | ✅ Complet              |
| F8 Pages publiques + PWA | `app/[locale]/(public)/` + `app/manifest.ts` + `sw/` Serwist + `app/install/` tuto                                                         | ✅ Complet              |
| F9 Admin résidence       | `app/(comod)/admin/` + table `residences` + gestion co-mods                                                                                | ✅ Complet              |

**Couverture des NFRs critiques :**

| NFR                                           | Couverture architecturale                                                                 | Status                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------- |
| NFR sécurité / CNDP art. 43 (souveraineté EU) | Supabase eu-central-1 + Vercel fra1 + R2 EU + Brevo France + GlitchTip Cloud EU           | ✅ Complet                                   |
| NFR i18n FR/AR + RTL (D7)                     | next-intl + colonnes `_fr`/`_ar` + Tailwind logical properties + fonts auto-hostées       | ✅ Complet                                   |
| NFR Aïcha (≤30s ergonomie, NFR40)             | Skeleton screens + bouton ≥56px + magic-link sans password + ergonomie tranchée step-04   | ✅ Complet                                   |
| NFR coût (≤15€/mois MVP)                      | Stack hosting choisi sous budget, mais **dépend du tier Supabase**                        | ⚠️ Voir Gap #1                               |
| NFR open-source MIT                           | LICENSE + GitHub + mirror docs                                                            | ✅ Complet                                   |
| NFR privacy-first (no analytics tiers)        | Logger JSON serveur uniquement, pas de tracking client, GlitchTip self-hostable si besoin | ✅ Complet                                   |
| NFR perceived reactivity (D2)                 | `useOptimistic` + Suspense streaming + Vercel edge fra1 < 50ms Maroc                      | ✅ Complet                                   |
| NFR multi-tenant (D4)                         | `residence_id` discipline + RLS Postgres + ENUM rôles                                     | ✅ Complet (V1 monorésidence, code-ready V3) |
| NFR recoverabilité (D8)                       | Standards Next.js/Postgres + ADRs + runbook + types auto-générés                          | ✅ Complet                                   |
| NFR portabilité (D5)                          | Postgres + S3-compat + standards Next.js/REST + fonts auto-hostées                        | ✅ Complet                                   |

**Couverture des 5 user journeys du PRD :**

- ✅ Journey 1 (Admission demandeur → co-mod → onboarding) : flow complet documenté (cf. Data Flow step-06)
- ✅ Journey 2 (Découverte artisan + notation) : annuaire + FTS + fiche + rate-form + RLS
- ✅ Journey 3 (Création alerte + commentaires) : feed + cron expiration + notifications
- ✅ Journey 4 (Consultation guide + proposition) : routes + workflow modération
- ✅ Journey 5 (Profil + export RGPD + suppression) : flow self-service + script export

### Implementation Readiness Validation ✅

**Decision Completeness :**

- ✅ Toutes les versions verrouillées (Next 16.2, Tailwind 4, Supabase SDK 2.x avec nouvelles clés sb\_\*, Zod v4, next-intl 3.x, Serwist 9.x, Vitest 2, Playwright 1.50)
- ✅ Tous les fournisseurs externes choisis avec rationale (Brevo > Resend/Postmark pour conformité EU)
- ✅ Pré-arbitrages step-04 cohérents : FTS Postgres (no Algolia), magic-link only (no password), pas de Realtime au MVP, pas de Web Push (V1.5)

**Structure Completeness :**

- ✅ Arbre projet complet et explicite (step-06) avec **tous les fichiers de configuration nommés**
- ✅ Tous les boundaries documentés (API / Component / Service / Data)
- ✅ Intégrations externes mappées à des fichiers `lib/*` précis
- ✅ Migration SQL nommées et ordonnées (6 fichiers init)
- ✅ Workflow CI/CD défini (4 workflows GitHub Actions)

**Pattern Completeness :**

- ✅ 28 conflict points identifiés et arbitrés (naming DB/API/code, structure, format, communication, process)
- ✅ Examples + anti-patterns fournis pour chaque pattern
- ✅ Enforcement mécanique via ESLint custom rules + Husky + CI
- ✅ Process ADRs pour les déviations futures

### Gap Analysis Results

**Critical Gaps :** AUCUN bloquant absolu, mais 2 décisions à prendre **avant la story 1** :

**Gap #1 — Tier Supabase et politique de backup PITR**

- **Problème** : Supabase Free tier (qui rentre dans le budget 15€) n'inclut PAS le Point-in-Time Recovery. Seul Pro tier (~25 USD/mois) inclut PITR 7 jours. À 50€/mois (100 villas), c'est dans le budget — mais au MVP 15€, on serait sans PITR.
- **Options** :
  - (a) Accepter Free tier MVP + script `pg_dump` hebdo nocturne vers R2 (couverture imparfaite mais gratuite)
  - (b) Budget MVP relevé à 30€/mois pour passer Pro tier dès J1 (PITR 7j)
  - (c) Free tier + dump quotidien Edge Function vers R2
- **Recommandation** : (a) ou (c) au MVP avec NFR explicite "RPO 24h MVP, 1h post-bêta", puis (b) avant production publique
- **Impact** : story 1 ou ADR 0005 à créer

**Gap #7 — Tests automatisés des policies RLS**

- **Problème** : RLS est notre couche d'isolation principale (D4) ; un bug RLS = leak cross-user. Aucune mention de tests automatisés dans le pipeline CI.
- **Solution proposée** : ajouter une suite `e2e/security-rls.spec.ts` qui crée 2 users distincts et tente accès cross-user sur chaque table métier (artisans, ratings, alerts, alert_comments, guide_entries, admission_requests, profiles)
- **Impact** : ajout d'une story dans la séquence d'implémentation (entre RLS init et bêta)

**Important Gaps :**

**Gap #2 — Politique de rate limiting routes publiques**

- Status code 429 mentionné mais implémentation absente.
- **Solution** : Vercel WAF (rate limit gratuit) ou Upstash Redis EU (free tier) sur `/admission` + magic-link send
- ADR à créer (0005-rate-limiting)

**Gap #3 — Headers de sécurité (CSP, HSTS, Permissions-Policy)**

- Mentionnés dans `next.config.ts` mais non spécifiés
- **Solution** : Spec CSP stricte (`default-src 'self'`, fonts auto-hostées → pas de exception, images Supabase + R2 whitelisted) — à coder en story 1

**Gap #5 — Cascade de suppression compte (droit à l'oubli)**

- Flow décrit mais effet sur `ratings`, `alert_comments`, `moderation_log` non tranché
- **Options** : (a) hard delete → perte trace, (b) anonymisation `user_id` → `NULL` + display "Utilisateur supprimé", (c) tombstone avec user déactivé
- **Recommandation** : (b) — préserve l'utilité communautaire des notes et journal modération sans PII résiduelle. Aligné CNDP+RGPD.
- ADR à créer (0006-soft-delete-cascade)

**Nice-to-Have Gaps :**

**Gap #4 — Chiffrement at-rest documenté pour audit CNDP**

- Supabase chiffre nativement (AES-256 at rest). À documenter explicitement dans le manifesto + page transparence pour audit CNDP éventuel.

**Gap #6 — Seed initial co-mods sans secrets en clair**

- Migration `20260601000006_seed_residence.sql` doit créer 3-4 comptes initiaux ; e-mails en SQL = pas grave, mais éviter mots de passe (on est magic-link only, donc OK par construction). Procédure : SQL crée placeholders + script post-deploy invite les co-mods via magic-link.

**Gap #8 — Tests d'accessibilité automatisés**

- NFR Aïcha critique ; aucun test a11y en CI. Ajouter axe-core ou @axe-core/playwright dans `e2e/` + Lighthouse CI sur PR pour scores a11y ≥ 95.

### Validation Issues Addressed

Les gaps critiques (#1 PITR, #7 tests RLS) doivent être tranchés ou inscrits en story avant le démarrage de l'implémentation. Les gaps importants (#2 rate limit, #3 CSP, #5 cascade delete) doivent être adressés en story 1 ou ADR. Les nice-to-have (#4, #6, #8) sont à inclure en bêta.

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed (PRD 55 FRs / 55 NFRs / 5 journeys + 12 truths + 8 drivers + 20 cross-cutting)
- [x] Scale and complexity assessed (150 villas MVP, code-ready 10 résidences V3)
- [x] Technical constraints identified (CNDP art. 43, budget ≤15€, règle Aïcha, MIT)
- [x] Cross-cutting concerns mapped (auth, i18n, e-mail, observabilité, storage, PWA)

**Architectural Decisions**

- [x] Critical decisions documented with versions (toutes verrouillées mai 2026)
- [x] Technology stack fully specified (Next 16.2, Supabase, R2, Brevo, GlitchTip, Serwist, next-intl, Zod v4, Vitest, Playwright, pnpm)
- [x] Integration patterns defined (Server Actions, Route Handlers, webhooks HMAC, cron Bearer)
- [x] Performance considerations addressed (Vercel fra1 < 50ms, Suspense streaming, optimistic UI, Postgres FTS GIN indexes)

**Implementation Patterns**

- [x] Naming conventions established (DB snake_case plural, code kebab-case files + PascalCase components, etc.)
- [x] Structure patterns defined (App Router route groups, co-localisation, `_components/`, `lib/` par domaine)
- [x] Communication patterns specified (`Result<T>` discriminated union, JSON structured logging, pas d'event bus MVP)
- [x] Process patterns documented (error.tsx, loading.tsx, Zod 3-frontières, RBAC middleware)

**Project Structure**

- [x] Complete directory structure defined (arbre complet step-06)
- [x] Component boundaries established (Server/Client, \_components local vs ui partagé)
- [x] Integration points mapped (Supabase, Brevo, R2, GlitchTip, Vercel Cron — tous dans `lib/*` ou `app/api/*`)
- [x] Requirements to structure mapping complete (9 familles FR → 9 directories explicites)

### Architecture Readiness Assessment

**Overall Status :** **READY WITH MINOR GAPS**

Justification : 16/16 items de la checklist sont cochés, mais 2 Critical Gaps (#1 PITR, #7 tests RLS) doivent être adressés avant la story 1 — ils ne sont pas bloquants pour le **démarrage** mais doivent être tranchés tôt. Les 6 autres gaps (3 Important + 3 Nice-to-Have) sont gérables en cours d'implémentation.

**Confidence Level :** **HIGH**

Le PRD était particulièrement bien préparé (55 FRs structurés, 55 NFRs, 5 journeys, décisions pré-arbitrées). Les drivers D1-D8 ont guidé chaque décision de façon traçable. Les versions sont toutes verrouillées et compatibles.

**Key Strengths :**

- **Souveraineté EU vérifiée bout-en-bout** : chaque fournisseur (Supabase eu-central-1, Vercel fra1, R2 EU, Brevo France, GlitchTip DE, fonts auto-hostées) a une localisation explicite
- **Standards écosystème respectés partout** : Next.js conventions, Postgres conventions, REST conventions → un agent IA (ou un autre dev solo) peut reprendre sans surprise (D8)
- **Multi-tenant code-ready dès J1** : `residence_id` discipline + RLS rendent V3 (10 résidences) un changement RLS, pas un refactor
- **Coût maîtrisé** : stack entière dans ≤15€/mois MVP (sous condition Free tier Supabase) et ≤50€ à 100 villas (driver D6)
- **Recoverabilité optimisée** : SQL versionné, types auto-générés, ADRs, runbook, dump R2 — un dev nouveau peut reprendre le projet en moins d'une journée
- **Bilingue dès le modèle de données** : colonnes `_fr`/`_ar` natives, pas de gymnastique applicative (D7)
- **Surface d'attaque minimale** : magic-link only (pas de password à protéger), RLS sur 100% des tables sensibles, headers de sécurité, pas d'analytics tiers

**Areas for Future Enhancement (post-MVP) :**

- Supabase Realtime pour collaboration alertes (V1.5)
- Web Push notifications (V1.5)
- SMS magic-link via provider Maroc (V1.5 — pour les seniors sans e-mail)
- Migration de tier Supabase → Pro pour PITR (avant production publique)
- RLS-isolation cross-résidence (V3, quand multi-résidence activé)
- Inngest/Trigger.dev EU pour jobs queue si latence devient un problème

### Implementation Handoff

**AI Agent Guidelines :**

- Suivre **exactement** les décisions architecturales (versions, fournisseurs, patterns)
- Utiliser **strictement** les conventions de naming et structure du step-05/06
- Respecter les boundaries de service (`lib/supabase`, `lib/email`, `lib/storage`, `lib/logger`)
- Pour toute déviation → ADR obligatoire dans `docs/adr/`
- Référence canonique : ce document (`_bmad-output/planning-artifacts/architecture.md`)

**First Implementation Priority :**

Story 1 (séquence ordonnée à exécuter avant tout dev feature) :

1. `pnpm create next-app@latest darna --typescript --tailwind --app --src-dir=false --turbopack` (Next 16.2)
2. Installer addons : `pnpm add @supabase/ssr @supabase/supabase-js @serwist/next next-intl zod @sentry/nextjs` (Sentry SDK = GlitchTip compat)
3. Cloner depuis le starter "with-supabase" Vercel → adapter pour nouvelles clés `sb_publishable_*` / `sb_secret_*`
4. Setup `supabase` CLI : `pnpm supabase init` + lier au projet eu-central-1
5. Écrire 6 migrations init (schema + RLS + FTS + indexes + enums + seed)
6. Setup `instrumentation.ts` GlitchTip
7. Setup `middleware.ts` (locale + auth guards)
8. Setup `app/[locale]/layout.tsx` next-intl + RTL
9. Setup `lib/logger.ts` + `lib/env.ts` + `lib/supabase/{server,client,middleware}.ts`
10. ESLint custom rules + Prettier + Husky + lint-staged
11. CI workflow ci.yml (lint + typecheck + tests)
12. **ADR 0005 (rate limiting), ADR 0006 (soft-delete cascade), ADR 0007 (Supabase tier MVP)** rédigés
13. Premier déploiement Vercel preview EU

Une fois ces 13 items verts → démarrer les stories feature (F1 admission en premier, car débloque tout le reste).

## Gaps Resolution (post-validation, 2026-05-17)

Les 8 gaps identifiés en step-07 ont été tranchés avant le démarrage de l'implémentation.

### Gap #1 — Backup Supabase (Critical)

**Décision** : Free tier Supabase + dump SQL hebdomadaire vers Cloudflare R2 → **RPO 7 jours au MVP**.

- Implémentation : Edge Function `supabase/functions/weekly-backup/` qui exécute `pg_dump` (via `supabase db dump`) puis upload vers `r2://darna-backups/postgres/YYYY-MM-DD.sql.gz`
- Trigger : Vercel Cron dimanche 03:00 UTC (`app/api/cron/weekly-backup/route.ts`)
- Rétention : 12 backups (3 mois rolling), purge automatique en fin de cron
- **NFR explicite** : "RPO 7 jours au MVP, RPO 5min post-bêta après migration Pro tier"
- **Trigger de migration Pro** : ouverture publique à > 50 résidents actifs OU avant audit CNDP formel
- ADR à rédiger : `docs/adr/0007-supabase-tier-mvp-weekly-backup.md`

### Gap #5 — Cascade de suppression compte (Important)

**Décision** : Anonymisation soft-delete → `user_id` devient `NULL` sur les contenus contributifs, UI affiche "Utilisateur supprimé".

- Tables impactées : `ratings`, `alerts`, `alert_comments`, `guide_entries`, `moderation_log` (NULL admissible sur `user_id`)
- Table `users` : ligne supprimée (hard delete) ; aucune PII résiduelle
- Table `profiles` : ligne supprimée (cascade FK)
- Table `admission_requests` : ligne supprimée (cascade FK), sauf si déjà validée → mise à NULL pour conserver trace anonymisée dans `moderation_log`
- Photos artisans en R2 : conservées (pas de PII directe, contribution communautaire), URL artisan reste valide
- **Flow** : Server Action `deleteAccount()` → transaction Postgres → 1) anonymise contenus, 2) delete user + profile, 3) log dans `moderation_log` event `user.deleted`, 4) supabase.auth.admin.deleteUser()
- ADR à rédiger : `docs/adr/0006-soft-delete-cascade-anonymization.md`

### Gap #7 — Tests RLS automatisés (Critical) — _tranché_

**Décision** : Suite Playwright dédiée `e2e/security-rls.spec.ts` qui :

- Crée 2 users distincts (`alice`, `bob`) dans la même résidence + 1 user `eve` dans une 2e résidence simulée
- Tente accès cross-user et cross-résidence sur chaque table sensible (`artisans`, `ratings`, `alerts`, `alert_comments`, `guide_entries`, `admission_requests`, `profiles`)
- Pour chaque tentative : vérifie que RLS retourne `0 rows` ou erreur 403
- Bloque le merge dans CI si une seule fuite est détectée

Ajout au workflow `.github/workflows/ci.yml` → job `security-rls` requis avant promotion preview → prod.

ADR à rédiger : `docs/adr/0008-rls-isolation-tests.md`

### Gap #2 — Rate limiting (Important) — _tranché_

**Décision** : Upstash Redis EU free tier (Frankfurt, 10k req/jour gratuits) → middleware `lib/rate-limit.ts` appliqué à 3 endpoints :

| Endpoint                                        | Limite             | Raison                                               |
| ----------------------------------------------- | ------------------ | ---------------------------------------------------- |
| `POST /admission/submit` (Server Action)        | 5/jour/IP          | Anti-spam demande admission                          |
| Magic-link send (`supabase.auth.signInWithOtp`) | 3 / 15min / e-mail | Anti-abuse e-mail Brevo                              |
| `POST /api/webhook/brevo`                       | HMAC + 100/min/IP  | Déjà signé HMAC, rate limit en défense en profondeur |

- Réponse 429 avec `Retry-After` header + `message_key: errors.rate_limit.exceeded`
- ADR à rédiger : `docs/adr/0005-rate-limiting-upstash.md`

### Gap #3 — Headers de sécurité (Important) — _tranché_

**Décision** : CSP stricte + HSTS + Permissions-Policy minimale dans `next.config.ts`.

```ts
// next.config.ts (extrait)
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // 'unsafe-inline' nécessaire Next.js runtime ; durci en V1.5 via nonces
      "style-src 'self' 'unsafe-inline'", // Tailwind inject styles inline
      "img-src 'self' data: https://*.supabase.co https://*.r2.cloudflarestorage.com",
      "font-src 'self'", // Fonts auto-hostées, pas d'exception
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.brevo.com https://*.glitchtip.app https://*.upstash.io",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      'upgrade-insecure-requests',
    ].join('; '),
  },
];
```

- Codé en story 1 ; pas d'ADR (standard sécurité)

### Gap #4 — Chiffrement at-rest (Nice-to-Have) — _tranché_

**Décision** : Documentation explicite ajoutée à 2 endroits :

- **`docs/architecture.md` §Sécurité** (à créer) : "Toutes les données au repos sont chiffrées AES-256 par Supabase (Postgres + Storage). Les sauvegardes Cloudflare R2 sont chiffrées par défaut (AES-256). Aucune donnée transite ou est stockée hors UE (CNDP art. 43)."
- **Page publique `/transparence`** : section "Comment vos données sont protégées" en langage simple FR/AR (résidence Aïcha-compatible)

Pas d'ADR ; pure documentation.

### Gap #6 — Seed co-mods (Nice-to-Have) — _tranché_

**Décision** : Procédure en 2 temps, jamais de secret en SQL.

1. Migration `20260601000006_seed_residence.sql` : insère **uniquement** la résidence + ENUMs, **pas** les utilisateurs
2. Script `scripts/invite-co-mods.ts` (exécuté manuellement post-deploy) : lit `INITIAL_COMOD_EMAILS` (variable d'env Vercel, comma-separated) → pour chaque e-mail : `supabase.auth.admin.inviteUserByEmail()` avec rôle `co_mod` pré-assigné dans `app_metadata.role`
3. Variable d'env supprimée après usage

Sécurité : aucun e-mail co-mod en clair dans git. Procédure documentée dans `docs/runbook.md`.

Pas d'ADR ; pure procédure ops.

### Gap #8 — Tests d'accessibilité (Nice-to-Have) — _tranché_

**Décision** : 2 mécanismes complémentaires.

- **`@axe-core/playwright`** dans `e2e/a11y.spec.ts` : scan chaque page critique (5 user journeys) → fail si violation WCAG AA
- **Lighthouse CI** dans `.github/workflows/ci.yml` : workflow PR auto-run sur preview Vercel → seuils : accessibility ≥ 95, performance ≥ 80, best-practices ≥ 95
- Ajout au workflow `ci.yml` → job `a11y` non-bloquant en warning (devient bloquant avant bêta)

Pas d'ADR ; standard qualité.

### ADRs à rédiger en Story 1

Liste consolidée des Architecture Decision Records à créer avant le démarrage feature :

| #    | Titre                                  | Provient de                                           |
| ---- | -------------------------------------- | ----------------------------------------------------- |
| 0001 | `postgres-fts-search.md`               | Décision step-04 (pas d'Algolia/Meilisearch)          |
| 0002 | `brevo-email-provider.md`              | Décision step-04 (vs Resend/Postmark US)              |
| 0003 | `locale-routing-public-only.md`        | Décision step-04 (i18n routing scope)                 |
| 0004 | `rls-vs-fk-discipline.md`              | Décision step-02 (J1 FK-discipline, V3 RLS-isolation) |
| 0005 | `rate-limiting-upstash.md`             | Gap #2                                                |
| 0006 | `soft-delete-cascade-anonymization.md` | Gap #5                                                |
| 0007 | `supabase-tier-mvp-weekly-backup.md`   | Gap #1                                                |
| 0008 | `rls-isolation-tests.md`               | Gap #7                                                |

**Total** : 8 ADRs à rédiger dans la story 1 d'initialisation.

### Story 1 enrichie

La séquence de 13 items du § "First Implementation Priority" reste valide, avec ces ajouts :

- **Item 5** complété par : implémenter weekly-backup Edge Function + Vercel cron `weekly-backup`
- **Item 11** complété par : ajouter jobs `security-rls`, `a11y` (warning), Lighthouse CI dans `ci.yml`
- **Item 12** étendu à **8 ADRs** (0001 → 0008) au lieu de 3
- **Nouvel item 14** : créer `scripts/invite-co-mods.ts` + procédure runbook
- **Nouvel item 15** : section "Sécurité" dans `docs/architecture.md` (séparé, pas dans le doc présent) + draft page `/transparence`
- **Nouvel item 16** : implémenter `lib/rate-limit.ts` (Upstash) + appliquer aux 3 endpoints critiques

Story 1 = **16 items** au total avant story 2 (F1 admission).
