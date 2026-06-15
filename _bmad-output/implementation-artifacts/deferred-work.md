# Deferred Work

> Items deferred from BMad reviews. Each section is added by `bmad-code-review` at review time.

## Deferred from: code review of story-1.1 (2026-05-24)

- **CodeBlock `setIcon` stocke une référence de fonction au lieu d'un élément React** [`components/tutorial/code-block.tsx:40-46`] — `useState(CopyIcon)` invoque `CopyIcon()` une fois (lazy initializer), mais `setIcon(CheckIcon)` stocke la fonction non-invoquée → React error « Functions are not valid as a React child » au clic « Copy ». Bug starter. Composant tutorial à supprimer en Story 1.4.
- **Login form en anglais dans une page `lang="fr"`** [`components/login-form.tsx:54-103`] — Hardcoded English (« Login », « Forgot your password? »…). i18n complet en Story 1.4.
- **Login form redirige vers `/protected` (starter)** [`components/login-form.tsx:42`] — Sera remplacé par le flow magic-link en Story 1.6.
- **Login form garde le password en state après échec** [`components/login-form.tsx:24,43-48`] — Polish UX/sécu, sera revu en Story 1.6 (magic-link, plus de password).
- **Proxy matcher redirige `/api/*` vers `/auth/login` (302 HTML)** [`proxy.ts:18`] — Pas de routes API en 1.1. À revoir quand on aura des Route Handlers (Story 1.2+).
- **`scripts/generate-types.sh` exit 0 silencieux** [`scripts/generate-types.sh:7-9`] — Stub explicitement câblé en Story 1.3.
- **ESLint `no-restricted-syntax` regex ne capture pas les template literals dynamiques** [`eslint.config.mjs:12-13`] — Couverture imparfaite (pas de classe construite par `${prefix}-N`). Acceptable au MVP, à durcir si besoin.
- **Tests existants n'ont pas de stub env pour les Supabase clients** [`tests/setup.ts`] — Risque latent dès qu'on testera un component qui importe `lib/supabase/client.ts`. À adresser quand le 1er test de ce type arrive.
- **`tsconfig` exclut `e2e/` → typecheck ne couvre pas Playwright specs** [`tsconfig.json:36`] — Conscient, sera adressé en Story 1.2 (CI) avec un job typecheck dédié pour `e2e/`.

## Deferred from: code review of story-1.2 (2026-05-24)

- **Projection jour-1 non fiable** [`scripts/budget-alert.ts:129`] — L'extrapolation linéaire donne des résultats aberrants le 1er du mois (1 jour de données × 30/31). Limitation connue de l'approche.
- **`cacheComponents: true` option Next.js non standard** [`next.config.ts:5`] — Pré-existant de story 1-1. À vérifier si l'option existe dans la version Next.js ciblée.
- **Estimation R2 basée uniquement sur le nombre de buckets** [`scripts/budget-alert.ts:63-66`] — `bucketCount * 0.015` sous-estime massivement. L'API Cloudflare `/r2/buckets` ne retourne pas les métriques d'usage. Utiliser `/r2/buckets/{name}/usage` quand le stockage grandit.
- **Vercel API v1/usage format de réponse incertain** [`scripts/budget-alert.ts:40-43`] — L'endpoint est une ancienne version. Le code fallback à 0 si la structure change. À vérifier avec un appel test réel.
- **Domaine expéditeur Brevo non vérifié** [`scripts/budget-alert.ts:97`] — `noreply@darna.app` doit être configuré comme domaine expéditeur vérifié dans Brevo, sinon les alertes atterrissent en spam.

## Deferred from: code review of story-1.3 (2026-05-24)

- **Proxy.ts redirige `/api/*` vers `/auth/login` (302 HTML)** [`lib/supabase/proxy.ts:1572-1581`] — Confirmé en 1.3 mais pré-existant (déjà listé pour 1.1). À fixer quand la première Route Handler API publique arrive (probable 1.6 magic-link callback ou 1.10 hardening).
- **Column-level GRANT/REVOKE défense en profondeur** [`supabase/migrations/20260524005600_init_rls.sql`] — Couches RLS suffisent au MVP mais les colonnes `role`, `residence_id`, `state`, `decision_reason`, `decided_by` mériteraient un `REVOKE UPDATE` explicite par rôle. Story 1.10 (hardening, ADR 0008 différée).
- **`profiles.villa CHECK between 1 and 150` hard-codé vs `residences.villa_count`** [`supabase/migrations/20260524005559_init_schema.sql:536,557`] — Contrainte statique alignée sur Darna MVP. À remplacer par un trigger validant contre `residences.villa_count` en V3 multi-résidence.
- **Indexes manquants sur `decided_by`, `actor_id`, `target_id`** [`supabase/migrations/20260524005601_init_indexes.sql`] — FK `ON DELETE SET NULL` provoquent des scans sur DELETE user. Négligeable à 150 villas, problématique V3.
- **`deleted_by` self-FK SET NULL perd l'audit si acteur supprimé** [`supabase/migrations/20260524005559_init_schema.sql:525`] — Cohérent avec Gap #5 anonymisation. Story 1.10 pourrait ajouter `deleted_by_snapshot_email text` non-FK pour préserver la trace.
- **Trigger `auth.users` ne handle pas UPDATE (banned_until → deleted_at)** [`supabase/migrations/20260524005559_init_schema.sql:645-648`] — Modération admin via Supabase Studio inefficace si user banni car `public.users` n'est pas mis à jour. V1.5+ quand outil modération admin envisagé.
- **`notifications_prefs` sans `created_at`** [`supabase/migrations/20260524005559_init_schema.sql:608-615`] — Spec AC4 ne le demandait pas. Historique opt-in/out non tracé. Ajustable V1.5 avec migration additive sans casser MVP.

## Deferred from: dev of story-1.5 (2026-06-14)

- **`pnpm build` passé à `next build --webpack`** [`package.json:8`] — Serwist 9.x ne génère pas `public/sw.js` sous Turbopack build (warning officiel). Migration future possible vers `@serwist/turbopack` (encore expérimental selon le warning Serwist) ou mode configurator. À ré-évaluer quand `@serwist/turbopack` quitte expérimental. Impact prod : build plus lent (4.4min vs ~2s Turbopack) mais SW généré correctement.
- **Icônes PWA placeholder (monogramme « D » programmatique)** [`public/icons/*.png`] — Generées via Node+zlib. Polish design final V1.5 (designer dédié). Tailles + safe-zone maskable corrects, l'identité visuelle restera à raffiner.
- **Screenshots iOS step-by-step placeholders** [`public/install/ios-step-{1,2,3}.png`] — Placeholders programmatiques. À remplacer par vraies captures iPhone réel pré-bêta (référencé `ux-design-specification.md` ligne 1443-1444).
- **Test device réel iOS WhatsApp WebView** [`/install` page] — La validation finale du flow Salma (QR + WhatsApp + bannière « Ouvrir dans Safari ») nécessite un iPhone physique avec WhatsApp. Test pré-bêta obligatoire.
- **Sentry `sentry.client.config.ts` deprecation Turbopack** [warning build] — Sentry recommande de migrer vers `instrumentation-client.ts` pour la compatibilité Turbopack future. Pas bloquant maintenant (build webpack), à faire avant migration `@serwist/turbopack`.

## Deferred from: code review of story-1.4 (2026-05-24)

- **Shadcn dropdown-menu.tsx utilise `data-[side=left/right]`** [`components/ui/dropdown-menu.tsx`] — Attributs Radix pré-existants, pas introduits en 1.4. Non-bloquant car ce sont des data-attributes d'animation, pas des propriétés de layout.
- **Fichier font Noto Sans Arabic Variable non vérifié** [`public/fonts/noto-sans-arabic-var.woff2`] — Le `@font-face` est commenté au MVP. À V1.5, vérifier que le fichier existe avant de décommenter le bloc CSS.

## Deferred from: code review of story-1.5 (2026-06-14)

- **iPad iPadOS 13+ en mode bureau routé desktop** [`lib/install/detect-os.ts:11-12`] — UA `Macintosh; Intel Mac OS X` sans token `iPad`/`iPhone` → page sert QR + instructions Edge desktop sur un iPad Safari. Raison du report : volume marginal au Maroc. À traiter V1.5 si télémétrie remonte des hits depuis iPad (détection client-side `maxTouchPoints>1 && platform==='MacIntel'`).
- **SW `skipWaiting + clientsClaim` agressifs** [`sw/index.ts:14-15`] — Prise de contrôle immédiate au déploiement peut interrompre Server Actions en vol. Raison du report : défaut Serwist accepté MVP. À revoir si incidents constatés sur Server Actions au déploiement (option : écouter `controllerchange` côté client + toast soft-reload).
- **PNG `public/install/ios-step-*.png` non localisés** [`public/install/ios-step-1..3.png`] — V1.5 AR : un utilisateur arabophone verra des captures Safari en FR (boutons « Sur l'écran d'accueil »). Polish V1.5.
- **`appleWebApp.title: "Darna"` codé en dur** [`app/[locale]/layout.tsx:28`] — Ignore la langue ; l'icône iOS reste « Darna » même installée depuis `/ar/install`. V1.5.
- **`lang: "fr"`/`dir: "ltr"` hard-codés dans le manifest** [`app/manifest.ts:13-14`] — Conforme décision MVP FR-only 2026-05-23. Le manifest étant unique par app, gérer le bilingue V1.5 implique soit deux manifests, soit accepter la dette LTR.
- **`intlMiddleware` peut redirect ; cookies Supabase posés sur la réponse de redirection n'arriveront pas** [`proxy.ts:56-77`] — Pré-existant 1.4. Risque de boucle session après redirect locale.
- **Check `app_metadata.role === 'co_mod'` non typé strict** [`proxy.ts:69`] — Pré-existant 1.4. Une faute de frappe (ex. `comod` vs `co_mod`) côté assignation fermerait silencieusement l'accès. À durcir story 1.10 (hardening RLS).
- **`getSessionUser` mute `request.cookies` puis `response.cookies`** [`proxy.ts:33-40`] — Pré-existant 1.4. Pattern Supabase SSR recommandé : reconstruire `NextResponse.next({ request })`. À revoir avec story 1.6 (magic-link) qui touche au flux auth.
- **Matcher proxy n'exclut pas `_rsc=` ni `next/data`** [`proxy.ts:84`] — Pré-existant 1.4. Conséquence : appel Supabase à chaque RSC fetch côté client → latence + risque boucle redirect. À adresser story 1.10.
- **`intlMiddleware(request)` non `await`-é** [`proxy.ts:56`] — Pré-existant 1.4. next-intl 4.x peut renvoyer une `Promise<NextResponse>` selon le chemin. Comportement potentiellement non déterministe.
- **`Permissions-Policy: geolocation=()` strict appliqué à toutes les routes** [`next.config.ts:25-28`] — Pré-existant 1.4. Bloque toute future feature géoloc (ex. recherche artisans à proximité). À assouplir si besoin produit. CSP également absente.
- **`withSentryConfig` appliqué inconditionnellement** [`next.config.ts:35-40`] — Pré-existant 1.1. En dev sans `SENTRY_AUTH_TOKEN`, Sentry instrumente quand même et ralentit le build. À conditionner sur `NEXT_PUBLIC_SENTRY_DSN` aussi.
- **CI Lighthouse skip silencieux si `VERCEL_TOKEN` absent (`exit 0`)** [`.github/workflows/ci.yml:45-50`] — Pré-existant 1.2. Fork sans secret = job vert sans aucune mesure. Story 1.5 a retiré le `continue-on-error` global mais l'escape hatch reste.
- **CI Lighthouse `seq 1 20 * 15s` sans backoff exponentiel** [`.github/workflows/ci.yml:55-66`] — Pré-existant 1.2. Pic Vercel → CI rouge sans rapport avec le code.
- **`package.json` épingle `next`, `@supabase/ssr`, `@supabase/supabase-js` à `latest`** [`package.json:21,24,25`] — Pré-existant 1.1. Reproductibilité dépend uniquement du `pnpm-lock.yaml`. Supply-chain à durcir story 1.10.
- **`corepack enable` sans pin de version pnpm dans CI** [`.github/workflows/ci.yml:15-19`] — Pré-existant 1.2. Le champ `packageManager` doit être ajouté à `package.json` pour fixer la version pnpm activée par corepack.
- **QR généré server-side à chaque requête, pas de mise en cache** [`app/[locale]/(public)/install/desktop-install.tsx:11`] — Acceptable au MVP, à revoir si trafic significatif sur `/install` desktop.
- **Test `manifest()` synchrone fragile si refactor async** [`tests/manifest.test.ts:5-15`] — Nitpick. À prendre en compte si AC4 évolue vers manifest dynamique par locale.

## Deferred from: code review of story-1.6 (2026-06-15)

- **Rate-limit Upstash signin (mail-bombing / Brevo quota)** [`app/actions/auth-signin.ts`] — Story 1.10 hardening, explicite dans le spec out-of-scope. Permet à un attaquant de spammer `auth.admin.generateLink` et brûler le quota Brevo / faire du mail-bombing contre une adresse victime.
- **Anti-enumeration timing leak signin** [`app/actions/auth-signin.ts`] — Valid email paie le coût Brevo (~plusieurs centaines de ms), invalid répond instantanément. Atténuer en 1.10 (wrapper constant-time ou fire-and-forget). Permet l'énumération des adresses inscrites par timing.
- **Magic-link template `lang="fr"` hardcodé** [`lib/email/templates/magic-link.fr.ts`] — V1.5 quand templates AR finalisés ; ajouter param `locale` au template + emit `lang`/`dir` cohérent.
- **Brevo 5xx traité comme erreur terminale (pas de retry/queue)** [`lib/email/client.ts:35-43`] — Story 1.10 hardening. Un blip Brevo perd définitivement un magic-link send.
- **`request_id` toujours null dans le logger** [`lib/logger.ts:592-597`] — Story 1.10 request-tracing (AsyncLocalStorage / header `x-request-id`). Le champ pollue Sentry pour rien tant que non plumb.
- **TTL magic-link hardcodée à deux endroits** [`app/actions/auth-signin.ts:21`, `scripts/supabase-auth-config.md`] — Drift acceptable MVP. À factoriser en `lib/email/templates/constants.ts` quand un 2e template arrive.
- **`INITIAL_COMOD_EMAILS` NBSP/unicode whitespace non gérés** [`lib/env.ts`] — Env hardening, follow-up story 1.1. Entrées séparées par U+00A0 silencieusement droppées.
- **Authorization community routes : uniquement authentication, pas role-based** [`proxy.ts:82-95`] — Un user `demandeur` peut accéder à `/fr/community/*` une fois authentifié. Pas bloquant 1.6 (routes communauté pas encore créées). Définir la policy en 1.10 ou epic 2.
- **403 Forbidden raw text sur route co_mod** [`proxy.ts:91-95`] — Pas de page i18n. À polish quand UI co_mod arrive (story 1.8/1.10).
- **Tests intégration route handlers `/auth/confirm` et `/auth/signout`** [`tests/auth/`] — AC8 n'exige pas ; à ajouter quand Playwright wiring magic-link mock arrive (V1.5).
