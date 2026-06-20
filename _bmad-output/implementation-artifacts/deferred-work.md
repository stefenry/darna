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

## Deferred from: code review of 1-9-profil-resident-deconnexion-suppression-compte-rgpd-cascade (2026-06-15)

- **`isAccountDeleted` fail-open (retourne `false` sur erreur DB ou exception)** [`lib/auth/is-account-deleted.ts:17`] — Décision spec : cohérent avec `markAdmissionEmailVerified` 1.7. Un blip DB laisse passer un compte supprimé. Pour un niveau RGPD plus strict : basculer à fail-closed (retourner `true` sur erreur = bloquer le login). Réévaluer en story 1.10 hardening.
- **Cron `purge-expired` : pas de pagination sur le `select`** [`app/api/cron/purge-expired/route.ts:26`] — Toutes les lignes `deleted_at < cutoff` chargées en mémoire. Non-problème à 150 villas MVP. À ajouter `.range(0, 99)` et paginer si volume > 500 (pré-bêta ou story 1.10).
- **Cron : pas de protection anti-replay / secret réutilisé** — Modèle CRON_SECRET standard Vercel. Un secret leaked permet de déclencher des purges en masse. Story 1.10 : ajouter un nonce timestamp dans le header ou valider via Vercel Cron signature (si disponible).
- **`profil/parametres/page.tsx` utilise `getUser()` brut au lieu de `requireResident()`** [`app/[locale]/community/profil/parametres/page.tsx`] — Le layout couvre la défense en profondeur. Uniformiser le pattern en remplaçant par `requireResident()` dans un refactor 1.10.
- **`requireResident()` ne vérifie pas `users.deleted_at`** [`lib/auth/require-resident.ts`] — Un utilisateur soft-deleted avec un JWT encore valide (fenêtre entre soft-delete et expiry du token) peut appeler les Server Actions. Adressé par `signOut({scope:'global'})` dans deleteAccount. Fenêtre résiduelle = TTL du JWT. Pour fermer complètement : ajouter un check `isAccountDeleted` dans `requireResident()` (story 1.10 hardening).

## Deferred from: code review of 1-8-validation-co-mod-file-admission-accept-reject-notification-decision (2026-06-15)

- **`generateLink({ type:'magiclink' })` vs guard `type !== 'email'` dans `/auth/confirm`** [`app/[locale]/comod/admission/actions.ts:229`] — Pré-existant story 1.6/1.7 (même pattern dans auth-signin.ts). Si Supabase ne convertit pas magiclink→email dans le token_hash URL, le magic-link bienvenue atterrit sur `/auth/error?reason=invalid`. Valider E2E obligatoire pré-bêta. Partagé avec deferred 1.7.
- **app_metadata sync failure → utilisateur accepté bloqué hors de /community/** [`app/[locale]/comod/admission/actions.ts:199`] — Si `updateUserById` échoue après la RPC commit, `users.role='resident'` mais JWT dit `demandeur`. Le proxy bloque `/community/`. Recovery : re-run `pnpm grant:comod` ou l'utilisateur clique un nouveau magic-link post-fix. Sentry `admission.app_metadata_sync_failed` est l'alerte. Décision MVP D3 (spec 1.8).
- **`isSafeActionLink` accepte `http:` dans actions co-mod** [`app/[locale]/comod/admission/actions.ts:38`] — Copie identique de story 1.6/1.7. Restreindre à `https:` uniquement en prod (conditionner sur `NODE_ENV`). Story 1.10 hardening.
- **`mapRpcError` collapse `not_found`/`wrong_residence`/`not_co_mod` → `errors.comod.decision_failed` générique** [`app/[locale]/comod/admission/actions.ts:49-55`] — Opérationnel : impossible de distinguer "demande introuvable" de "mauvaise résidence" dans les logs. MVP acceptable, à enrichir story 1.10 avec des codes distincts.
- **Tests manquants pour `not_found`/`wrong_residence` dans `mapRpcError`** [`tests/comod/validate-admission.test.ts`] — Coverage marginale. À ajouter story 1.10 quand mapRpcError sera enrichi.
- **co_mod peut accéder aux routes `/community/*`** [`proxy.ts`] — La garde proxy vérifie seulement l'authentification (pas le rôle résident) pour les routes community. Co-mods passent donc. Clarifier l'intention en epic 2 (liste blanche de rôles par route).
- **`grant-comod.ts` partial failure : auth.users créé si step 2/3 échouent** [`scripts/grant-comod.ts:66-82`] — Si `updateUserById` ou `users.update` échouent, le co-mod a un auth.users mais manque son `app_metadata`/`role`. Script idempotent : un second `pnpm grant:comod` récupère le cas. Documenter dans runbook ops avant prod.

## Deferred from: code review of 1-7-demande-d-admission-visiteur-demandeur-en-file-d-attente (2026-06-15)

- **Race condition : pas d'index unique partiel sur `(user_id, state='pending')`** — 2 soumissions simultanées créent 2 rows `pending` pour le même user ; co-mod doit dédupliquer manuellement. Story 1.10 hardening (risque documenté dans spec risk table 1.7).
- **`MAGIC_LINK_TTL_MINUTES = 15` affiché dans l'e-mail mais Supabase utilise son propre TTL dashboard (1h par défaut)** [`app/actions/admission-submit.ts:25`] — L'e-mail indique "expire dans 15 min" à tort. Pré-existant story 1.6 même pattern (`auth-signin.ts:22`). Factoriser en `lib/email/templates/constants.ts` + aligner TTL Supabase au dashboard (story 1.10 ou V1.5).
- **`generateLink({ type: 'magiclink' })` vs guard `type !== 'email'` dans `app/auth/confirm/route.ts:29`** [`app/actions/admission-submit.ts:119`] — Même pattern que story 1.6 (`auth-signin.ts:66`). Si Supabase ne convertit pas `magiclink` → `email` dans le redirect, tout magic-link landing atterrit sur `/auth/error?reason=invalid`. Valider E2E obligatoire pré-bêta avec un vrai clic de lien (Docker Colima down lors du dev 1.7).
- **SQL `GRANT UPDATE` inclut colonnes soft-delete (`deleted_at`, `deleted_by`, `deletion_reason`) pour rôle `authenticated`** [`supabase/migrations/20260615190000_add_admission_email_verified_at.sql:16`] — Sur-permission : un user authentifié via REST API Supabase + JWT pourrait soft-deleter sa propre row. Pattern pré-existant story 1.3 — column-level RLS policy bloque en pratique, mais le grant reste permissif. Story 1.10 hardening.
- **`RESIDENCE_ID_DARNA = '00000000-0000-0000-0000-000000000001'` hardcodé** [`app/actions/admission-submit.ts:20`] — UUID de résidence présupposé constant. Si le seed prod utilise un UUID différent, tous les INSERTs `admission_requests` échouent avec FK violation. Migrer vers `env.server.RESIDENCE_UUID` ou lookup DB (V3 multi-résidence).
- **`isSafeActionLink` accepte `http:` (cleartext)** [`app/actions/admission-submit.ts:30`] — Permet d'envoyer un magic-link en clair si `NEXT_PUBLIC_SITE_URL=http://...` (staging). Pré-existant story 1.6 même pattern. Restreindre à `https:` uniquement en prod (conditionner sur `NODE_ENV` ou forcer https dans env validation). Story 1.10 hardening.

## Deferred from: code review of 1-10c-tests-rls-a11y-ci (2026-06-15)

- **`parseServerEnv()` module-level dans `lib/env.ts` pourrait avorter le test file en CI** [`lib/env.ts`] — Si les vars prod (`SUPABASE_SECRET_KEY`, etc.) sont absentes dans le job `e2e-rls` et que le module les valide à l'import, le fichier de test entier échoue avant le premier `it`. Théorique (pnpm test passe localement), à valider lors du premier run CI avec Docker.
- **`notifications_prefs.residence_id` d'Eve pointe vers résidence 1** [`tests/rls.test.ts`] — Le trigger `trg_auth_users_after_insert` hardcode résidence 1 ; `makeCoMod` corrige `users.residence_id` mais pas `notifications_prefs`. Nettoyé par CASCADE via deleteUser. Sans impact sur les tests 1.10c ; à corriger si un test future vérifie l'isolation des notifications (epic 7).
- **`moderation_log` accumule des rows cross-runs locaux** [`tests/rls.test.ts`] — Après deleteUser, `actor_id` passe à NULL (SET NULL) mais la row persiste avec `residence_id = DARNA_RESIDENCE_ID`. Aucun impact sur les assertions actuelles (count-based >= 1). À surveiller si des assertions futures comptent des rows précises.
- **Job a11y : pages admission/login scannées en état d'erreur (pas de Supabase local)** [`.github/workflows/ci.yml`] — `pnpm start` sans `supabase start` → connexion refusée sur localhost:54321 → SSR échoue → axe scanne une error boundary ou un shell vide. Résultat a11y peut-être false-negative. Connu et accepté en spec (run déféré pré-bêta) ; à corriger avant bêta en ajoutant `supabase start` au job a11y ou en mockant le client Supabase.
- **`salmaId` utilisé comme `target_id` dans `moderation_log` au lieu de l'UUID de la demande** [`tests/rls.test.ts`] — `target_kind: 'admission_request'` + `target_id: salmaId` (user UUID) est sémantiquement incorrect ; le target_id devrait être l'UUID de la row `admission_requests`. Aucun impact sur les assertions du test (transparence publique). À corriger si une FK ou une contrainte CHECK est ajoutée sur `target_id`.

## Deferred from: code review of 1-10d-ops-backup-adrs-runbook-invite-comods (2026-06-17)

- **Partial state invite : `invited` sous-comptabilise si étape 2/3 échoue post-invite** [`scripts/invite-co-mods.ts`] — Si `updateUserById` ou `users.update` échouent après une invite réussie, l'utilisateur a un account Supabase mais manque son rôle. Le re-run idempotent récupère le cas (email_exists path retrouve le userId via listUsers et ré-applique le rôle). Documenté runbook §3.
- **Timing collision dimanche 03:00 : `purge-expired` + `weekly-backup` simultanés** [`vercel.json`] — Lecture seule pour le backup → safe au MVP. Si le backup réel (dump SQL) monopolise la connexion DB, décaler `weekly-backup` à 03:30. À réévaluer pré-bêta.
- **`SUPABASE_DB_URL` référencé dans le TODO de l'Edge Function mais absent de `lib/env.ts`** [`supabase/functions/weekly-backup/index.ts`] — Scaffold MVP. Ajouter à l'env schema + secrets CI lors de l'activation R2 pré-bêta.
- **Secrets R2 absents de `.env.example`** — Documentés dans runbook §4. Ajouter à `.env.example` comme commentaires lors de l'activation R2.
- **Pas de `maxDuration` sur la route Vercel backup** [`app/api/cron/weekly-backup/route.ts`] — Dump SQL peut dépasser 10-15s (timeout Vercel default) une fois R2 activé. Ajouter `export const maxDuration = 60` pré-bêta.

## Deferred from: code review of 2-1-schema-artisans-ratings-tags-bilingues-fts-postgres (2026-06-17)

- **RLS jamais exécutée réellement** [`tests/rls.test.ts`] — Suite gated `skipIf`, validée seulement sur un Postgres 16 nu avec stubs. AC2/AC3/AC8 prouvées par assertion, pas par run réel. Action avant merge : `pnpm supabase db reset && pnpm test:rls` avec Docker up.
- **`types.generated.ts` rédigé à la main** [`lib/supabase/types.generated.ts`] — Rejouer `pnpm gen:types` après `db reset` pour garantir l'identité byte-à-byte avec le générateur (résidu connu, Completion Notes #1).
- **`unique (artisan_id, user_id)` + ratings anonymisés NULL** [`migration:859`] — NULLs distincts en Postgres → accumulation de ratings `user_id IS NULL` non dédupliquables ; les calculs d'agrégats (story 2.2) doivent en tenir compte.
- **Aucun chemin client ne publie un artisan** [`migration:815,992`] — `state→published` réservé service-role (story 2.5) ; pas d'invariant `state='published' ⇔ published_at not null`. Par design ; l'annuaire reste vide pour les lecteurs jusqu'à 2.5.
- **`slugify` renvoie `''` pour entrées 100% non-latin/non-arabe** [`lib/slug/slugify.ts`] — Vérifié (emoji/cyrillique/CJK → `''`). Aucune garde ; à gérer au câblage DB en 2.4 (slug vide = `not null unique` accepté → premier gagne, suivants collisionnent via `withCollisionSuffix`).
- **Ré-notation = INSERT → `23505` (pas d'upsert)** [`migration:859`] — Le flow notation 2.6 devra faire un upsert ; le schéma ne fournit pas la sémantique « mise à jour » du commentaire.
- **Robustesse tests : collisions `Date.now()` + `RESIDENCE_2_ID` partagé entre suites** [`tests/rls.test.ts`] — Emails/slugs basés sur `Date.now()` (résolution ms) collisionnables sur machine rapide ; `RESIDENCE_2_ID` upserté puis supprimé par deux suites → couplage. Utiliser un compteur/crypto.randomUUID + isoler l'UUID par suite.
- **`afterAll` ignore des chaînes FK RESTRICT latentes** [`tests/rls.test.ts`] — Le cleanup échouera dès qu'un test 2.4/2.5 insérera des consent_tokens/artisan_tags (RESTRICT sur residence_id) ou un rating sur RESIDENCE_2.
- **`phone_e164` sans CHECK format ni unicité** [`migration:812`] — Accepte `''`/garbage/doublons ; la dédup (index trgm non-unique) est déférée à l'app 2.4.
- **`artisan_tags` INSERT autorisé sur parent pending/soft-deleted** [`migration:1057`] — `with check` ne vérifie que `created_by = auth.uid()` (pas `deleted_at`/state) ; aucun chemin client en 2.1.
- **Tombstoning slug non asserté via DB** [`migration:808`] — `slug not null unique` global (correct, couvre les lignes soft-deleted) mais aucun test ne prouve la non-réutilisation ; route 410 = story 2.3.

## Deferred from: code review of 2-2-annuaire-liste-avec-recherche-fts-bilingue-filtres-cache-offline (2026-06-17)

- **`pnpm test:rls` non rejoué (Docker requis)** [`tests/rls.test.ts`] — Vue agrégat `security_invoker` non validée sous auth réelle, DDL seulement testé sur PG16 nu. Bloquant avant merge : `pnpm supabase db reset && pnpm test:rls`. Même classe que résidu 2.1.
- **`pnpm gen:types` non rejoué — entrée `Views.artisan_rating_aggregates` saisie à la main** [`lib/supabase/types.generated.ts`] — Validée par `pnpm typecheck` mais pas garantie byte-à-byte avec le générateur. Rejouer après `db reset`.
- **Offline E2E (`pnpm dev:webpack` + navigateur) non vérifié** [`app/[locale]/community/annuaire/`, `sw/index.ts`] — AC4 « <100ms cached + bannière "il y a Xh" » non prouvé. Serwist KO sous Turbopack → non testable hors webpack + device. Le rendu offline de la liste depuis le cache JSON (vs SSR) est aussi un raffinement à câbler.
- **Annuaire vide sans seed service-role** [`app/[locale]/community/annuaire/page.tsx`] — Aucun chemin client ne publie `state='published'` avant story 2.5 → la page liste/recherche/filtre est invérifiable sans seed. Action : seeder via service-role.
- **`pickLocale` accepte whitespace-only AR comme "valide"** [`app/[locale]/community/annuaire/data.ts:31-33`] — `display_name_ar='   '` ou `'​'` est truthy → AR users verraient des labels vides. Non-applicable au MVP FR-only ; à corriger quand la locale AR sera activée (story 7.4).
- **`ArtisanCard` `tel:` `phoneE164` sans LTR isolation en RTL** [`app/[locale]/community/annuaire/_components/artisan-card.tsx`] — Préfixe `+` peut s'afficher du mauvais côté en AR. Non-applicable au MVP FR-only ; à corriger story 7.4.
- **`FiltersBar` `overflow-x-auto` ancré LTR en RTL** [`app/[locale]/community/annuaire/_components/filters-bar.tsx:48`] — Position initiale de scroll dans le mauvais sens en AR. Non-applicable au MVP ; story 7.4.
- **`EmptyState` CTA `/annuaire/nouveau` pointe 404 jusqu'à story 2.4** [`app/[locale]/community/annuaire/_components/empty-state.tsx:16-19`] — Slot intentionnel selon spec Task 8. Vérifier E2E à 2.4.
- **`CacheStamp` re-fetch côté client après le RSC** [`app/[locale]/community/annuaire/_components/cache-stamp.tsx`] — Chaque chargement annuaire = 2 lectures Supabase (RSC + route handler). Coût documenté pour MVP, à optimiser si la facture remonte.
- **Embedding cast `as unknown as ArtisanRow[]`** [`app/[locale]/community/annuaire/data.ts:104,121,129`] — Inférence supabase-js sur select imbriqué reste fragile. Tech debt typage documenté en Completion Notes par dev.
- **`error.tsx` `useTranslations` peut s'exécuter avant le `NextIntlClientProvider` sur erreur précoce** [`app/[locale]/community/annuaire/error.tsx`] — Si l'erreur survient avant le provider mount → cascade vers root error boundary. Rare, investigation hors scope 2.2.

## Deferred from: code review of 2-3-fiche-artisan-detaillee-action-tel (2026-06-17)

- **Statut HTTP 410 strict non émis sur la branche `gone`** [`app/[locale]/community/artisan/[slug]/page.tsx:42-56`] — Spec §410 Option 2 acceptée explicitement (UI gone + 200 OK) ; vrai 410 + enforcement tombstone défère à Story 6.1 (slugs canoniques + tombstoning). En attendant, patch immédiat envisagé : `robots: noindex` côté `generateMetadata`.
- **Double cast `as unknown as DetailRow` / `as unknown as CommentRow[]`** [`app/[locale]/community/artisan/[slug]/data.ts:85,162`] — Inférence supabase-js sur select imbriqué (artisan_tags + tags ; users) reste fragile. Tech debt typage cohérent avec annuaire 2.2. Documenté en Completion Notes par dev.
- **CTA `tel:` sticky sans `pb-[env(safe-area-inset-bottom)]`** [`app/[locale]/community/artisan/[slug]/_components/call-button.tsx:10`] — Cohérence projet : aucun composant n'utilise safe-area aujourd'hui ; à traiter globalement (Story 1.10c hardening ou dédiée mobile/PWA polish). Risque chevauchement gesture bar iOS sur la fiche.
- **Pas de pagination au-delà des 10 commentaires les plus récents** [`app/[locale]/community/artisan/[slug]/data.ts:159`, `_components/comments-list.tsx`] — Décision produit (spec « 10 plus récents »). Un 11e commentaire est silencieusement tronqué sans indication. À reconsidérer si feedback utilisateur post-MVP.
- **Qualité tests fiche artisan : assertions tautologiques + strings FR hardcodées + a11y `ContributorPanel` non testée** [`tests/artisan/artisan-fiche.test.tsx`] — `getByText(...).toBeDefined()` redondant (testing-library lève déjà), couplage au wording « Un voisin » non importé des clés i18n, et boutons `aria-disabled` du panel contributeur ne sont pas validés au lecteur d'écran. À reprendre post-MVP.
- **CTA `tel:` + i18n `t('call', { name })` sans `<bdi>` / `dir="auto"` pour script mixte en RTL** [`app/[locale]/community/artisan/[slug]/_components/call-button.tsx`] — En AR avec nom latin (« Yassine »), ordre des mots potentiellement cassé. Non-applicable au MVP FR-only ; cluster avec autres défauts RTL d'annuaire 2.2 (story 7.4 bascule langue).

## Deferred from: code review of 2-4-creation-fiche-artisan-workflow-consentement-sms-asynchrone (2026-06-18)

- **Strict bidi/Unicode sanitization sur `display_name_fr`** [`lib/validation/artisan.ts:14`] — Zero-width chars (U+200B-D, ZWJ), RTL override (U+202A-E, U+2066-9), zalgo (combining marks excessifs). Non-MVP ; cluster avec hardening i18n V1.5 / story 7.4-7.6.
- **Templates SMS AR absents** [`lib/sms/templates/`] — Convention `*.fr.ts` + `*.ar.ts` (cf. emails) violée, mais locale artisan inconnue à la création (un SMS unique FR au MVP). Réactivation V1.5 quand la cible peut choisir.
- **`INITIAL_COMOD_EMAILS` rendu optional sans guardrail** [`lib/env.ts:31-38`] — Régression silencieuse touchée par le diff 2.4 mais hors scope strict. Si vide en prod, `admission-submit` itère sur `[]` → aucun co-mod notifié. Action : log warning au boot + alerte runbook §3.
- **Brevo : retry exponentiel + idempotency-key absent** [`lib/sms/client.ts:24-64`] — Double-send risque sur 5xx/timeout transient. Production hardening à câbler avec provider provisionné.
- **Brevo : format recipient (`+212...` vs `212...`) non validé** [`lib/sms/client.ts:39`] — À vérifier à la provision du compte Brevo MA. Risque blocage tous les envois.
- **a11y form : `noValidate` + erreur générique en haut non focusée** [`_components/create-artisan-form.tsx:51-67`] — Server Actions valent ce trade-off, mais scroll-into-view du premier champ en erreur à câbler post-MVP.
- **Polyfills jsdom incomplets** [`tests/setup.ts:21-27`] — ResizeObserver présent ; IntersectionObserver / matchMedia / scrollTo absents → futurs tests Radix Select/Dropdown crasheront.
- **Qualité code mineure** : `Date.now()` comme `messageId` dans `sendSmsViaLog` non-unique, shadowing variable `body` dans `client.ts:43`, `id="consent_confirmed"` hardcodé vs `useId()` dans le form.
- **Atomicité INSERT artisan + consent_token via RPC `SECURITY DEFINER`** [`actions.ts:148-221`, Dev Notes §Atomicité] — Le dev a choisi l'alternative MVP « 2 INSERTs admin encadrés » (spec-compliant). Si stats d'orphans (artisan `pending_consent` sans token, ou avec token mais SMS jamais envoyé) deviennent significatives → câbler la RPC.
- **AR38 sémantique : status 401 vs 200/303 distinguent token forgé/valide** [`app/api/webhook/sms-consent/route.ts:60`] — Le contenu est identique mais le status code différent reste un signal observable. Indistinguabilité complète demande de renvoyer 200 + page identique côté webhook (refactor du flow PRG). Acceptable au MVP, à durcir post-bêta.
- **`UNIQUE (target_id, action)` sur `moderation_log` pour dedup naturel** [`supabase/migrations/20260524005559_init_schema.sql`] — 2e ligne de défense DB-side pour empêcher les doublons d'événements consent en cas de race. Si P1 (atomicité RPC) appliqué, moins critique.
- **Skeleton `loading.tsx` consent sans `dir` attribute** [`app/consent/[token]/loading.tsx`] — Flash LTR sur connexion lente avant que `<main dir>` ne rende en AR. Cosmétique.
- **Validation runtime explicite du slug Next router** [`app/consent/[token]/page.tsx:245`] — Slug `slugify` 2.1 = `[a-z0-9-]+` strict côté write. Pas de risque réel, défense en profondeur post-MVP.
- **Tag `key={tag.label}` collision React si même label** [`app/consent/[token]/page.tsx:202`] — Noms tags uniques par résidence en pratique. Fix : `key={tag.id ?? tag.key}` cosmétique.
- **Clock skew Node `Date.now()` vs PG `now()` sur `expires_at`** [`lib/consent/lookup.ts:55`, `RPC:57`] — Différence < 1s typique Vercel. UX désorientante rare (page valid mais POST → expired). Cosmétique.
- **P8 — Root layout `app/layout.tsx` sans `<html>/<body>`** [`app/layout.tsx`] — Ajouter `<html>` au root crée un conflit avec `app/[locale]/layout.tsx` qui le rend déjà (lang/dir dynamique). Refactor non-trivial : déplacer le `<html>` au root + driver lang/dir via cookie ou middleware-injected header. Note explicite ajoutée dans `app/layout.tsx`. Next 15+ avertit mais rend la page consent fonctionnellement.
- **P25 — Tests webhook + composant page consent** [`tests/`] — Tests webhook nécessitent un mock Route Handler + RPC + redirects + multi-content-type non trivial ; tests composant page utilisent `useActionState` (cluster avec limitation jsdom déjà documentée 2.4 P12). À reprendre dans le cluster E2E (1.10c expansion ou story dédiée).

## Deferred from: code review of story-2.6 (2026-06-19)

- **Scope bleed Story 2.7 dans le diff 2.6** [`app/[locale]/community/artisan/[slug]/noter/actions.ts:187-249`] — `retractOwnRating`/`retractOwnComment` (RPC `retract_own_rating`/`retract_own_comment`, migration `20260624090100_artisan_self_actions.sql` déjà présente) livrés alors que 2.7 est `ready-for-dev`. Non appelé par l'UI 2.6 → inoffensif, mais le working tree 2.6 est contaminé. Confirmer que le split 2.6/2.7 est intentionnel avant commit.
- **Pas de CHECK DB sur longueur `comment_text`** [`supabase/migrations/20260619090000_artisans_schema.sql`] — Colonne `text` nu ; borne ≤500 enforced uniquement par Zod (UTF-16 units) + `maxLength` client. Pas de défense-en-profondeur DB. Nécessite une migration `char_length(comment_text) <= 500` → hors scope 2.6 (no-migration). À câbler quand une migration ratings est rouverte.

## Deferred from: code review of story-2.8 (2026-06-20)

- **revoke/grant explicite sur `process_artisan_consent` re-créé** [`supabase/migrations/20260625090100_artisan_response.sql:390`] — La migration re-crée la RPC via `CREATE OR REPLACE` sans re-asserter `revoke … from public/anon/authenticated; grant … to service_role` (contrairement aux 2 nouvelles RPC). Fonctionnellement sûr (`CREATE OR REPLACE` préserve les privilèges de la migration antérieure), mais re-asserter le bloc durcit contre tout env de création fraîche + cohérence avec les autres RPC.
- **`Referrer-Policy: no-referrer` sur `/respond/[token]`** [`next.config.ts`] — Le token raw est dans l'URL. Le global `strict-origin-when-cross-origin` (1.10a) bloque la fuite cross-origin du path mais pas same-origin. Ajouter un `Referrer-Policy: no-referrer` dédié sur `/respond/*` (et `/artisan/contact`).
- **Content-Length 4KB bypassable (chunked / header absent)** [`app/api/webhook/artisan-respond/route.ts:49`] — `Number(null ?? 0)=0` passe le check puis `formData()` lit le corps sans cap dur en transfer-encoding chunked. Hérité du pattern 2.5 (même limitation sur `/api/webhook/sms-consent`). Borne DoS advisory. À durcir globalement (lire le stream avec cap dur) si abus mesuré.
- **Extraction `STRIP_CONTROL_AND_BIDI` de `consent.fr.ts`** [`lib/sms/templates/consent.fr.ts`] — Task 11 demandait d'extraire la regex en helper partagé. `lib/validation/sanitize.ts` ajoute bien `sanitizeUserText` (utilisé par les nouveaux chemins respond), mais `consent.fr.ts` garde sa regex locale dupliquée. Cleanup, zéro impact comportemental.
- **Notification e-mail/in-app au contributeur quand l'artisan répond** [Epic 7] — Au MVP, la fiche publique affiche la réponse (canal de surface suffisant). Notif différée V1.5 / Epic 7.
- **UI co-mod queue rectification** [Epic 5.x] — Les `artisan_rectification_requests` s'accumulent en `state='pending'` ; le traitement (accept → mutate `artisans` + log ; reject → log) arrive en Epic 5. Tracé via `moderation_log` action `artisan_rectification_requested` (FR33).
- **Timing equalize constant-time** [`app/artisan/contact/actions.ts:133`] — `sleep(150)` MVP approximatif (la branche `sent` fait un vrai appel SMS variable). Acceptable contre attaquant manuel + rate-limit phone, pas contre attaquant statistique en volume. V1.5 = `waitUntil` Vercel (SMS en background, réponse HTTP constante).

## Deferred from: dev of story-2.8 (2026-06-19)

- **UI co-mod queue de rectification** [`artisan_rectification_requests`] — Les demandes de rectification s'insèrent en `state='pending'` mais aucune UI co-mod ne les traite (accept→mutate artisan / reject). Les rows s'accumulent jusqu'à Epic 5.x (queue modération générique). Tracé dans `moderation_log` (`artisan_rectification_requested`).
- **Timing equalize constant-time** [`app/artisan/contact/actions.ts`] — `sleep(150)` MVP approximatif (le SMS Brevo varie 100-500ms) ne neutralise pas un attaquant statistique en volume. V1.5 : `waitUntil` (Vercel) pour envoyer le SMS en background task → réponse HTTP constante quelle que soit la branche. Atténué au MVP par le rate-limit phone (3/h).
- **Notification contributeur quand l'artisan répond** — Pas de notif e-mail/in-app au contributeur (la fiche publique affiche la réponse = canal de surface). V1.5 (e-mail) / Epic 7 (in-app).
- **Smoke E2E /artisan/contact → /respond → publication** — Flux webhook PRG + pages non e2e-testés (POST natif, incompatible jsdom `useActionState`). Cluster E2E 1.10c.
