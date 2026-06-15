---
stepsCompleted:
  [
    'step-01-validate-prerequisites',
    'step-02-design-epics',
    'step-03-create-stories',
    'step-04-final-validation',
  ]
status: complete
finalized: 2026-05-23
totalEpics: 8
totalStories: 49
totalFRsCovered: 57
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/product-brief-SmartResidence.md
  - _bmad-output/planning-artifacts/product-brief-SmartResidence-distillate.md
---

# Darna - Découpage en Epics

## Vue d'ensemble

Ce document propose le découpage complet en epics et stories pour **Darna** (codename repo : SmartResidence), à partir du PRD finalisé le 2026-05-10 et de l'Architecture Decision Document validée le 2026-05-17. Aucun document UX spécifique n'a été produit — les exigences ergonomiques (règle Aïcha, Geste = WhatsApp, WCAG AA) sont portées par les NFR34-NFR40b et appliquées transversalement.

## Inventaire des Exigences

### Exigences Fonctionnelles (FR)

**Admission & Authentication**

- **FR1** : Un `Visiteur public` peut consulter les pages publiques (accueil, install, manifesto, transparence, légales) sans s'authentifier.
- **FR2** : Un `Visiteur public` peut soumettre une demande d'inscription en fournissant numéro de villa, tranche, prénom et e-mail OU numéro de téléphone.
- **FR3** : Un `Demandeur` reçoit un magic link sur le canal choisi (e-mail ou SMS) pour vérification de propriété de l'identifiant.
- **FR4** : Un `Demandeur` qui clique sur le magic link voit son identifiant vérifié et passe à l'état « en file d'attente ».
- **FR5** : Un `Demandeur` peut consulter l'état de sa demande (en attente / acceptée / rejetée) avec indication de SLA.
- **FR6** : Un `Co-mod` peut consulter la file d'attente d'admission avec les informations soumises (villa, tranche, prénom).
- **FR7** : Un `Co-mod` peut accepter ou rejeter une demande d'admission ; le rejet exige un motif choisi dans une liste fermée.
- **FR8** : Un `Demandeur` est notifié de la décision (acceptation ou rejet motivé) sur son canal d'inscription.
- **FR9** : Un `Résident` accepté dispose d'une session valide 12 mois renouvelée silencieusement à chaque accès actif.
- **FR10** : Un `Résident` peut se déconnecter explicitement de son appareil, et de tous ses appareils en bloc.
- **FR11** : Un `Résident` peut demander la suppression de son compte ; le `Système` exécute la suppression sous 7 jours avec cascade RGPD.

**Annuaire d'artisans**

- **FR12** : Un `Résident` peut consulter l'annuaire avec recherche full-text et filtres rapides (compétence, prix, facture, note).
- **FR13** : Un `Résident` peut consulter une fiche artisan détaillée (identité, compétences, notation typée, prix, facture, commentaires).
- **FR14** : Un `Résident` peut déclencher un appel téléphonique vers un artisan depuis sa fiche.
- **FR15** : Un `Résident` peut créer une fiche artisan (nom, téléphone, compétences ≥1, prix, facture, commentaire optionnel).
- **FR16** : Un `Résident` peut publier sa contribution en pseudonyme (par défaut) ou identité visible (opt-in mémorisé).
- **FR17** : Le `Système` envoie un SMS magic link à l'artisan référencé pour solliciter son consentement avant publication.
- **FR18** : Un `Artisan` ouvre le SMS magic link, voit comment sa fiche apparaîtra et accepte/refuse en un tap, sans compte permanent.
- **FR19** : Un `Résident` est notifié quand l'artisan a consenti et que sa contribution est publiée.
- **FR20** : Un `Résident` peut noter un artisan publié sur les axes typés (Dépannage / Petits travaux / Travail soigné / Urgences), 1-5 par axe, commentaire optionnel.
- **FR21** : Un `Résident` peut éditer ou retirer ses propres contributions à tout moment.
- **FR22** : Un `Artisan` peut, via un canal de droit de réponse, demander rectification ou publier une réponse à un avis.

**Modules de contenu durable**

- **FR23** : Un `Résident` peut consulter le **Guide résident** structuré en FAQ (thèmes, recherche, chaque entrée deep-linkable).
- **FR24** : Un `Résident` peut consulter les **Numéros utiles** en accès rapide.
- **FR25** : Un nouveau `Résident` accède automatiquement à un **Pack accueil nouveaux arrivants** lors de son premier login post-validation.
- **FR26** : Un `Co-mod` peut créer, éditer et retirer des entrées dans le Guide, les Numéros utiles et le Pack accueil.

**Modules de contenu éphémère**

- **FR27** : Un `Résident` peut publier une **alerte éphémère** à partir d'un modèle pré-rédigé en un tap.
- **FR28** : Une alerte éphémère **expire automatiquement** selon une durée définie à la publication (24h, 72h, 7j).
- **FR29** : Un `Résident` peut publier un **bon plan** typé et expirable avec date d'expiration explicite.
- **FR30** : Un `Résident` peut consulter la liste des alertes actives et bons plans non expirés, triés par fraîcheur.

**Modération & Transparence**

- **FR31** : Un `Résident` peut signaler tout contenu avec une raison sélectionnée dans une liste fermée.
- **FR32** : Un `Co-mod` peut retirer un contenu signalé, motiver le retrait, notifier l'auteur sous 24h.
- **FR33** : Le `Système` enregistre toutes les actions de modération dans un **journal public** consultable.
- **FR34** : Le `Système` applique le **soft-delete** sur les actions de modération (traçabilité, audit CNDP).
- **FR35** : Un `Co-mod` peut déclencher une escalade vers le contact juridique via workflow guidé.

**Partage & Cohabitation WhatsApp**

- **FR36** : Chaque entité dispose d'une **URL canonique** courte, lisible, stable.
- **FR37** : Un `Résident` peut copier l'URL canonique vers le presse-papier en un tap.
- **FR38** : Un `Résident` ouvrant une URL canonique depuis WhatsApp ou tout navigateur arrive directement sur l'entité.
- **FR39** : Un `Visiteur public` ouvrant une URL canonique communautaire est invité à s'inscrire/connecter avec contexte préservé.

**Notifications**

- **FR40** : Un `Résident` peut activer/désactiver indépendamment 3 catégories : alertes urgentes, nouvelles entrées annuaire, activité sur contributions.
- **FR41** : Le `Système` délivre les notifications via Web Push avec fallback e-mail si Web Push indisponible.
- **FR42** : Un `Co-mod` reçoit une notification automatique sur tout événement nécessitant son intervention.
- **FR43** : Le `Système` n'envoie aucun e-mail marketing ; communications transactionnelles ou opt-in strict.

**Engagement & Feedback léger**

- **FR43b** : Un `Résident` peut « aimer » (👍) un commentaire, alerte ou bon plan en un tap, compteur agrégé public, pas de 👎.
- **FR43c** : Un `Résident` peut soumettre une **suggestion d'évolution produit** via formulaire libre lu uniquement par les co-mods.

**PWA, i18n & Accessibilité**

- **FR44** : Un `Visiteur public` peut accéder à `/install` qui détecte son OS/navigateur et présente des instructions step-by-step adaptées.
- **FR45** : Un `Résident` peut utiliser Darna en mode lecture entièrement hors-ligne (annuaire, guide, pack accueil, numéros) après consultation initiale.
- **FR46** : Un `Résident` peut basculer la langue entre **français (LTR)** et **arabe (RTL)** depuis ses paramètres ; choix mémorisé.
- **FR47** : Le `Système` propose une langue par défaut au `Visiteur public` selon `Accept-Language`, FR si indéterminé.
- **FR48** : Le `Système` affiche le contenu éditorial dans la langue active, avec fallback FR si traduction absente.
- **FR49** : Un `Résident` peut consulter et utiliser toutes les fonctionnalités au clavier seul.
- **FR50** : Le `Système` respecte `prefers-reduced-motion` en désactivant transitions/animations non-essentielles.

**Données opérationnelles & Conformité**

- **FR51** : Le `Système` expose des compteurs publics agrégés (villas inscrites, artisans publiés, actions modération) sur `/transparence`.
- **FR52** : Le `Système` ne capture, ne stocke, ne transmet aucune donnée comportementale utilisateur côté client.
- **FR53** : Un `Résident` peut consulter et exporter ses propres données personnelles au format JSON (RGPD).
- **FR54** : Un `Co-mod` peut exporter le journal public de modération sur une période définie (audit CNDP).
- **FR55** : Le `Système` purge automatiquement les logs serveur après 30 jours.

### Exigences Non Fonctionnelles (NFR)

**Performance**

- **NFR1** : First Contentful Paint < 1.5s en 4G médian Maroc (Lighthouse CI p75).
- **NFR2** : Largest Contentful Paint < 2.5s en 4G médian.
- **NFR3** : Time to Interactive < 3.5s en 4G médian.
- **NFR4** : Cumulative Layout Shift < 0.1 sur toutes les pages.
- **NFR5** : Lighthouse PWA ≥ 90 sur accueil et annuaire.
- **NFR6** : Bundle JS initial < 150 KB gzippé.
- **NFR7** : Recherche annuaire renvoie résultats en < 300ms p95 sur 150 utilisateurs.
- **NFR8** : Fiche artisan en cache rendue en < 100ms (offline).
- **NFR9** : Test perf hebdomadaire sur Android entrée de gamme — pas de régression > 20% entre releases.

**Security & Privacy**

- **NFR10** : TLS 1.3 obligatoire, HSTS activé.
- **NFR11** : Auth exclusivement par magic link (e-mail ou SMS), aucun mot de passe.
- **NFR12** : Magic links expirent en 15 min, usage unique.
- **NFR13** : Sessions valides 12 mois, refresh silencieux, invalidables par l'utilisateur.
- **NFR14** : Donnée personnelle stockée uniquement en UE (Supabase eu-central-1, R2 EU).
- **NFR15** : Aucun service hors-UE dans la chaîne (Brevo France pour e-mail, provider SMS UE/CNDP).
- **NFR16** : Aucun cookie tiers, aucun tracker, aucune empreinte navigateur.
- **NFR17** : Soft-delete avec horodatage et acteur sur toutes actions de modération (CNDP audit).
- **NFR18** : Effacement de compte exécuté sous 7 jours max avec cascade RGPD/CNDP.
- **NFR19** : Données nominatives en transit chiffrées via canal provider.
- **NFR20** : Logs serveur retenus 30 jours max, purgés automatiquement.
- **NFR21** : Rôles et permissions vérifiés côté serveur sur chaque requête sensible.

**Scalability**

- **NFR22** : 150 utilisateurs simultanés sans dégradation perceptible (p95 < 500ms).
- **NFR23** : Coût d'infrastructure ≤ 15€/mois au MVP.
- **NFR24** : Coût ≤ 50€/mois à 100 villas.
- **NFR25** : Modèle de données « résidence »-paramétrable dès le MVP (`residence_id` FK).
- **NFR26** : Absorption d'un afflux de 10 inscriptions/heure sans dégradation.

**Reliability & Availability**

- **NFR27** : Disponibilité ≥ 99% sur heures de présence (7h-23h locale Maroc).
- **NFR28** : Aucun SLA formel 24/7 ; best-effort hors heures.
- **NFR29** : Code source mirroré GitHub + GitLab/Codeberg < 24h après commit (anti-bus-factor).
- **NFR30** : Runbook écrit documentant les procédures de recovery.
- **NFR31** : Gestionnaire de mots de passe partagé entre co-mods et initiateur, rotation à chaque départ.
- **NFR32** : Contact technique de secours désigné nominativement avec SLA 24h, avant bêta.
- **NFR33** : Sauvegardes Supabase activées (snapshot quotidien 7j minimum).

**Accessibility**

- **NFR34** : Lighthouse Accessibility ≥ 95 sur toutes pages MVP.
- **NFR35** : Contraste texte/fond ≥ 4.5:1 (WCAG AA) ; ≥ 3:1 sur grands textes.
- **NFR36** : Cibles tactiles ≥ 48×48 px sur tous éléments interactifs.
- **NFR37** : Toutes fonctionnalités MVP opérables au clavier seul.
- **NFR38** : Labels ARIA appropriés, testés VoiceOver iOS et TalkBack Android sur 5 parcours min.
- **NFR39** : `prefers-reduced-motion` respecté.
- **NFR40** : **Règle Aïcha** — toute fonctionnalité exécutable en < 30s par Aïcha sans aide, validé empiriquement en bêta.
- **NFR40b** : **Geste = WhatsApp** — ergonomie copie patterns familiers WhatsApp ; utilisateur WhatsApp intensif accomplit Journeys 1, 4, 5 sans tutoriel.

**Internationalization**

- **NFR41** : Support FR (LTR) et AR (RTL) au lancement MVP, bascule depuis paramètres.
- **NFR42** : Contenu éditorial (Guide, Pack accueil, Numéros) disponible en FR et AR au lancement.
- **NFR43** : Tags artisans entités bilingues structurées (FR+AR au MVP, ouvert pour Darija/Berbère V1.5).
- **NFR44** : Templates SMS et e-mail en FR et AR avec sélection automatique selon langue, fallback FR.
- **NFR45** : Direction LTR/RTL via CSS logical properties et `dir="rtl"` conditionnel, pas de feuille dupliquée.
- **NFR46** : Dates, nombres, devises localisés selon langue active (Intl API).
- **NFR47** : Aucune chaîne hardcodée — toutes UI passent par système i18n unique.

**Maintainability & Open Source**

- **NFR48** : Code publié en licence MIT sur GitHub public dès J1.
- **NFR49** : README en FR et EN documentant mission, stack, install, contributions.
- **NFR50** : Linter et formatter standards configurés dans CI.
- **NFR51** : Couverture tests automatisés « suffisante pour ne pas régresser » sur flux critiques (calibrée en bêta).
- **NFR52** : Pipeline GitHub Actions exécute lint + tests + Lighthouse CI sur chaque PR.
- **NFR53** : Documentation de fork structurée produite en V1.5 (hors chemin critique MVP).
- **NFR54** : Structure dossiers et conventions suivent les standards du framework (Next.js).
- **NFR55** : Toute modification structurelle documentée via ADR court dans `docs/adr/`.

### Exigences Additionnelles (Architecture)

**Starter Template (Story 1, Item 1)**

- **AR1** : Initialisation projet via `create-next-app --example with-supabase` (template officiel Vercel/Supabase, Next.js 16.2 + TypeScript + Tailwind 4 + Supabase Auth cookies + `@supabase/ssr`).
- **AR2** : Ajout des 3 briques manquantes : `@serwist/next` + `@serwist/precaching` + `@serwist/sw` + `idb` (PWA), `next-intl` (i18n FR/AR + RTL), `vitest` + `@vitejs/plugin-react` + `@testing-library/*` + `@playwright/test` (tests).
- **AR3** : Migration des anciennes clés Supabase `anon`/`service_role` vers nouvelles `sb_publishable_xxx`/`sb_secret_xxx` dès J1 (deprecation fin 2026).

**ADRs à rédiger en Story 1 (8 ADRs)**

- **AR4** : Rédiger les 8 ADRs (`docs/adr/0001-postgres-fts-search.md`, `0002-brevo-email-provider.md`, `0003-locale-routing-public-only.md`, `0004-rls-vs-fk-discipline.md`, `0005-rate-limiting-upstash.md`, `0006-soft-delete-cascade-anonymization.md`, `0007-supabase-tier-mvp-weekly-backup.md`, `0008-rls-isolation-tests.md`).

**Schéma de base de données et RLS**

- **AR5** : Migrations SQL versionnées (`supabase/migrations/20260601000001_init_schema.sql` à `20260601000006_seed_residence.sql`) — tables : `residences`, `users`, `profiles`, `artisans`, `ratings`, `alerts`, `alert_comments`, `tips`, `guide_entries`, `useful_numbers`, `pack_entries`, `moderation_log`, `suggestions`, `notifications_prefs`, `admission_requests`.
- **AR6** : RLS Postgres sur **100%** des tables avec données utilisateur (sauf `moderation_log` lecture publique pour transparence) ; policies par rôle (`resident`, `co_mod`, `demandeur`, `public`).
- **AR7** : Colonne `residence_id uuid not null references residences(id)` sur toutes entités utilisateur dès J1 (discipline multi-tenant, V3-ready).
- **AR8** : Types TypeScript générés via `supabase gen types typescript` à chaque migration, versionnés dans `lib/supabase/types.generated.ts`.
- **AR9** : Soft-delete via colonnes `deleted_at timestamptz` + `deleted_by uuid` + `deletion_reason text` sur entités modérables, avec trigger Postgres pour audit log immutable.
- **AR10** : Effacement RGPD via cron : marquage soft-delete immédiat + purge dure (DELETE cascade) à J+7, avec anonymisation `user_id → NULL` sur contenus contributifs (cf. Gap #5).

**Authentification et e-mail**

- **AR11** : Magic link **e-mail-only au MVP** via Brevo (Sendinblue, France) — `signInWithOtp({ email })` ; SMS magic link résident différé V1.5.
- **AR12** : Magic link **SMS** réservé au consentement artisan (FR17-18), provider à arbitrer en cours de Story 5 si Brevo ne couvre pas SMS Maroc.
- **AR13** : Cookies session httpOnly + Secure + SameSite=Lax via `@supabase/ssr`, validité 12 mois, refresh silencieux.
- **AR14** : DPA fournisseurs signés et stockés dans le runbook avant lancement : Supabase, Vercel, Cloudflare R2, Brevo, GlitchTip, provider SMS.

**Patterns d'implémentation (28 conflict points)**

- **AR15** : Conventions de naming respectées partout (DB `snake_case` pluriel, fichiers `kebab-case.tsx`, composants `PascalCase`, Server Actions `<feature>.actions.ts`, schémas Zod `<feature>.schema.ts`, slugs URL `kebab-case` ASCII).
- **AR16** : Server Actions Next.js par défaut pour toutes mutations ; Route Handlers REST réservés aux webhooks, sitemap, manifest, health.
- **AR17** : Validation Zod v4 sur 3 frontières strictes : (1) Server Actions inputs, (2) Route Handlers bodies, (3) env vars (`lib/env.ts`).
- **AR18** : Discriminated union `Result<T> = { ok: true; data: T } | { ok: false; error: { code, message_key } }` retournée par toutes Server Actions.
- **AR19** : Logger JSON structuré via `lib/logger.ts` sans PII (corrélation via `X-Darna-Request-Id`).
- **AR20** : Convention `snake_case` end-to-end DB ↔ types ↔ JSON (pas de couche de mapping camelCase).
- **AR21** : Skeleton screens via `loading.tsx` Next.js, jamais spinner seul (NFR40 règle Aïcha).
- **AR22** : Tailwind logical properties (`me-*`, `ps-*`, `start-*`) systématiquement, jamais `mr-*`/`pl-*`/`left-*` (banni par ESLint custom rule).
- **AR23** : ESLint custom rules + Husky + lint-staged + TypeScript strict (pas de `any`, pas de `@ts-ignore` sans justification).

**Infrastructure et CI/CD**

- **AR24** : Hosting Vercel `fra1` (Francfort) ; DB Supabase Cloud `eu-central-1` ; Storage Cloudflare R2 juridiction `eu` ; domaine `darna.org` chez registrar EU (Gandi recommandé).
- **AR25** : 4 workflows GitHub Actions : `ci.yml` (lint + typecheck + Vitest + Lighthouse CI sur PR), `e2e.yml` (Playwright nightly), `release.yml` (`supabase db push` + Vercel promote sur tag `release-*`), `mirror.yml` (sync GitLab/Codeberg toutes les heures).
- **AR26** : Observabilité errors via **GlitchTip Cloud (EU/Allemagne)** avec SDK Sentry-compatible ; sourcemaps uploadées via CI ; Vercel Analytics désactivé (NFR16).
- **AR27** : Lighthouse CI sur chaque PR avec seuils bloquants : PWA ≥ 90, Accessibility ≥ 95, Performance ≥ 80 (4G throttle).
- **AR28** : Budget alerting : GitHub Action cron quotidien qui pull les usages (Supabase + Vercel + R2 + Brevo APIs) et alerte si > seuil (15€ MVP, 50€ à 100 villas).
- **AR29** : Backup hebdomadaire Postgres → R2 (Vercel Cron dimanche 03:00 UTC, rétention 12 backups rolling, RPO 7 jours au MVP).

**Sécurité et conformité**

- **AR30** : Headers sécurité dans `next.config.ts` : HSTS `max-age=63072000; includeSubDomains; preload`, CSP stricte, X-Frame-Options DENY, Permissions-Policy minimale, Referrer-Policy `strict-origin-when-cross-origin`.
- **AR31** : Rate limiting via Upstash Redis EU (Frankfurt, free tier) sur 3 endpoints : `POST /admission/submit` (5/jour/IP), magic-link send (3/15min/email), webhook Brevo (HMAC + 100/min/IP).
- **AR32** : Tests RLS automatisés via `e2e/security-rls.spec.ts` (2 users distincts + 1 cross-résidence) → bloque le merge si fuite détectée.
- **AR33** : Tests accessibilité via `@axe-core/playwright` (`e2e/a11y.spec.ts`) + Lighthouse CI (seuils a11y ≥ 95, perf ≥ 80, best-practices ≥ 95).
- **AR34** : Procédure seed co-mods sans secrets en SQL : `scripts/invite-co-mods.ts` lit `INITIAL_COMOD_EMAILS` (env Vercel) → `supabase.auth.admin.inviteUserByEmail()` avec rôle `co_mod` pré-assigné.

**Internationalisation et fonts**

- **AR35** : `next-intl` 3.x avec dictionnaires `messages/fr.json` et `messages/ar.json` ; routing locale (`[locale]`) **uniquement pour pages publiques** (ADR 0003) ; entités communautaires routées sans locale, locale lue depuis cookie utilisateur via middleware.
- **AR36** : Fonts auto-hostées dans `public/fonts/` (Inter Variable + Noto Sans Arabic Variable) — pas de Google Fonts (D5 portabilité + D1 EU-only).

**Communication temps réel et webhooks**

- **AR37** : **Polling à l'ouverture** sur dashboard co-mods (file admission, signalements) ; pas de WebSocket, pas de Supabase Realtime au MVP.
- **AR38** : Webhook consentement artisan SMS : endpoint `POST /api/webhook/sms-consent` (ou `/api/webhook/brevo` selon provider) avec HMAC signature validée + idempotence via `event_id` UUID stocké + token magique URL expirant 7 jours.
- **AR39** : Cron Vercel `app/api/cron/purge-expired/route.ts` protégé par `Authorization: Bearer ${CRON_SECRET}` pour expiration alertes/bons plans.

**Vendor portability**

- **AR40** : Éviter Vercel-specific APIs quand un standard existe (préférer Server Actions standards) ; ADR systématique pour toute dépendance Vercel-specific (driver D5 portabilité).

### Exigences UX Design

_Aucun document UX Design dédié n'a été produit en amont. Les exigences ergonomiques et visuelles sont portées par les NFR34-NFR40b (accessibilité WCAG AA + règle Aïcha + Geste = WhatsApp) et appliquées transversalement à chaque epic. Une story dédiée Design System pourra émerger en V1.5 si une bibliothèque de composants type shadcn/ui est introduite._

### FR Coverage Map

| FR    | Epic   | Description courte                                              |
| ----- | ------ | --------------------------------------------------------------- |
| FR1   | Epic 1 | Pages publiques accessibles sans auth                           |
| FR2   | Epic 1 | Soumission demande d'inscription                                |
| FR3   | Epic 1 | Magic link e-mail (SMS V1.5)                                    |
| FR4   | Epic 1 | Vérification identifiant + file d'attente                       |
| FR5   | Epic 1 | Consultation état de la demande                                 |
| FR6   | Epic 1 | File d'admission côté co-mod                                    |
| FR7   | Epic 1 | Accept/reject demande avec motif fermé                          |
| FR8   | Epic 1 | Notification décision au demandeur                              |
| FR9   | Epic 1 | Session 12 mois renouvelée silencieusement                      |
| FR10  | Epic 1 | Déconnexion appareil + tous appareils                           |
| FR11  | Epic 1 | Suppression compte RGPD < 7j                                    |
| FR12  | Epic 2 | Annuaire avec recherche FTS + filtres                           |
| FR13  | Epic 2 | Fiche artisan détaillée                                         |
| FR14  | Epic 2 | Action `tel:` depuis la fiche                                   |
| FR15  | Epic 2 | Création fiche artisan                                          |
| FR16  | Epic 2 | Pseudonyme par défaut / identité opt-in                         |
| FR17  | Epic 2 | SMS magic link consentement artisan                             |
| FR18  | Epic 2 | Validation artisan asynchrone (sans compte)                     |
| FR19  | Epic 2 | Notification au contributeur quand consenti                     |
| FR20  | Epic 2 | Notation typée multi-axes 1-5                                   |
| FR21  | Epic 2 | Édition/retrait de ses propres contributions                    |
| FR22  | Epic 2 | Droit de réponse artisan                                        |
| FR23  | Epic 3 | Guide résident FAQ deep-linkable                                |
| FR24  | Epic 3 | Numéros utiles accès rapide                                     |
| FR25  | Epic 3 | Pack accueil nouveau résident                                   |
| FR26  | Epic 3 | CRUD co-mod sur contenu durable                                 |
| FR27  | Epic 4 | Alerte éphémère depuis modèle pré-rédigé                        |
| FR28  | Epic 4 | Auto-expiration alertes (24h/72h/7j)                            |
| FR29  | Epic 4 | Bon plan typé expirable                                         |
| FR30  | Epic 4 | Feed alertes + bons plans tri fraîcheur                         |
| FR31  | Epic 5 | Signalement contenu (raison fermée)                             |
| FR32  | Epic 5 | Retrait co-mod + notification auteur                            |
| FR33  | Epic 5 | Journal public d'actions                                        |
| FR34  | Epic 5 | Soft-delete + audit immuable                                    |
| FR35  | Epic 5 | Escalade juridique workflow guidé                               |
| FR36  | Epic 6 | URLs canoniques courtes stables                                 |
| FR37  | Epic 6 | Copie URL 1-tap (presse-papier)                                 |
| FR38  | Epic 6 | Deep linking depuis WhatsApp/navigateur                         |
| FR39  | Epic 6 | Capture contexte pré-login pour visiteur public                 |
| FR40  | Epic 7 | Préférences notifications 3 catégories opt-in                   |
| FR41  | Epic 7 | Web Push (V1.5 marker) + fallback e-mail                        |
| FR42  | Epic 7 | Notifications automatiques co-mods (hooks transverses Epic 1+5) |
| FR43  | Epic 7 | Zéro e-mail marketing (règle système)                           |
| FR43b | Epic 6 | 👍 1-tap sans modal                                             |
| FR43c | Epic 6 | Suggestion produit lue par co-mods uniquement                   |
| FR44  | Epic 1 | Page `/install` OS-aware                                        |
| FR45  | Epic 7 | Mode lecture hors-ligne (Service Worker)                        |
| FR46  | Epic 7 | Bascule FR (LTR) / AR (RTL) depuis paramètres                   |
| FR47  | Epic 7 | Accept-Language fallback pour visiteur                          |
| FR48  | Epic 7 | Contenu i18n fallback FR si traduction absente                  |
| FR49  | Epic 7 | Navigation clavier complète sur le MVP                          |
| FR50  | Epic 7 | `prefers-reduced-motion` respecté                               |
| FR51  | Epic 8 | Compteurs publics agrégés sur `/transparence`                   |
| FR52  | Epic 8 | Zéro analytics client (règle système)                           |
| FR53  | Epic 8 | Export JSON RGPD self-service résident                          |
| FR54  | Epic 8 | Export journal modération sur période (audit CNDP)              |
| FR55  | Epic 8 | Purge automatique logs serveur 30j                              |

**Couverture totale** : 57 FRs sur 57 (FR1-FR55 + FR43b + FR43c) → 100%.

## Epic List

### Epic 1 — Fondations techniques & Admission communautaire

**Goal :** Mettre en place toute la fondation technique (bootstrap Next 16 + Supabase + Serwist + next-intl, schéma + RLS multi-tenant, 8 ADRs, CI/CD, observabilité GlitchTip, rate limiting, backup hebdo, headers sécurité, fonts auto-hostées, page `/install` OS-aware) et délivrer le **parcours complet d'admission** : un visiteur public découvre Darna, installe la PWA, demande son admission, est validé/rejeté par un co-mod sous 24h, se connecte avec un magic link e-mail, gère sa session et peut supprimer son compte (RGPD < 7j).

**FRs couvertes :** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR44
**NFRs ancrées :** NFR10-13 (auth/sécurité), NFR14-21 (privacy + souveraineté EU), NFR23-26 (scalability + multi-tenant), NFR27-33 (reliability), NFR48-55 (open source + maintainability + CI), NFR40 (règle Aïcha sur le flux admission)
**ARs (Architecture) couvertes :** AR1-AR14, AR23-AR40 (infra, conventions, sécurité, backup, observability, rate limiting, fonts)
**User value délivrée :** Un nouveau résident comme Salma (Journey 3) peut découvrir Darna via QR code, installer la PWA, demander accès, recevoir la validation co-mod, se connecter. Karim (Journey 5) peut traiter la file d'admission. La règle Aïcha est validée sur ce parcours d'entrée.

---

### Epic 2 — Annuaire d'artisans noté (killer feature)

**Goal :** Délivrer le cœur de valeur produit : un résident peut trouver un artisan en 5 secondes (recherche FTS bilingue + filtres typés + fiche structurée + action `tel:` en premier rang), créer une fiche artisan en démarrant le workflow de consentement asynchrone CNDP-compliant (SMS magic link → page de revue artisan → publication), noter sur 4 axes typés (Dépannage / Petits travaux / Travail soigné / Urgences), commenter en pseudonyme par défaut ou identité visible, et éditer/retirer ses contributions. L'artisan référencé dispose d'un droit de réponse opérationnel.

**FRs couvertes :** FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22
**NFRs ancrées :** NFR1-9 (perf + recherche < 300ms p95), NFR17-18 (soft-delete + effacement), NFR41-47 (i18n FR/AR sur tags artisans + commentaires), NFR40b (Geste = WhatsApp), AR12 (SMS Brevo ou alternative), AR9 (soft-delete schéma)
**User value délivrée :** Journey 1 (Yassine cherche un plombier en 5s) et Journey 4 (Nadia poste une fiche artisan avec consentement async) opérationnels bout-en-bout.

---

### Epic 3 — Contenu durable : Guide résident, Numéros utiles, Pack accueil

**Goal :** Délivrer les 3 modules de contenu éditorial durable, alimentés par les co-mods : (1) Guide résident structuré en FAQ avec recherche et deep-linking par entrée, (2) Numéros utiles à accès rapide (poste de garde, syndic, urgences, pharmacie), (3) Pack accueil nouveaux arrivants mis en avant automatiquement lors du premier login post-validation. Interface CRUD co-mod pour création/édition/retrait dans les 3 modules.

**FRs couvertes :** FR23, FR24, FR25, FR26
**NFRs ancrées :** NFR8 (cache offline fiche < 100ms), NFR40 (Aïcha trouve un code en < 30s), NFR41-44 (contenu éditorial FR + AR au lancement), NFR42 spécifiquement (contenu Guide/Pack/Numéros en FR et AR)
**User value délivrée :** Journey 2 (Aïcha cherche le code du portail piéton) et le finale de Journey 3 (Salma découvre la résidence via le Pack accueil) opérationnels.

---

### Epic 4 — Contenu éphémère : Alertes & Bons plans

**Goal :** Délivrer les modules de contenu auto-expirables : (1) alertes éphémères à partir de modèles pré-rédigés (coupure d'eau, désinsectisation, chien perdu, etc.) avec durée d'expiration choisie à la publication (24h, 72h, 7j) et auto-purge par cron Supabase Edge Function, (2) bons plans typés expirables (offre voisin, prêt d'objet) avec date d'expiration explicite, (3) feed unifié des alertes actives + bons plans non expirés trié par fraîcheur.

**FRs couvertes :** FR27, FR28, FR29, FR30
**NFRs ancrées :** NFR1-6 (perf liste), NFR41-44 (i18n contenu et templates)
**User value délivrée :** Un résident est averti d'une coupure d'eau et peut partager un bon plan dans la communauté sans encombrer le feed à long terme.

---

### Epic 5 — Modération réactive & Transparence radicale

**Goal :** Délivrer le pilier "pureté horizontale + transparence radicale" : (1) tout résident peut signaler un contenu avec raison fermée, (2) tout co-mod peut retirer un contenu signalé sous 24h en motivant et en notifiant l'auteur, (3) toute action de modération est inscrite dans un **journal public** (`/transparence`) lisible par tout visiteur, (4) soft-delete + audit immuable conforme CNDP, (5) workflow d'escalade vers le contact juridique de recours pré-identifié (préparation d'un dossier de contexte avec liens vers le journal).

**FRs couvertes :** FR31, FR32, FR33, FR34, FR35
**NFRs ancrées :** NFR17 (soft-delete + horodatage + acteur), NFR21 (rôles vérifiés serveur), NFR27-28 (SLA 24h modération sur heures de présence)
**User value délivrée :** Journey 5 (Karim co-mod traite un signalement diffamatoire en 8 minutes) opérationnel. Toute la communauté peut auditer les actions de modération.

---

### Epic 6 — Partage WhatsApp, deep linking & engagement léger

**Goal :** Délivrer le pilier "cohabitation choisie avec WhatsApp" : (1) chaque entité (artisan, alerte, bon plan, page guide, numéros) dispose d'une URL canonique courte et stable, (2) copie 1-tap vers le presse-papier sans modal intermédiaire, (3) deep linking fonctionnel depuis WhatsApp ou tout navigateur (l'app installée s'ouvre directement sur l'entité), (4) un visiteur public ouvrant une URL communautaire est invité à s'inscrire avec contexte préservé post-login, (5) engagement léger via 👍 1-tap sur commentaire/alerte/bon plan (pas de 👎), (6) suggestion d'évolution produit via formulaire libre accessible depuis les paramètres, lue uniquement par les co-mods.

**FRs couvertes :** FR36, FR37, FR38, FR39, FR43b, FR43c
**NFRs ancrées :** NFR40b (Geste = WhatsApp), NFR16 (zéro cookie tiers — partage natif), NFR45 (RTL respecté dans share button)
**User value délivrée :** L'aha-moment du signal-clé qualitatif (un voisin répond à une question WhatsApp par un lien Darna) devient possible. Cohabitation WhatsApp formalisée.

---

### Epic 7 — Notifications, hors-ligne, langues & accessibilité avancée

**Goal :** Délivrer la couche d'expérience PWA et inclusive : (1) préférences notifications opt-in en 3 catégories indépendantes (alertes urgentes / nouvelles entrées annuaire / activité contributions), (2) Web Push avec fallback e-mail (Web Push marqué V1.5 par l'architecture — au MVP livraison e-mail-only via Brevo), (3) notifications automatiques co-mods, (4) règle système "zéro e-mail marketing", (5) mode lecture entièrement hors-ligne sur annuaire + guide + pack accueil + numéros via Service Worker Serwist + cache HTTP + queue background sync, (6) bascule de langue FR (LTR) / AR (RTL) depuis paramètres avec mémorisation, (7) fallback `Accept-Language` pour visiteur public, (8) fallback FR si traduction AR absente, (9) navigation clavier complète + `prefers-reduced-motion` respecté.

**FRs couvertes :** FR40, FR41, FR42, FR43, FR45, FR46, FR47, FR48, FR49, FR50
**NFRs ancrées :** NFR34-40 (Lighthouse a11y ≥ 95 + WCAG AA + Aïcha + cibles tactiles + ARIA), NFR41-47 (i18n complète), NFR50-52 (CI a11y), AR32-AR33 (tests RLS + a11y), AR35-AR36 (next-intl + fonts auto-hostées)
**User value délivrée :** Aïcha utilise Darna en arabe, hors-ligne dans le bus retour du marché. Un résident maîtrise ses notifications sans bruit, sans tracking, sans e-mail marketing.

---

### Epic 8 — Conformité opérationnelle, exports RGPD & compteurs publics

**Goal :** Délivrer le pilier "conformité radicale + transparence opérationnelle" : (1) page publique `/transparence` exposant les compteurs publics agrégés (villas inscrites, artisans publiés, actions de modération), (2) règle système "zéro analytics client" appliquée et auditable, (3) export RGPD self-service au format JSON pour tout résident (profil + contributions), (4) export du journal de modération sur période définie par les co-mods (audit CNDP), (5) purge automatique des logs serveur après 30 jours via cron, (6) section "Comment vos données sont protégées" en langage simple FR/AR sur `/transparence` (chiffrement AES-256, juridiction EU, DPA fournisseurs).

**FRs couvertes :** FR51, FR52, FR53, FR54, FR55
**NFRs ancrées :** NFR14-21 (privacy/CNDP/EU), NFR48-49 (open source + README FR+EN), NFR55 (ADR sur changements structurels)
**User value délivrée :** Tout visiteur (et toute autorité CNDP éventuelle) peut auditer Darna. Tout résident peut exporter ses données ou supprimer son compte avec garantie de cascade. Le critère "Zéro incident CNDP majeur sur 6 mois" devient mesurable et démontrable.

---

**Total : 8 epics couvrant les 55 FRs (100%). Aucun epic ne dépend d'un epic futur pour fonctionner ; tous s'appuient sur Epic 1.**

---

## Epic 1: Fondations techniques & Admission communautaire

Mettre en place toute la fondation technique (bootstrap Next 16 + Supabase + Serwist + next-intl, schéma + RLS multi-tenant, 8 ADRs, CI/CD, observabilité GlitchTip, rate limiting, backup hebdo, headers sécurité, fonts auto-hostées, page `/install` OS-aware) et délivrer le parcours complet d'admission : un visiteur public découvre Darna, installe la PWA, demande son admission, est validé/rejeté par un co-mod sous 24h, se connecte avec un magic link e-mail, gère sa session et peut supprimer son compte (RGPD < 7j).

### Story 1.1: Initialisation projet & toolchain de développement

As a solo dev (Stephane),
I want a fully bootstrapped Next.js 16 + Supabase project with PWA, i18n, tests packages installed and dev tooling enforced,
So that I can develop features productively from day one with strict guardrails.

**Acceptance Criteria:**

**Given** the repo doesn't yet exist
**When** I run `npx create-next-app@latest --example with-supabase darna` followed by `pnpm add @serwist/next @serwist/precaching @serwist/sw idb next-intl zod` and `pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @playwright/test`
**Then** the project boots with `pnpm dev` and renders the default landing without errors (AR1, AR2)

**Given** the starter is initialized
**When** I run `pnpm typecheck`
**Then** TypeScript strict (`"strict": true`, `"noImplicitAny": true`) passes with zero errors and no `any` is allowed without `// reason:` justification (AR23)

**Given** ESLint flat config with custom rules is set up
**When** I attempt to commit a file with `mr-4` or `ml-2` Tailwind class
**Then** a pre-commit hook (Husky + lint-staged) blocks the commit with a clear error referencing logical-properties enforcement (AR22, AR23)

**Given** `.env.example` is created
**When** I open it
**Then** it lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_*` format), `SUPABASE_SECRET_KEY` (`sb_secret_*` format), `BREVO_API_KEY`, `GLITCHTIP_DSN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `LEGAL_CONTACT_EMAIL`, `INITIAL_COMOD_EMAILS` — all blank (AR3)

**Given** `lib/env.ts` exists with Zod parsing of `process.env`
**When** the app starts and a required env var is missing
**Then** the app fails fast with a clear error referencing the missing key (AR17)

**Given** the project is structured
**When** I inspect the root
**Then** `tsconfig.json`, `eslint.config.mjs`, `prettier.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `tailwind.config.ts`, `.husky/pre-commit`, `.nvmrc`, `.editorconfig` all exist and are wired up

**Given** shared validation helpers are bootstrapped in `lib/validation/`
**When** I list the directory
**Then** `lib/validation/email.ts`, `lib/validation/villa-number.ts` (1-150) and `lib/validation/phone-e164.ts` (Maroc-friendly E.164: `+212` + 9 digits) exist with Zod schemas + Vitest tests, so subsequent stories (1.7 admission, 2.4 création artisan) can import them without forward-creating them ad-hoc

**And** `package.json` declares scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:watch`, `e2e`, `gen:types`

---

### Story 1.2: Pipeline CI/CD, observabilité GlitchTip & budget alerting

As a solo dev,
I want GitHub Actions workflows + GlitchTip Cloud EU + Lighthouse CI thresholds + automated budget alerting,
So that code quality, errors and infrastructure costs are enforced without manual oversight.

**Acceptance Criteria:**

**Given** `.github/workflows/ci.yml` is committed
**When** a PR is opened
**Then** lint + typecheck + Vitest + Lighthouse CI run on the Vercel preview URL and the workflow fails on any non-zero exit code (AR25)

**Given** Lighthouse CI is configured with assertions
**When** the workflow runs against a PR preview
**Then** it enforces PWA ≥ 90, Accessibility ≥ 95, Performance ≥ 80 (with 4G throttle) and the PR is marked failing if any threshold is missed (AR27)

**Given** `instrumentation.ts` wires up `@sentry/nextjs` with the GlitchTip DSN
**When** a Server Action or Route Handler throws
**Then** the error appears in GlitchTip Cloud EU with sourcemaps uploaded via the CI release step (AR26, NFR16)

**Given** Vercel Analytics is checked in `vercel.json` or project settings
**When** I inspect the project config
**Then** Vercel Analytics is disabled (privacy-first per NFR16)

**Given** `.github/workflows/budget-alert.yml` exists with a daily cron
**When** the workflow runs
**Then** it pulls Supabase + Vercel + R2 + Brevo usage via their APIs and sends an e-mail alert via Brevo if monthly cost > 15€ (MVP) or > 50€ (post-100 villas) (AR28)

**Given** `.github/workflows/release.yml` exists
**When** I push a `release-*` tag
**Then** it runs `supabase db push --linked` then promotes the latest preview to production via Vercel CLI

**Given** `.github/workflows/mirror.yml` exists
**When** the hourly cron fires
**Then** the GitHub repo is mirrored to GitLab.com and Codeberg.org repositories (NFR29)

**And** all workflows use minimal permissions (read-only secrets per workflow scope) and no third-party action without a pinned SHA

---

### Story 1.3: Schéma initial admission, RLS multi-tenant & types générés

As a solo dev,
I want the foundational database schema for the admission flow (residences, users, profiles, admission_requests, moderation_log) with RLS policies and generated TypeScript types,
So that the auth and admission features can be built on a sovereign, multi-tenant-ready foundation.

**Acceptance Criteria:**

**Given** migrations `20260601000001_init_schema.sql` through `20260601000006_seed_residence.sql` are committed
**When** I run `pnpm supabase db reset`
**Then** the following tables are created: `residences`, `users`, `profiles`, `admission_requests`, `moderation_log`, `notifications_prefs` — each with `residence_id uuid not null references residences(id)` (except `notifications_prefs` which links via `user_id`), `created_at timestamptz default now()`, `deleted_at timestamptz`, `deleted_by uuid`, `deletion_reason text` (AR5, AR7, AR9)

**Given** the `users` table is created
**When** I inspect the columns
**Then** it includes lifecycle columns `first_login_at timestamptz` (nullable) and `pack_accueil_dismissed_at timestamptz` (nullable) — used by Story 3.4 (Pack accueil post-validation) to track onboarding state without requiring a later `ALTER TABLE`

**Given** the `notifications_prefs` table is created
**When** I inspect it
**Then** it has columns `user_id uuid primary key references users(id) on delete cascade`, `alerts_urgentes_enabled bool default true`, `nouvelles_entrees_annuaire_enabled bool default false`, `activite_contributions_enabled bool default true`, `updated_at timestamptz default now()` — defaults match FR40 anti-spam policy; RLS allows users to SELECT/UPDATE only their own row (full UI delivered in Story 7.1 but the table exists from day one so Epic 4/5 dispatchers can read preferences)

**Given** RLS is enabled on every table created above
**When** I authenticate as a `demandeur` and query `admission_requests`
**Then** I can only SELECT the row matching `auth.uid()`, and any UPDATE/DELETE is refused — policy names follow `<table>_<role>_<action>` convention (AR6, AR15)

**Given** RLS policies are written
**When** I authenticate as `co_mod` and query `admission_requests`
**Then** I can SELECT all rows where `residence_id = (auth.jwt()->>'residence_id')::uuid` and `state = 'pending'`, and UPDATE state to `'accepted'`/`'rejected'`

**Given** RLS on `moderation_log`
**When** an unauthenticated request queries it
**Then** read is allowed (public transparence) but write is impossible from any client (system writes only via trigger or Server Action with service role)

**Given** `_seed_residence.sql` runs
**When** I query `select * from residences`
**Then** exactly 1 residence "Darna" exists with a stable UUID (used as FK throughout) and NO co-mod or user accounts are seeded in SQL (AR34 — accounts created via invite script post-deploy)

**Given** `pnpm run gen:types` runs after migration
**When** I import from `lib/supabase/types.generated.ts`
**Then** TypeScript types match the schema exactly with `snake_case` field names end-to-end (AR8, AR20)

**Given** all tables are created
**When** I inspect them
**Then** indexes follow `idx_<table>_<colonnes>` convention (AR15) — e.g., `idx_admission_requests_residence_id_state` for the co-mod queue query

**And** a `before_update` trigger on each table updates `updated_at` automatically (`trg_<table>_updated_at`)

---

### Story 1.4: Pages publiques, i18n FR/AR shell & middleware locale/auth

As a visitor,
I want to discover Darna via the public homepage in French (LTR) or Arabic (RTL) with proper language detection,
So that I understand the project's mission and posture before requesting access.

**Acceptance Criteria:**

**Given** `next-intl` is configured with `messages/fr.json` and `messages/ar.json`
**When** I navigate to `/fr` or `/ar`
**Then** the page renders in the corresponding language with `dir="ltr"` or `dir="rtl"` on the `<html>` element and the page's `lang` attribute reflects the locale (AR35)

**Given** the Accept-Language header is `ar-MA, ar;q=0.9, fr;q=0.8` and no locale cookie is set
**When** I open `/`
**Then** the middleware redirects me to `/ar` (FR47)

**Given** the Accept-Language header is missing or undetermined
**When** I open `/`
**Then** the middleware redirects me to `/fr` (FR47)

**Given** the public pages `/`, `/manifesto`, `/transparence` (stub), `/contact`, `/source`, `/legal/mentions`, `/legal/confidentialite`, `/legal/cgu` exist under `app/[locale]/(public)/`
**When** I open any of them unauthenticated
**Then** they render without any auth check and display content in my locale (FR1)

**Given** a translation key is missing in `messages/ar.json`
**When** the page renders in AR mode
**Then** the FR fallback string is shown and no hardcoded text appears in DOM (FR48, NFR47)

**Given** Tailwind logical properties (`me-*`, `ps-*`, `start-*`) are used throughout
**When** the page renders in RTL
**Then** layout reverses correctly, no visual break appears, and Lighthouse audits the page without RTL warnings (AR22, NFR45)

**Given** `middleware.ts` is implemented
**When** any request hits the server
**Then** it (a) injects the user locale from cookie (or Accept-Language fallback), (b) enforces auth guards on `(community)` and `(comod)` route groups (redirect to `/admission` if not authenticated, 403 if wrong role)

**And** auto-hosted fonts `Inter-var.woff2` (FR) and `NotoSansArabic-var.woff2` (AR) are served from `/public/fonts/` with no Google Fonts call (AR36, D5 portability)

---

### Story 1.5: Page `/install` OS-aware + manifest PWA + service worker shell

As a visitor on mobile,
I want a `/install` page that detects my OS/browser and shows step-by-step installation instructions with screenshots,
So that I can install the PWA confidently — particularly important for iOS Safari which has no native install prompt.

**Acceptance Criteria:**

**Given** I open `/install` on iOS Safari
**When** the page renders
**Then** I see step-by-step iOS instructions ("Partager → Sur l'écran d'accueil") with screenshots in my current locale (FR or AR), and a notice "Si vous ouvrez ce lien depuis WhatsApp, tapez ⓘ puis 'Ouvrir dans Safari'" (FR44, Journey 3)

**Given** I open `/install` on Android Chrome
**When** the page renders
**Then** I see the native "Installer Darna" button triggering `beforeinstallprompt`, plus fallback step-by-step instructions if the prompt is dismissed

**Given** I open `/install` on desktop
**When** the page renders
**Then** I see a message "Installation mobile recommandée" with a QR code linking back to `/install` and instructions to scan with my phone

**Given** `app/manifest.ts` is implemented
**When** I open Chrome devtools → Application → Manifest
**Then** the manifest is valid with `name`, `short_name="Darna"`, `theme_color`, `display="standalone"`, `start_url="/"`, and icons 192/256/512 (regular + maskable variants) (FR44)

**Given** Serwist `sw/index.ts` is configured with the `defaultCache` strategy + app shell precaching
**When** I run Lighthouse PWA audit on `/`
**Then** PWA score ≥ 90 (NFR5)

**Given** I install the PWA on iOS Safari
**When** I open it from the home screen
**Then** the app launches in standalone mode (no Safari chrome) and the splash screen uses `theme_color`

**And** a `next dev --webpack` script is documented in README for Serwist dev mode (Turbopack caveat documented)

---

### Story 1.6: Magic link e-mail (Brevo) + auth callback + cookies session 12 mois

As a demandeur,
I want to receive a magic link by e-mail and log in without any password,
So that I can prove ownership of my e-mail without credential storage anywhere.

**Acceptance Criteria:**

**Given** Brevo (Sendinblue, France) API key is configured in env vars
**When** `lib/email/send.ts` is called with a transactional template name + recipient + locale
**Then** Brevo delivers the e-mail within seconds in the requested locale (FR or AR), and the call returns a structured result (`{ok: true, message_id}` or `{ok: false, error}`) (AR11, AR16)

**Given** `lib/email/templates/magic-link.fr.ts` and `magic-link.ar.ts` are committed
**When** a magic link is requested
**Then** the appropriate locale template is selected based on the recipient's stored preference or detected `Accept-Language`, with FR as fallback (NFR44)

**Given** I submit my e-mail to request a magic link via `supabase.auth.signInWithOtp({ email })`
**When** the link is generated
**Then** it expires in 15 minutes and is single-use (Supabase native behavior; expiration configured in dashboard) (NFR12)

**Given** I click the magic link in my e-mail
**When** the request hits `app/auth/confirm/route.ts`
**Then** my Supabase session is established with cookies httpOnly + Secure + SameSite=Lax via `@supabase/ssr` (AR13)

**Given** my Supabase session is established
**When** the auth callback completes
**Then** I am redirected based on my admission state: no record → `/admission`, in queue → `/admission/pending`, `accepted` → `/(community)/`, `rejected` → `/admission/refused`

**Given** my session is established
**When** 12 months pass with periodic activity
**Then** my session cookie is silently refreshed without re-authentication (NFR13)

**Given** I am authenticated
**When** I click "Se déconnecter de cet appareil"
**Then** my session cookie is cleared and I land on `/` (FR10)

**Given** I am authenticated
**When** I click "Se déconnecter de tous mes appareils"
**Then** `supabase.auth.signOut({ scope: 'global' })` invalidates all my sessions across devices (FR10)

**And** all e-mail sending in the codebase goes through `lib/email/send.ts` — no direct Brevo SDK calls elsewhere (AR16, AR19 logger boundary)

---

### Story 1.7: Demande d'admission (visiteur → demandeur en file d'attente)

As a visitor (e.g., Salma — Journey 3),
I want to submit an admission request with villa number, tranche, prénom and e-mail,
So that the co-mods can review my request and welcome me into the community.

**Acceptance Criteria:**

**Given** I open `/admission`
**When** the form renders
**Then** it displays inputs: villa (numeric 1-150), tranche (A/B/C/D/E), prénom, e-mail — with Zod validation via `lib/validation/villa-number.ts` (1-150) and `lib/validation/email.ts` (AR17)

**Given** I submit valid data
**When** the `submitAdmissionRequest()` Server Action runs
**Then** (a) a row in `admission_requests` is created with `state='pending'`, `requested_at=now()`, my submitted fields, (b) a magic link is dispatched to my e-mail via Brevo (locale-detected from Accept-Language, defaults to FR), (c) all `co_mod` users receive a notification e-mail "Nouvelle demande en attente : villa X, prénom Y" (FR2, FR3, FR42)

**Given** I submit a villa number outside 1-150
**When** the Server Action runs
**Then** it returns `{ok: false, error: {code: 'villa_out_of_range', message_key: 'errors.admission.villa_out_of_range'}}` and the form shows the localized error (AR18)

**Given** I submit an e-mail that already has an active `admission_requests` row in state `pending`
**When** the Server Action runs
**Then** it returns `{ok: false, error: {code: 'duplicate_pending', message_key: 'errors.admission.duplicate_pending'}}` to prevent spam

**Given** my admission request is created
**When** I click the magic link in my e-mail
**Then** my e-mail is verified, the `admission_requests` row's `email_verified_at` is set, and I am redirected to `/admission/pending` showing "Ton inscription est en file. Un voisin va valider sous 24h max. Tu seras notifié par e-mail." (FR4, FR5)

**Given** I open `/admission/pending` while my request is pending
**When** the page renders
**Then** I see the current queue state with SLA indication (24h) and an "actualiser" button

**Given** I open `/admission/pending` after my request is accepted but before I login again
**When** the page renders
**Then** it tells me "Ta demande a été acceptée — vérifie tes e-mails pour te connecter"

**And** the entire admission form is achievable in ≤ 30s by Aïcha (NFR40 validated empirically in beta), with `loading.tsx` skeleton — not spinner (AR21)

---

### Story 1.8: Validation co-mod (file admission + accept/reject + notification décision)

As a co-mod (e.g., Karim — Journey 5),
I want a queue interface where I can accept or reject admission requests with a fixed-list motive,
So that admissions are processed under 24h transparently and the journal public records every decision.

**Acceptance Criteria:**

**Given** I am authenticated as `co_mod` and I open `/(comod)/admission`
**When** the page renders
**Then** I see a list of pending `admission_requests` filtered by my `residence_id`, showing villa, tranche, prénom, requested_at, with one-tap "Valider" and "Rejeter" buttons (FR6)

**Given** I am authenticated as `resident` and I try to open `/(comod)/admission`
**When** the page hits the middleware
**Then** I receive a 403 response with localized error page (NFR21)

**Given** I tap "Valider" on a request
**When** `validateAdmission()` Server Action runs
**Then** in a transaction: (a) the requester's `users` row is created (or updated) with `role='resident'`, (b) `admission_requests.state='accepted'`, (c) `moderation_log` records the event `admission.accepted` with my co_mod id, (d) a Brevo e-mail "Bienvenue sur Darna 👋" is sent to the requester with a fresh magic link to log in, in their detected locale (FR7, FR8)

**Given** I tap "Rejeter" on a request
**When** the rejection form opens
**Then** I must select a motive from a fixed enum list (`villa_out_of_range`, `duplicate`, `incomplete_info`, `manual_review_needed`) before submission can succeed (FR7)

**Given** I confirm rejection with a motive
**When** the Server Action runs
**Then** (a) `admission_requests.state='rejected'`, `rejection_reason=<motive>`, (b) `moderation_log` records `admission.rejected` with motive + co_mod id, (c) a neutral Brevo e-mail is sent to the requester with the localized motive (e.g., "Numéro de villa hors résidence — vérifiez votre numéro et soumettez une nouvelle demande") (FR7, FR8)

**Given** the co-mod queue receives a new request
**When** the request is INSERTed
**Then** all `co_mod` users of that residence receive an e-mail notification (FR42)

**Given** I open `/(comod)/admission` after another co-mod has just validated a request
**When** the page loads
**Then** the queue is refreshed via polling on page open (no WebSocket, AR37) — the just-validated request no longer appears

**And** all `validateAdmission()` and `rejectAdmission()` Server Actions use Zod input validation, return `Result<T>` discriminated union, and log structured events via `lib/logger.ts` without PII (AR17, AR18, AR19)

---

### Story 1.9: Profil résident, déconnexion & suppression compte RGPD cascade

As a resident,
I want to view my profile, log out from individual or all devices, and delete my account with full RGPD cascade,
So that my data sovereignty rights are operational and auditable.

**Acceptance Criteria:**

**Given** I open `/(community)/profil`
**When** the page renders
**Then** I see my villa, tranche, prénom, e-mail (read-only at MVP), my display preferences (locale, visibility default pseudonym/named), and stubs for notification toggles (full UI delivered in Epic 7) (FR16)

**Given** I open `/(community)/profil/parametres`
**When** the page renders
**Then** I can change my visibility default (pseudonym vs named) and my locale preference; changes persist immediately (FR16, FR46)

**Given** I open `/(community)/profil/supprimer`
**When** the page renders
**Then** I see a "Danger Zone" with explicit cascade description: "Tes contributions (avis, commentaires, alertes, etc.) seront anonymisées (mention 'Voisin supprimé'). Tes données personnelles seront purgées sous 7 jours conformément RGPD." (FR11)

**Given** I confirm account deletion (with typed confirmation phrase)
**When** `deleteAccount()` Server Action runs
**Then** within a single Postgres transaction: (a) all my contributions in `ratings`, `alert_comments`, `guide_entries`, `moderation_log` are anonymized via `user_id = NULL` + display_name overridden, (b) my `users` and `profiles` rows are hard-deleted, (c) `moderation_log` records `user.deleted` event WITHOUT my PII, (d) `supabase.auth.admin.deleteUser()` is called to invalidate the auth record (AR10, FR11, NFR18)

**Given** a Vercel Cron `purge-expired` runs daily at 03:00 UTC
**When** the cron executes
**Then** soft-deleted accounts older than 7 days have any remaining residual data hard-purged, and `moderation_log` records `purge.completed` events (FR11, NFR18, NFR55)

**Given** I am authenticated on this device
**When** I tap "Se déconnecter de cet appareil"
**Then** my session cookie is cleared and I land on `/` (FR10)

**Given** I am authenticated
**When** I tap "Se déconnecter de tous mes appareils"
**Then** `supabase.auth.signOut({scope: 'global'})` invalidates all my sessions across devices (FR10)

**And** the cron endpoint `app/api/cron/purge-expired/route.ts` is protected by `Authorization: Bearer ${CRON_SECRET}` and returns 401 without it (AR39)

---

### Story 1.10: Hardening — rate limiting, headers sécurité, tests RLS/a11y, backup hebdo, ADRs

As a solo dev / co-mod,
I want operational hardening (Upstash rate limiting, security headers, automated RLS + a11y tests, weekly backup, 8 ADRs and runbook),
So that the platform is production-ready and audit-defensible before beta.

**Acceptance Criteria:**

**Given** Upstash Redis EU (Frankfurt) free tier is configured with `UPSTASH_REDIS_REST_URL` + token in env
**When** the same IP submits 6 admission requests in 24h
**Then** the 6th request returns HTTP 429 with `Retry-After` header and `message_key='errors.rate_limit.exceeded'` (AR31)

**Given** magic-link send is rate-limited
**When** the same e-mail requests 4 magic links within 15 minutes
**Then** the 4th request is throttled with localized error (AR31)

**Given** webhook endpoints exist
**When** `/api/webhook/sms-consent` receives a request
**Then** HMAC signature is validated before any processing AND rate limit of 100 req/min/IP is enforced (AR31, AR38)

**Given** `next.config.ts` declares security headers
**When** I curl any page
**Then** response headers include `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`, and a strict `Content-Security-Policy` with `default-src 'self'`, fonts auto-hosted only, connect-src whitelisted to Supabase + Brevo + GlitchTip + Upstash (AR30, NFR10)

**Given** `e2e/security-rls.spec.ts` runs in CI
**When** the test creates 2 users `alice` and `bob` in the same residence + 1 user `eve` in a simulated 2nd residence
**Then** all cross-user and cross-residence access attempts on `artisans`, `ratings`, `alerts`, `alert_comments`, `guide_entries`, `admission_requests`, `profiles` return 0 rows or 403 — any leak fails the CI workflow as a blocking error (AR32)

**Given** `e2e/a11y.spec.ts` runs with `@axe-core/playwright`
**When** the test scans the 5 user journeys' key pages
**Then** WCAG AA violations are reported as warnings at MVP and as blocking errors before beta launch (AR33)

**Given** Vercel Cron `weekly-backup` runs every Sunday at 03:00 UTC
**When** the function executes
**Then** a SQL dump is generated (via Supabase Edge Function `supabase/functions/weekly-backup/`) and uploaded to `r2://darna-backups/postgres/YYYY-MM-DD.sql.gz` with 12-week rolling retention; missing or failed runs alert via Brevo (AR29, NFR33)

**Given** `docs/adr/` directory exists
**When** I list its contents
**Then** 8 ADRs are present, each with sections Context / Decision / Consequences / Status: `0001-postgres-fts-search.md`, `0002-brevo-email-provider.md`, `0003-locale-routing-public-only.md`, `0004-rls-vs-fk-discipline.md`, `0005-rate-limiting-upstash.md`, `0006-soft-delete-cascade-anonymization.md`, `0007-supabase-tier-mvp-weekly-backup.md`, `0008-rls-isolation-tests.md` (AR4)

**Given** `docs/runbook.md` exists
**When** I read it
**Then** it documents (1) recovery procedures (loss of domain / Supabase / Vercel / R2 access), (2) secrets rotation procedure (1Password Families shared vault), (3) `INITIAL_COMOD_EMAILS` invite procedure with `scripts/invite-co-mods.ts` (AR34), (4) weekly backup verification checklist, (5) emergency contact (technical fallback dev + legal recourse contact) with SLA (NFR29-NFR32)

**And** `scripts/invite-co-mods.ts` reads `INITIAL_COMOD_EMAILS` env var (comma-separated), calls `supabase.auth.admin.inviteUserByEmail()` with `app_metadata.role='co_mod'` pre-assigned, then the script reminds the operator to clear the env var post-use (AR34)

---

## Epic 2: Annuaire d'artisans noté (killer feature)

Délivrer le cœur de valeur produit : un résident peut trouver un artisan en 5 secondes (recherche FTS bilingue + filtres typés + fiche structurée + action `tel:` en premier rang), créer une fiche artisan en démarrant le workflow de consentement asynchrone CNDP-compliant (SMS magic link → page de revue artisan → publication), noter sur 4 axes typés (Dépannage / Petits travaux / Travail soigné / Urgences), commenter en pseudonyme par défaut ou identité visible, et éditer/retirer ses contributions. L'artisan référencé dispose d'un droit de réponse opérationnel.

### Story 2.1: Schéma artisans + ratings + tags bilingues + FTS Postgres

As a solo dev,
I want the artisan domain schema with bilingual tags, typed ratings, FTS indexes, RLS and consent tokens,
So that the annuaire features can be built on a sound, performant, CNDP-compliant data model.

**Acceptance Criteria:**

**Given** a migration `2026XXXXXXXX_artisans_schema.sql` is applied
**When** I inspect the database
**Then** the tables exist: `artisans` (`id`, `slug`, `residence_id`, `display_name_fr`, `display_name_ar`, `phone_e164`, `price_relative` enum `$/$$/$$$/$$$$`, `has_invoice` enum `oui/non/sur_demande`, `state` enum `pending_consent/published/refused`, `published_at`, `created_by` FK users, soft-delete columns), `ratings` (`id`, `artisan_id`, `user_id`, `score_depannage`/`petits_travaux`/`travail_soigne`/`urgences` (1-5, nullable per axis), `comment_text`, `visibility` enum `pseudonym/named`, soft-delete), `tags` (`id`, `key`, `label_fr`, `label_ar`), `artisan_tags` (join), `artisan_consent_tokens` (`id`, `artisan_id`, `token_hash`, `expires_at`, `used_at`) (AR5, AR7)

**Given** RLS is enabled
**When** I authenticate as `resident` of residence X
**Then** I can SELECT all artisans where `residence_id=X AND state='published' AND deleted_at IS NULL`, INSERT artisans where `residence_id=X AND created_by=auth.uid()`, INSERT ratings where `user_id=auth.uid()`, and UPDATE/DELETE only my own rows (AR6)

**Given** the `pending_consent` artisans
**When** I authenticate as `resident` and query
**Then** I see only my own pending submissions (others' pending submissions are hidden until artisan consents)

**Given** the FTS index migration
**When** I inspect indexes
**Then** GIN indexes exist on `to_tsvector('french', display_name_fr || ' ' || coalesce(comment_text, ''))` and `to_tsvector('arabic', display_name_ar)`, plus a `pg_trgm` index on phone for de-duplication (AR5)

**Given** `lib/slug/slugify.ts` is implemented
**When** I call `slugify("Hassan le Plombier")` or `slugify("حسن السباك")`
**Then** I get `hassan-le-plombier` and `hsn-lsbk` (transliterated ASCII kebab-case) deterministically, with collision-handling suffix `-2`, `-3` (AR15)

**Given** `lib/slug/slugify.test.ts` is committed
**When** Vitest runs
**Then** edge cases pass: French diacritics, Arabic letters, mixed scripts, very long names truncated at 60 chars

**And** types are regenerated via `pnpm run gen:types` and `lib/supabase/types.generated.ts` is committed with the new tables (AR8)

---

### Story 2.2: Annuaire — liste avec recherche FTS bilingue + filtres + cache offline

As a resident (e.g., Yassine — Journey 1),
I want to browse the annuaire with full-text search and typed filters,
So that I can find a suitable artisan in 5 seconds, online or offline.

**Acceptance Criteria:**

**Given** I am authenticated as `resident` and I open `/(community)/annuaire`
**When** the page renders
**Then** I see published artisans of my residence in card format with: display_name (in my locale), aggregated rating per axis (e.g., "Dépannage 4.5/5 · 4 voisins"), price relative ($-$$$$), has_invoice badge, and primary compétence tag — sorted by recency by default (FR12)

**Given** I type "plombier" or "سباك" in the search input
**When** I submit (debounced 300ms)
**Then** results render in < 300ms p95 using the bilingual Postgres FTS query (`websearch_to_tsquery` on relevant tsvector based on locale), highlighting matches in titles and comments (NFR7)

**Given** I select filter chips: compétence "Travail soigné" + prix "$$$" + facture "oui" + rating min "4★"
**When** the filtered query runs
**Then** only artisans matching ALL filters are shown, with the filter chips visible at top for one-tap removal (FR12)

**Given** I have visited `/annuaire` once online
**When** I revisit `/annuaire` offline (airplane mode)
**Then** the cached artisan list renders in < 100ms via Serwist `CacheFirst` strategy, with a small banner "Mode hors ligne — dernière mise à jour il y a Xh" (NFR8, FR45 setup)

**Given** I am in AR mode
**When** the annuaire renders
**Then** layout is RTL-correct, tags display in AR, search input accepts Arabic, FTS targets the arabic tsvector (NFR45)

**Given** there are no results
**When** my query returns empty
**Then** an empty-state component suggests "Aucun artisan correspondant. Ajouter le tien ?" linking to `/annuaire/nouveau` (FR15 setup)

**And** the page uses Server Components by default, `loading.tsx` skeleton (no spinner), and respects `prefers-reduced-motion` (AR21, NFR39)

---

### Story 2.3: Fiche artisan détaillée + action `tel:`

As a resident,
I want to consult a structured artisan page with all relevant info and a one-tap call action,
So that I can decide quickly and call without friction.

**Acceptance Criteria:**

**Given** I open `/(community)/artisan/[slug]`
**When** the page renders
**Then** I see: display_name (locale), all compétences tags (locale-aware), aggregated rating per axis (count + average), price relative, has_invoice badge, the most recent 10 comments (pseudonymous or named per each contributor's visibility setting), and the artisan's phone (E.164 formatted) (FR13)

**Given** the artisan phone is `+212XXXXXXXXX`
**When** I tap the "Appeler Hassan" button (primary CTA, ≥ 56px tall — AR16, NFR36)
**Then** my phone's dialer opens via `tel:+212XXXXXXXXX` intent, no confirmation modal (FR14, NFR40)

**Given** an artisan is soft-deleted (`deleted_at IS NOT NULL` or refused consent)
**When** I open `/artisan/<their-old-slug>`
**Then** I receive a 410 Gone response with a localized message "Cette fiche n'est plus disponible" — and the slug is permanently tombstoned (not reused) (CC #19)

**Given** I open the fiche while offline (was previously cached)
**When** the page renders
**Then** content renders in < 100ms from cache; the call button still works (`tel:` is OS-level, no network) (NFR8)

**Given** I am the artisan's contributor (`created_by=auth.uid()`)
**When** I view the fiche
**Then** an additional "Modifier ma contribution" / "Retirer" panel is visible (Story 2.7)

**And** the URL `darna.org/artisan/[slug]` is the canonical URL preparatory for sharing (Epic 6) and uses no locale prefix per ADR 0003

---

### Story 2.4: Création fiche artisan + workflow consentement SMS asynchrone

As a resident (e.g., Nadia — Journey 4),
I want to publish an artisan card with proper CNDP-compliant async consent workflow,
So that I help my neighbors while respecting the artisan's data rights.

**Acceptance Criteria:**

**Given** I am authenticated as `resident` and I open `/(community)/annuaire/nouveau`
**When** the form renders
**Then** I see fields: display_name_fr (required), display_name_ar (optional), phone (E.164 `+212` format, validated by `lib/validation/phone-e164.ts`), compétences (multi-select tags, ≥ 1 required), price_relative ($-$$$$), has_invoice (oui/non/sur_demande), comment (optional, 500 char max), my visibility (pseudonym default, named opt-in mémorisé) (FR15, FR16, AR17)

**Given** I check "Je confirme avoir prévenu l'artisan" (CNDP gate)
**When** I submit the form
**Then** `createArtisan()` Server Action runs and (a) inserts an `artisans` row with `state='pending_consent'`, `slug=slugify(display_name_fr)`, `created_by=auth.uid()`, `residence_id` from my profile, (b) inserts an `artisan_consent_tokens` row with HMAC-hashed token + 7-day expiry, (c) sends an SMS via the configured SMS provider (Brevo SMS if Maroc-supported, else fallback provider per AR12) containing the magic link `darna.org/consent/[raw_token]` in FR by default (artisan locale not known), (d) inserts a notification for me "Fatima va recevoir un SMS pour confirmer. Sa fiche apparaîtra sous 48h une fois consentie." (FR17, FR19 setup)

**Given** I submit with phone already attached to another active artisan (de-dup check)
**When** the Server Action runs
**Then** it returns `{ok: false, error: {code: 'phone_duplicate', message_key: 'errors.artisan.phone_duplicate'}}` and the form proposes to view the existing artisan (AR18)

**Given** I don't check the consent confirmation checkbox
**When** I attempt to submit
**Then** client-side and server-side both reject the submission with `'errors.artisan.consent_required'`

**Given** my visibility is "named" on this submission (opt-in)
**When** the artisan is later published
**Then** my display_name will be shown as contributor; otherwise a stable pseudonym hash is shown (FR16)

**And** the artisan creation is achievable in ≤ 60s by Nadia in beta (NFR40-adjacent), with all UI in my locale and skeleton loading state (AR21)

---

### Story 2.5: Page magic link consentement artisan (accept/refuse 1-tap, sans compte)

As an artisan (e.g., Fatima — Journey 4),
I want to receive an SMS magic link and review/accept/refuse my listing in one tap, without creating an account,
So that my CNDP consent is captured properly while remaining low-friction.

**Acceptance Criteria:**

**Given** the artisan receives the SMS and clicks the magic link `darna.org/consent/[token]`
**When** the page loads (no authentication required — token-based public access)
**Then** a public page shows the proposed fiche (display_name, compétences, contributor comment, mention of pseudonym/named visibility) with two buttons "J'accepte" and "Je refuse", in FR by default (with a language toggle FR/AR) (FR18)

**Given** the artisan taps "J'accepte"
**When** the form posts to `app/api/webhook/sms-consent/route.ts` (Route Handler with HMAC validation per AR38)
**Then** in a transaction: (a) the `artisans` row's `state='published'`, `published_at=now()`, (b) the consent token's `used_at=now()` (idempotent — re-clicks see "Déjà accepté"), (c) the contributor receives a Brevo e-mail "La fiche de [name] est en ligne" in their locale + an in-app notification (FR19), (d) `moderation_log` records `artisan.consented` event

**Given** the artisan taps "Je refuse"
**When** the Server Action runs
**Then** (a) the `artisans` row's `state='refused'`, soft-deleted, (b) the consent token is marked `used_at`, (c) the contributor receives a neutral e-mail "L'artisan a décliné la publication — vos données ont été supprimées" (FR19, NFR18)

**Given** the token has expired (> 7 days)
**When** the artisan opens the URL
**Then** the page shows "Cette demande de consentement a expiré. Si vous souhaitez être référencé, demandez à votre voisin de soumettre une nouvelle fiche" — and no action is possible

**Given** the token has already been used (`used_at IS NOT NULL`)
**When** the artisan opens the URL
**Then** the page shows the current published state (e.g., "Vous avez accepté votre fiche le X") with a link to consult it

**Given** the URL token is tampered with (HMAC mismatch)
**When** the request hits the route
**Then** HTTP 401 is returned without revealing whether the token ever existed (AR38)

**And** the artisan's session is NOT created — there is no persistent account; they only have token-based access to this single consent action

---

### Story 2.6: Notation typée multi-axes + commentaire pseudo/identité

As a resident (e.g., Yassine post-call — Journey 1),
I want to rate an artisan on 4 typed axes with optional comment and visibility choice,
So that my neighbors benefit from differentiated feedback without me feeling exposed.

**Acceptance Criteria:**

**Given** an artisan is published and I open their fiche
**When** I tap "Noter cet artisan"
**Then** a rating form opens with 4 axes (Dépannage / Petits travaux / Travail soigné / Urgences), each as a 1-5 star selector or "Non applicable" (so I rate only the axes I have experience with) (FR20)

**Given** I rate "Dépannage 5/5" and leave the other 3 axes as "Non applicable"
**When** I submit
**Then** a row in `ratings` is created with `score_depannage=5`, others NULL, `visibility` defaulting to my profile setting (pseudonym), `comment_text` optional max 500 char, `user_id=auth.uid()`

**Given** multiple residents rate an artisan
**When** I view the fiche
**Then** per-axis aggregation shows average + count (e.g., "Dépannage 4.5/5 · 4 voisins") — NULL ratings are excluded from averages (FR13)

**Given** my visibility setting is `pseudonym` for this rating
**When** other residents view my comment
**Then** they see "Voisin anonyme" + a stable hash-derived pseudonym (consistent across all my pseudonymous comments for that artisan) (FR16)

**Given** my visibility setting is `named` (opt-in)
**When** other residents view my comment
**Then** my display_name + villa number is shown

**Given** I have already rated this artisan
**When** I open the rating form
**Then** my existing rating is pre-filled and "Mettre à jour ma note" is the CTA (idempotent — one rating per user per artisan) (FR21 setup)

**And** the rating form is achievable in ≤ 30s by Aïcha (NFR40) with skeleton loading and optimistic UI on submission (`useOptimistic`)

---

### Story 2.7: Édition/retrait de ses propres contributions

As a resident,
I want to edit or retire any contribution I made (artisan fiche, rating, comment),
So that I control what I have published about my neighbors.

**Acceptance Criteria:**

**Given** I view an artisan fiche I created (`created_by=auth.uid()`)
**When** the page renders
**Then** a "Modifier ma contribution" + "Retirer la fiche" panel is visible (only to me, enforced by RLS-aware UI check)

**Given** I edit my own artisan fiche
**When** I change non-PII fields (compétences, comment, price_relative, has_invoice)
**Then** changes apply immediately if `state='pending_consent'`; if `state='published'`, changes apply immediately without re-consent (per FR21 — artisan's right of reply covers post-publication factual concerns)

**Given** I change PII fields (display_name or phone) on a published artisan
**When** I submit
**Then** a new consent loop is triggered: artisan SMS-notified of the change request with a fresh token, until they accept the fiche stays as-is

**Given** I view a rating I posted
**When** I tap "Modifier ma note"
**Then** I can update scores/comment/visibility, and the artisan's aggregated rating updates immediately (with optimistic UI)

**Given** I view an alerte or comment I posted (anywhere — annuaire, alertes, guide)
**When** I tap "Retirer"
**Then** the content is soft-deleted (`deleted_at=now()`, `deleted_by=auth.uid()`, `deletion_reason='author_retract'`); the entity is removed from public views; `moderation_log` records the event for transparency (FR21, NFR17)

**Given** I retire my own artisan fiche
**When** the action runs
**Then** the artisan row is soft-deleted, all related ratings/comments cascade to soft-deleted, and the slug is tombstoned (CC #19)

**And** other residents NEVER see edit/retire actions on contributions that aren't theirs (RLS + UI check)

---

### Story 2.8: Droit de réponse artisan

As an artisan referenced in the annuaire,
I want a way to publish a response to a rating or request rectification of my listing data,
So that my right of reply per CNDP / droit marocain is operational.

**Acceptance Criteria:**

**Given** I am an artisan who consented (my fiche is published)
**When** I open the public page `darna.org/artisan/contact` (linked from the SMS consent confirmation e-mail or via QR code on my published fiche)
**Then** I can request a new magic link by entering my phone number (E.164) — the system finds my latest artisan row and SMS-sends a fresh token

**Given** I click the new magic link
**When** I land on `darna.org/respond/[token]` (HMAC-validated per AR38)
**Then** I see my current fiche with two options: (a) "Publier une réponse" (free text 500 chars max), (b) "Demander rectification" (form with target field + new value + justification) (FR22)

**Given** I publish a response
**When** I submit
**Then** a `response` entity is created and displayed prominently on my fiche as "Réponse de [name] · [timestamp]" (always identified, no pseudonym for artisan responses)

**Given** I request rectification of phone or display_name (PII fields)
**When** I submit
**Then** my request enters the co-mod moderation queue (Epic 5) for review — `moderation_log` records `artisan.rectification_requested` (CC #20)

**Given** the magic link token has expired
**When** I try to open the URL
**Then** I see "Cette demande a expiré. Demande un nouveau lien sur darna.org/artisan/contact"

**And** at MVP, only my latest published artisan row (one per phone) is accessible — multi-residence support is V3 (D4)

---

## Epic 3: Contenu durable — Guide résident, Numéros utiles, Pack accueil

Délivrer les 3 modules de contenu éditorial durable, alimentés par les co-mods : (1) Guide résident structuré en FAQ avec recherche et deep-linking par entrée, (2) Numéros utiles à accès rapide (poste de garde, syndic, urgences, pharmacie), (3) Pack accueil nouveaux arrivants mis en avant automatiquement lors du premier login post-validation. Interface CRUD co-mod pour création/édition/retrait dans les 3 modules.

### Story 3.1: Schéma contenu durable — guide_entries + useful_numbers + pack_entries

As a solo dev,
I want the schema for durable content modules with bilingual fields, theming, ordering and CRUD-ready RLS,
So that co-mods can curate community knowledge in both languages.

**Acceptance Criteria:**

**Given** a migration is applied
**When** I inspect the database
**Then** the following tables exist: `guide_entries` (`id`, `slug`, `residence_id`, `theme_key`, `title_fr`, `title_ar`, `body_fr_markdown`, `body_ar_markdown`, `order_in_theme`, `created_by`, soft-delete columns), `useful_numbers` (`id`, `category_key` enum {`securite`, `syndic`, `urgences`, `sante`, `autre`}, `label_fr`, `label_ar`, `phone_e164`, `notes_fr`, `notes_ar`, `order`, soft-delete), `pack_entries` (`id`, `section_key`, `title_fr`, `title_ar`, `body_fr_markdown`, `body_ar_markdown`, `order_in_section`, soft-delete) — all with `residence_id` FK (AR5, AR7)

**Given** RLS policies are applied
**When** I authenticate as `resident`
**Then** I can SELECT all entries of my residence; I cannot INSERT/UPDATE/DELETE (read-only for residents)

**Given** RLS policies are applied
**When** I authenticate as `co_mod`
**Then** I can CRUD all entries of my residence

**Given** theme keys are enum-typed
**When** I inspect the schema
**Then** `theme_key` enum values are stable identifiers (`codes_portails`, `horaires_gardien`, `regles_jardin`, `dechets`, `traditions`, `securite`, `autre`) with i18n labels resolved at render time (no display_name column on theme) (NFR47)

**And** types are regenerated and committed in `lib/supabase/types.generated.ts`

---

### Story 3.2: Guide résident — lecture + recherche + deep linking par entrée

As a resident (e.g., Aïcha — Journey 2),
I want to browse the Guide as a structured FAQ in my language, search it, and open any entry directly via deep link,
So that I find practical info (e.g., portail code) without asking anyone.

**Acceptance Criteria:**

**Given** I am authenticated as `resident` and I open `/(community)/guide`
**When** the page renders
**Then** I see entries grouped by theme (Codes portails / Horaires gardien / Règles jardin / Déchets / Traditions / Sécurité / Autre), each theme expandable, entries displayed in my locale (FR23)

**Given** I type a query in the search input
**When** I submit
**Then** results render across all themes ranked by FTS relevance, with matched snippets highlighted (NFR7)

**Given** I open `/(community)/guide/[slug]` (deep link from WhatsApp, e-mail or share)
**When** the page renders
**Then** I see the entry's title + body (Markdown rendered) in my locale, with breadcrumb back to the theme; the URL is the canonical deep-link target for Epic 6 (FR23, FR36 setup)

**Given** an entry has a body in FR but not in AR
**When** I view it in AR mode
**Then** the FR fallback renders with a "non traduit" badge (FR48)

**Given** I have opened the Guide once online
**When** I revisit while offline
**Then** all entries render from Serwist cache in < 100ms (NFR8, FR45 setup)

**Given** I am Aïcha
**When** I open `/guide`, tap a theme, then tap "Quels sont les codes des portails ?"
**Then** I read the answer in ≤ 22 seconds from unlock — validating the Journey 2 benchmark (NFR40)

**And** the page passes axe-core a11y scan with contrast ≥ 4.5:1, font-size ≥ 16px, focus visible (NFR35)

---

### Story 3.3: Numéros utiles — accès rapide avec action `tel:`

As a resident,
I want quick access to essential phone numbers grouped by category with one-tap dialing,
So that I reach the poste de garde or pharmacie without searching.

**Acceptance Criteria:**

**Given** I am authenticated and I open `/(community)/numeros-utiles` (or via home tile)
**When** the page renders
**Then** I see numbers grouped by category (Sécurité / Syndic / Urgences / Santé / Autre), each entry showing label (locale), phone E.164, and a primary "Appeler" button ≥ 56px (FR24, NFR36)

**Given** I tap "Appeler poste de garde"
**When** the action fires
**Then** my phone dialer opens via `tel:` intent — no modal (FR24, NFR40)

**Given** an entry has `notes` (e.g., "24/7" or "Heures d'ouverture 9h-18h")
**When** the page renders
**Then** the note shows in small text under the number in my locale

**Given** I am offline
**When** I open `/numeros-utiles`
**Then** numbers render from cache in < 100ms (NFR8)

**And** the page supports keyboard-only operation (NFR37) and is RTL-correct in AR mode (NFR45)

---

### Story 3.4: Pack accueil mis en avant post-validation

As a new resident (e.g., Salma — Journey 3),
I want a curated "Pack accueil" highlighted automatically on my first login after admission,
So that I get a 10-minute overview that would have taken 3 weeks of awkward WhatsApp questions.

**Acceptance Criteria:**

**Given** I am authenticated and my `users.first_login_at` is NULL
**When** I land on `/(community)/`
**Then** a prominent banner/full-screen overlay invites me to "Découvrir le Pack accueil" with a tap to enter `/(community)/guide/pack-accueil` (FR25)

**Given** I tap into the Pack accueil
**When** the page renders
**Then** I see sections (Codes portails, Horaires gardien, Jours poubelles, Contacts utiles, Traditions locales — sourced from `pack_entries` filtered by section_key) in my locale, each section expandable, with deep links to related Guide entries

**Given** I dismiss the banner (tap "Plus tard" or "✕")
**When** I return to the home page
**Then** the banner is not shown again — `users.pack_accueil_dismissed_at=now()` is set; the Pack accueil remains accessible via the menu/guide

**Given** I finish reading the Pack accueil
**When** I close the page
**Then** `users.first_login_at=now()` is set, persisting that I've completed the onboarding signal

**And** the Pack accueil page is keyboard-navigable end-to-end and RTL-correct (NFR37, NFR45)

---

### Story 3.5: Interface CRUD co-mod sur Guide, Numéros utiles, Pack accueil

As a co-mod,
I want a unified CRUD interface for Guide entries, Useful Numbers and Pack Accueil entries with bilingual editor,
So that I can keep durable content fresh and trustworthy.

**Acceptance Criteria:**

**Given** I am authenticated as `co_mod` and I open `/(comod)/admin/guide` (similar for `/numeros-utiles` and `/pack-accueil`)
**When** the page renders
**Then** I see a list of all entries of my residence with edit/retire actions, plus a "+ Nouvelle entrée" CTA (FR26)

**Given** I create a new Guide entry
**When** the form opens
**Then** it has side-by-side FR + AR Markdown editors with live preview, theme selector, order input — and validates that at least the FR field is filled before submission

**Given** I save an entry with only the FR field filled (AR left blank)
**When** I submit
**Then** the entry persists with `body_ar_markdown=NULL`, and a warning notifies me "Cette entrée affichera la version FR en mode AR jusqu'à traduction" (FR48)

**Given** I edit an existing entry
**When** I save
**Then** changes apply immediately (no draft state at MVP), `updated_at` is bumped, the cached SW data is invalidated via `revalidatePath('/guide')` or `revalidateTag('guide')`

**Given** I retire an entry
**When** I confirm
**Then** the entry is soft-deleted, `moderation_log` records `guide_entry.retired` event with my co_mod id (NFR17, FR33 setup)

**Given** I am a `resident` and try to open `/(comod)/admin/guide`
**When** the request hits the middleware
**Then** I receive HTTP 403 with a localized error page (NFR21)

**And** the CRUD interface is RTL-correct, keyboard-navigable, and uses Server Actions exclusively (no client-side direct DB calls) (AR16, NFR37, NFR45)

---

## Epic 4: Contenu éphémère — Alertes & Bons plans

Délivrer les modules de contenu auto-expirables : (1) alertes éphémères à partir de modèles pré-rédigés (coupure d'eau, désinsectisation, chien perdu, etc.) avec durée d'expiration choisie à la publication (24h, 72h, 7j) et auto-purge par cron, (2) bons plans typés expirables (offre voisin, prêt d'objet) avec date d'expiration explicite, (3) feed unifié des alertes actives + bons plans non expirés trié par fraîcheur.

### Story 4.1: Schéma contenu éphémère — alerts + tips + templates

As a solo dev,
I want the schema for ephemeral content with expiration, pre-written templates and bilingual support,
So that residents can publish alerts in one tap and the feed self-maintains via auto-purge.

**Acceptance Criteria:**

**Given** a migration is applied
**When** I inspect the database
**Then** the following tables exist: `alert_templates` (seeded: `coupure_eau`, `coupure_electricite`, `desinsectisation`, `chien_perdu`, `objet_perdu`, `colis_livre`, `autre`; with `label_fr`, `label_ar`, `default_body_fr`, `default_body_ar`, `default_duration_hours`), `alerts` (`id`, `slug`, `residence_id`, `template_id` FK, `title_fr`, `title_ar`, `body_fr`, `body_ar`, `created_by`, `expires_at`, soft-delete), `tips` (`id`, `slug`, `residence_id`, `category_key` enum {`offre_voisin`, `pret_objet`, `evenement`, `autre`}, `title_fr`, `title_ar`, `body_fr`, `body_ar`, `created_by`, `expires_at`, soft-delete) (AR5)

**Given** RLS policies are applied
**When** I authenticate as `resident`
**Then** I can SELECT all alerts/tips of my residence where `expires_at > now() AND deleted_at IS NULL`, INSERT my own, UPDATE/DELETE my own

**Given** indexes are created
**When** I inspect them
**Then** composite indexes exist on `(residence_id, expires_at, deleted_at)` for the feed query and on `created_at DESC` for ordering (AR15)

**And** types are regenerated and seeded templates are inserted in the seed migration

---

### Story 4.2: Publication alerte 1-tap depuis modèle pré-rédigé

As a resident,
I want to publish an alerte from a pre-written template in essentially one tap,
So that I share useful info (water cut, lost dog) without effort or text editing.

**Acceptance Criteria:**

**Given** I am authenticated and I open `/(community)/alertes/nouveau`
**When** the page renders
**Then** I see a grid of template cards (Coupure d'eau, Coupure d'électricité, Désinsectisation, Chien perdu, Objet perdu, Colis livré, Autre) each with an icon + localized label, target tap area ≥ 56×56px (FR27, NFR36)

**Given** I tap a template card (e.g., "Coupure d'eau")
**When** the form opens pre-filled with the template body + default duration (e.g., 24h)
**Then** I can lightly edit the body (optional) and adjust duration (24h, 72h, 7j radio); a single "Publier" button is the CTA (FR27)

**Given** I publish
**When** the `createAlert()` Server Action runs
**Then** an `alerts` row is created with `expires_at = now() + duration_hours`, `created_by=auth.uid()`, locale-aware fields filled, `slug=slugify(title_fr) + '-' + short_uuid`; an opt-in notification is scheduled for subscribed residents (delivered via Epic 7 plumbing, but stored ready here)

**Given** I select the "Autre" template
**When** the form opens
**Then** I write a free-form title + body in my locale (FR and AR fields both editable) with duration radio

**Given** I am Aïcha and I want to send a "Chien perdu" alerte
**When** I use the template flow
**Then** I publish in ≤ 30s from /alertes/nouveau load (NFR40)

**And** the alert publication is auditable via `moderation_log` event `alert.created` (for transparence consistency) — without PII beyond user_id (AR19)

---

### Story 4.3: Publication bon plan typé expirable

As a resident,
I want to publish a "Bon plan" categorized and time-bound (offre voisin, prêt d'objet, etc.),
So that I share opportunities without polluting the feed long-term.

**Acceptance Criteria:**

**Given** I open `/(community)/bons-plans/nouveau`
**When** the form renders
**Then** I see category selector (Offre voisin / Prêt d'objet / Événement / Autre), title (locale), body (locale), explicit expiration date picker (max 30 days), submit (FR29)

**Given** I submit a bon plan with `expires_at` in the past or > 30 days
**When** the Server Action runs
**Then** it returns `errors.tip.invalid_expiration` (AR18)

**Given** I publish a valid bon plan
**When** the `createTip()` Server Action runs
**Then** a `tips` row is created with `expires_at`, locale fields, `created_by`, `slug`, and an opt-in notification is scheduled for subscribed residents (Epic 7 plumbing)

**And** my own bons plans can be edited/retired via Story 2.7's generic edit-retire flow

---

### Story 4.4: Feed alertes & bons plans — tri fraîcheur

As a resident,
I want a unified feed of active alertes and non-expired tips sorted by recency,
So that I see what's happening in the residence at a glance.

**Acceptance Criteria:**

**Given** I am authenticated and I open `/(community)/alertes`
**When** the page renders
**Then** the feed shows active items (alertes WHERE expires_at > now() AND deleted_at IS NULL, plus tips WHERE same conditions) sorted by `created_at DESC`, in locale-aware cards with type badge (alerte 🚨 vs bon plan 🎁), time remaining ("expire dans 18h"), and tap-to-detail (FR30)

**Given** I tap on an alerte card
**When** the detail page renders (`/alertes/[slug]`)
**Then** I see the full body, creator pseudonym (or named if opt-in), expiration time, and a 👍 button (FR43b — delivered in Epic 6)

**Given** an alerte's `expires_at < now()`
**When** the feed loads
**Then** the alerte is filtered out automatically (server-side query)

**Given** there are no active items
**When** the feed renders
**Then** an empty-state shows "Aucune alerte active. Publier la première ?" with a CTA

**And** the feed is RTL-correct, keyboard-navigable, and respects `prefers-reduced-motion` on card transitions (NFR45, NFR37, NFR39)

---

### Story 4.5: Cron auto-expiration alertes & bons plans

As a solo dev,
I want a cron that soft-deletes expired alertes and tips,
So that the feed and storage stay clean without manual intervention.

**Acceptance Criteria:**

**Given** Vercel Cron `purge-expired` runs daily at 03:00 UTC (or hourly per architecture preference)
**When** the cron executes against `app/api/cron/purge-expired/route.ts`
**Then** all `alerts` and `tips` WHERE `expires_at < now() AND deleted_at IS NULL` are soft-deleted (`deleted_at=now()`, `deleted_by=NULL` since system actor, `deletion_reason='auto_expiration'`) (FR28)

**Given** the cron runs
**When** it completes
**Then** a structured log entry `event: 'alerts.auto_expired'` and `'tips.auto_expired'` with counts is written via `lib/logger.ts` (AR19)

**Given** the cron is invoked without the bearer token
**When** the request hits the endpoint
**Then** HTTP 401 is returned (AR39)

**And** soft-deleted alerts/tips are visible in `moderation_log` query for audit purposes but NOT shown in the feed

---

## Epic 5: Modération réactive & Transparence radicale

Délivrer le pilier "pureté horizontale + transparence radicale" : tout résident peut signaler un contenu avec raison fermée, tout co-mod peut retirer un contenu signalé sous 24h en motivant et notifiant l'auteur, toute action de modération est inscrite dans un journal public lisible par tout visiteur, soft-delete + audit immuable conforme CNDP, workflow d'escalade vers le contact juridique pré-identifié.

### Story 5.1: Schéma reports + extension moderation_log + RLS transparence

As a solo dev,
I want the schema for content reports + moderation log extensions with the right RLS for public transparence,
So that signalements are tracked privately and moderation actions are publicly auditable.

**Acceptance Criteria:**

**Given** a migration is applied
**When** I inspect the database
**Then** the table `reports` exists (`id`, `residence_id`, `reporter_id` FK users, `target_type` enum {`artisan`, `rating`, `alert`, `alert_comment`, `tip`, `guide_entry`}, `target_id` uuid, `reason` enum {`diffamation`, `info_erronee`, `harcelement`, `spam`, `hors_charte`, `autre`}, `note_text` optional, `state` enum {`open`, `closed_removed`, `closed_kept`}, `created_at`, `resolved_at`, `resolved_by` FK co_mod) (AR5)

**Given** `moderation_log` (created in Epic 1) is extended
**When** I inspect the columns
**Then** it has: `id`, `residence_id`, `event_key` (e.g., `admission.accepted`, `admission.rejected`, `report.opened`, `content.removed`, `content.kept`, `escalation.triggered`, `artisan.consented`, `user.deleted`), `actor_id` FK users (NULL for system actions), `target_type`, `target_id`, `motive_key`, `payload_json` (no PII), `created_at` (immutable — no soft-delete on the log itself; only INSERT) (NFR17)

**Given** RLS policies are applied
**When** I authenticate as `resident`
**Then** I can INSERT reports (only my own — `reporter_id=auth.uid()`), SELECT only my own reports, cannot UPDATE/DELETE; I CANNOT see other residents' reports

**Given** RLS policies are applied
**When** I authenticate as `co_mod`
**Then** I can SELECT all reports of my residence, UPDATE them to resolve

**Given** RLS on `moderation_log`
**When** anyone (including unauthenticated) queries it
**Then** SELECT is allowed (lecture publique pour transparence), INSERT is rejected from any client (only Server Actions with service role insert; or a trigger ensures rows are created from internal flows)

**And** types are regenerated and a redaction view `moderation_log_public` returns rows with PII fields stripped (AR15, CC #19)

---

### Story 5.2: Signalement contenu par résident (raison fermée)

As a resident,
I want to report any content I find inappropriate with a fixed reason from a closed list,
So that the co-mods can review and act within 24h.

**Acceptance Criteria:**

**Given** I am authenticated as `resident` and I view any content (artisan fiche, comment, alerte, bon plan, guide entry, useful number)
**When** the page renders
**Then** a "Signaler" action is visible (typically inside an overflow menu or below the content) (FR31)

**Given** I tap "Signaler"
**When** the dialog opens
**Then** a fixed-list reason dropdown is shown (Diffamation, Info erronée, Harcèlement, Spam, Hors-charte, Autre) with an optional 200-char note field (FR31)

**Given** I submit a report
**When** the `submitReport()` Server Action runs
**Then** a `reports` row is created with my user_id + target_type + target_id + reason + `state='open'`; all `co_mod` of my residence receive an e-mail notification "Nouveau signalement : [reason] sur [content snippet]" (FR42); `moderation_log` records `report.opened` with redacted payload

**Given** I report the same content twice
**When** the Server Action runs
**Then** it returns `errors.report.duplicate` (idempotent — one open report per (reporter, target))

**Given** the report rate limit is enforced
**When** I submit a 4th report within 1 hour
**Then** I receive HTTP 429 (anti-abuse — see AR31)

**And** I never see who reported what — my reports are visible only to me and to co-mods (RLS enforced)

---

### Story 5.3: Interface co-mod queue signalements + retrait + notification auteur

As a co-mod (e.g., Karim — Journey 5),
I want a queue of open reports with full context and a one-tap remove-with-motive flow,
So that I can act under 24h SLA per the moderation charter.

**Acceptance Criteria:**

**Given** I am authenticated as `co_mod` and I open `/(comod)/moderation`
**When** the page renders
**Then** I see open reports sorted by `created_at ASC` (oldest first), each showing: target snippet (in locale), reporter pseudonym (only visible to me), reason, optional reporter note, time since opened (FR32)

**Given** I open a specific report
**When** the detail page renders
**Then** I see (a) the FULL target content (in context — e.g., the entire comment thread for a comment), (b) reporter info + note, (c) previous moderation actions on the same target (if any), (d) action buttons "Retirer le contenu" + "Conserver le contenu"

**Given** I tap "Retirer le contenu"
**When** the motive form opens
**Then** I select from a fixed list (Diffamation, Info erronée, Hors-charte, Autre) + optional note; on submission, the target is soft-deleted (`deleted_at=now()`, `deleted_by=auth.uid()`, `deletion_reason=<motive>`), report state becomes `closed_removed`, `moderation_log` records `content.removed` with motive + redacted snippet, the author receives a Brevo e-mail "Votre contribution a été retirée — motif : [motive_localized]" in their locale (FR32, NFR17)

**Given** I tap "Conserver le contenu"
**When** I submit
**Then** report state becomes `closed_kept`, `moderation_log` records `content.kept` with my reasoning, the reporter receives a neutral e-mail "Votre signalement a été examiné et le contenu a été conservé"; the target stays visible

**Given** the report SLA exceeds 24h on heures de présence (7h-23h)
**When** the dashboard renders
**Then** the report appears with a red "SLA dépassé" badge to surface it to co-mods (NFR27)

**Given** I am another co-mod opening the same report 5 minutes after Karim
**When** the page renders
**Then** if Karim is actively viewing it, a soft notice appears "Un autre co-mod consulte ce signalement"; if it's already been resolved, the resolution is visible

**And** all moderation Server Actions log structured events without PII, use Zod validation, and return `Result<T>` (AR17, AR18, AR19)

---

### Story 5.4: Journal public sur `/transparence`

As a visitor (resident or public),
I want to view every moderation action ever taken in chronological order,
So that I can audit the platform's governance and trust its impartiality.

**Acceptance Criteria:**

**Given** I am any visitor (authenticated or not) and I open `/transparence`
**When** the page renders (Server Component, public route)
**Then** I see a chronological list of moderation events (most recent first) with: date+time, event_key in plain language (e.g., "Contenu retiré sur fiche [snippet] — motif : Diffamation"), co_mod pseudonym (display_name visible — co-mods accept being identified by name on their moderation actions per their role acceptance), in my locale (FR33)

**Given** an event concerned PII (e.g., `user.deleted`)
**When** the journal renders
**Then** the entry shows "Suppression d'un compte utilisateur" without any name or e-mail — PII is redacted server-side via the `moderation_log_public` view (CC #19)

**Given** I want to filter
**When** I use the filter UI (event type, date range)
**Then** the list updates server-side with the new query

**Given** the journal page is paginated
**When** I scroll
**Then** infinite-scroll loads next page via Server Components streaming + Suspense

**Given** I am Aïcha
**When** I open `/transparence`
**Then** the page is readable: large font (≥ 16px), high contrast (≥ 4.5:1), clear visual hierarchy (NFR35, NFR40)

**And** the page is fully RTL-correct in AR mode (NFR45) and renders the bilingual section "Comment vos données sont protégées" (Story 8.2 — placeholder here)

---

### Story 5.5: Workflow escalade juridique

As a co-mod,
I want a guided escalation workflow when a moderation case requires legal expertise,
So that I can prepare a complete dossier and reach the pre-identified legal contact without ad-hoc compilation.

**Acceptance Criteria:**

**Given** I am `co_mod` and viewing a complex moderation case
**When** the report detail page renders
**Then** an "Escalader vers contact juridique" action is available alongside "Retirer"/"Conserver" (FR35)

**Given** I trigger escalation
**When** the guided form opens
**Then** it pre-fills: target snippet, reason, previous actions log, and asks me to add a free-text context note (max 1000 chars) explaining why legal review is needed

**Given** I submit escalation
**When** the Server Action runs
**Then** (a) `moderation_log` records `escalation.triggered` event, (b) a dossier (PDF or rich Markdown) is generated server-side and signed-URL'd in R2 with 30-day expiry, (c) a Brevo e-mail is sent to `LEGAL_CONTACT_EMAIL` (env var) with the dossier link + summary, (d) the report state becomes `closed_kept_pending_legal` (target remains visible pending legal direction)

**Given** the legal contact responds (out-of-band, since this is a manual workflow)
**When** the co-mod updates the case in the queue
**Then** they can mark `closed_kept_legal_approved` or `closed_removed_legal_advised` with a free-text note logged to `moderation_log`

**Given** the `LEGAL_CONTACT_EMAIL` env var is missing or invalid
**When** escalation is attempted
**Then** the Server Action returns `errors.moderation.legal_contact_missing` and the co-mod is instructed to check the runbook (NFR30)

**And** the dossier never contains PII of OTHER residents than the involved parties (target author, reporter) — only redacted snippets and structural data

---

## Epic 6: Partage WhatsApp, deep linking & engagement léger

Délivrer le pilier "cohabitation choisie avec WhatsApp" : URLs canoniques, copie 1-tap, deep linking depuis WhatsApp/navigateur, capture contexte pré-login, 👍 1-tap sans toxicité, suggestion d'évolution produit privée aux co-mods.

### Story 6.1: Slugs canoniques + URLs canoniques + tombstone

As a solo dev,
I want stable, short, ASCII-kebab-case canonical URLs on every shareable entity with permanent tombstoning on deletion,
So that links shared in WhatsApp remain stable and never collide or get reused.

**Acceptance Criteria:**

**Given** any shareable entity is created (artisan, alerte, bon plan, guide entry — Stories 2.4, 4.2, 4.3, 3.5)
**When** the row is inserted
**Then** a `slug` column is populated via `lib/slug/slugify.ts` with ASCII kebab-case (transliteration of FR + AR characters), max 60 chars, unique per type within a residence (FR36)

**Given** two entities of the same type would generate the same slug
**When** the second is created
**Then** a numeric suffix is appended (`-2`, `-3`, ...) until unique

**Given** an entity is soft-deleted
**When** another entity of the same type is created with a colliding source name
**Then** the deleted entity's slug is NOT reused (tombstoned permanently) — the new entity gets a fresh suffix (CC #19)

**Given** I open a tombstoned URL (e.g., `darna.org/artisan/<slug-of-deleted-artisan>`)
**When** the request hits the route
**Then** I get HTTP 410 Gone with a localized message "Cette fiche n'est plus disponible" (CC #19)

**Given** canonical URLs are emitted in `<link rel="canonical">` and OpenGraph tags on each entity page
**When** I inspect the head
**Then** the URL pattern is `https://darna.org/[type]/[slug]` with NO locale prefix for community entities (per ADR 0003), and OG tags include `og:title`, `og:description`, `og:image` (using a default Darna OG image at MVP)

**And** the `noindex, nofollow` meta tags are emitted on community entity pages to prevent public indexing (PRD SEO Strategy)

---

### Story 6.2: Bouton "Partager" 1-tap (presse-papier + native share)

As a resident,
I want a one-tap share action on every entity that uses the native share sheet on mobile or copies to clipboard,
So that I can paste the link into WhatsApp without friction.

**Acceptance Criteria:**

**Given** I view any entity fiche (artisan, alerte, bon plan, guide entry)
**When** the page renders
**Then** a "Partager" button is visible as a primary inline action (not buried in a menu) with target ≥ 48×48px (FR37, NFR36)

**Given** I tap "Partager"
**When** the handler runs
**Then** if `navigator.share` is supported (mobile, mostly), the native share sheet opens with `title`, `text` (short description), `url` (canonical) — WhatsApp appears as an option natively (FR37)

**Given** `navigator.share` is not supported (older browsers / desktop)
**When** I tap "Partager"
**Then** `navigator.clipboard.writeText(canonical_url)` is invoked and a toast "Lien copié" appears in my locale (FR37)

**Given** I successfully share
**When** the action completes
**Then** a server-side counter `share_count` increments on the entity (compteur-only, no PII tracked — NFR16, NFR52)

**Given** I am in AR mode
**When** the button renders
**Then** the label is "مشاركة" with correct RTL alignment (NFR45)

**And** no modal opens — 1-tap to share is the rule (NFR40 Aïcha)

---

### Story 6.3: Capture contexte pré-login pour visiteur public

As a visitor opening a WhatsApp-shared community link,
I want to be invited to register with the link preserved through admission and login,
So that I land directly on the entity I came to see.

**Acceptance Criteria:**

**Given** I am unauthenticated and I open a community URL (e.g., `darna.org/artisan/hassan-plombier`)
**When** the route loads
**Then** I see a public landing page with a teaser (e.g., "Hassan — Plombier · 4.5★ Dépannage") and a CTA "S'inscrire pour voir la fiche complète" (FR39)

**Given** I tap the CTA
**When** I am redirected to `/admission?next=/artisan/hassan-plombier`
**Then** the `next` param is preserved through the full admission flow (signed cookie or query persistence)

**Given** my admission is accepted and I log in via magic link
**When** the auth callback completes
**Then** I am redirected to `/artisan/hassan-plombier` (the original target) — NOT to `/(community)/` (FR39)

**Given** I open a deep link to a soft-deleted entity
**When** the route handles it
**Then** the 410 Gone fallback (from Story 6.1) is shown without the registration prompt (no value in registering for deleted content)

**Given** I am ALREADY authenticated as `resident` and I open a deep link from WhatsApp on a device where the PWA is installed
**When** the OS handles the link
**Then** the PWA opens (instead of the browser) and routes directly to the entity (FR38)

**And** the teaser page is keyboard-accessible, RTL-correct in AR mode, and respects `prefers-reduced-motion` (NFR37, NFR45, NFR39)

---

### Story 6.4: 👍 1-tap sur commentaire, alerte, bon plan (sans 👎)

As a resident,
I want to "like" a comment, alerte or bon plan in one tap with a public aggregated counter,
So that I express light support without toxicity (no 👎 by construction).

**Acceptance Criteria:**

**Given** a `reactions` table is added (`id`, `user_id`, `target_type`, `target_id`, `created_at`, unique constraint on (user_id, target_type, target_id))
**When** the schema migration runs
**Then** RLS enforces `INSERT/DELETE only own rows`, `SELECT aggregated counts public via view`

**Given** I view a comment / alerte / bon plan
**When** the page renders
**Then** a 👍 button is visible with the current aggregated count (e.g., "👍 12") — target ≥ 48×48 px (FR43b)

**Given** I tap 👍
**When** the optimistic UI updates
**Then** the count increments immediately client-side, a Server Action upserts the reaction, and the server-side count is reconciled (FR43b)

**Given** I tap 👍 a second time on the same entity
**When** the action runs
**Then** my reaction is removed (toggle), the count decrements

**Given** the count is 0
**When** the entity renders
**Then** the button shows "👍" without count (cleaner UX)

**Given** I am the only liker
**When** I view the entity
**Then** I see the count "1" but NOT who liked it (no public list of likers — privacy)

**And** there is no 👎 button anywhere — searching the codebase for `thumbs_down` or `dislike` returns zero hits (rejet explicite — toxicité)

---

### Story 6.5: Formulaire suggestion d'évolution produit (lue par co-mods uniquement)

As a resident,
I want to submit a product evolution suggestion via a free-text form accessible from my settings,
So that my voice reaches the co-mods without public debate, vote or ranking (anti-toxicity).

**Acceptance Criteria:**

**Given** a `suggestions` table is added (`id`, `user_id`, `residence_id`, `text`, `state` enum `new/reviewed`, `created_at`, soft-delete)
**When** RLS policies are applied
**Then** `resident` can INSERT own + SELECT own only, `co_mod` can SELECT all + UPDATE state

**Given** I open `/(community)/profil/parametres/suggestion`
**When** the page renders
**Then** I see a free-text textarea (max 1000 chars) + submit button (FR43c)

**Given** I submit
**When** the Server Action runs
**Then** a `suggestions` row is created with my user_id, all `co_mod` of my residence receive an e-mail notification, my submission is acknowledged on-screen "Merci, ton retour a été transmis aux co-mods" (FR43c, FR42)

**Given** I open the page again later
**When** I look at my history
**Then** I see only MY past suggestions, marked `reviewed` if co-mods have acknowledged them (transparency without public exposure)

**Given** a co-mod opens `/(comod)/admin/suggestions`
**When** the page renders
**Then** all suggestions of the residence are visible with author (pseudonymized in the UI to reduce social pressure) and action "Marquer comme lue"

**And** suggestions are NEVER displayed publicly — no `/suggestions` public page exists, no vote/like UI is rendered on suggestions (anti-toxicity by construction)

---

## Epic 7: Notifications, hors-ligne, langues & accessibilité avancée

Délivrer la couche d'expérience PWA et inclusive : préférences notifications opt-in 3 catégories, livraison e-mail bilingue (Web Push V1.5), mode lecture hors-ligne complet via Serwist, bascule de langue FR/AR avec mémorisation, fallback `Accept-Language` et fallback contenu, navigation clavier complète et `prefers-reduced-motion` respecté.

### Story 7.1: Préférences notifications opt-in 3 catégories

As a resident,
I want to enable or disable each of the 3 notification categories independently,
So that I master what reaches my inbox.

**Acceptance Criteria:**

**Given** the `notifications_prefs` table is already provisioned by Story 1.3 with the correct schema and RLS
**When** I inspect the table
**Then** it has columns (`user_id` PK FK, `alerts_urgentes_enabled` bool default true, `nouvelles_entrees_annuaire_enabled` bool default false, `activite_contributions_enabled` bool default true, `updated_at`) — users can SELECT/UPDATE only their own row; this story only adds the user-facing UI

**Given** I open `/(community)/profil/parametres`
**When** the page renders
**Then** I see 3 toggles with localized labels and brief descriptions: (a) "Alertes urgentes (coupures, sécurité)", (b) "Nouvelles entrées dans l'annuaire (7 derniers jours)", (c) "Activité sur tes contributions" (FR40)

**Given** I toggle a category off
**When** the change persists
**Then** my preference updates immediately (optimistic UI), `notifications_prefs.<category>_enabled=false`, and from now on, no notifications of that category reach me

**Given** I have not visited the parametres page
**When** notification deliveries happen
**Then** defaults apply: alertes_urgentes ON, nouvelles_entrees_annuaire OFF (anti-spam default), activite_contributions ON

**And** the toggles are keyboard-accessible (`Tab` to focus, `Space` to toggle), RTL-correct, and respect `prefers-reduced-motion` (NFR37, NFR39, NFR45)

---

### Story 7.2: Délivrance notifications e-mail bilingues avec opt-in respecté

As the system,
I want to deliver e-mail notifications respecting opt-in preferences and locale,
So that residents receive only what they want, in their language, and no marketing ever.

**Acceptance Criteria:**

**Given** an event triggers a notification (new alerte for subscribed user, new artisan in annuaire weekly digest, comment on my artisan, retrait of my content, consent confirmation, etc.)
**When** the dispatcher runs (within the originating Server Action)
**Then** it looks up the recipient's `notifications_prefs`, locale preference, and `lib/email/send.ts` is invoked with the matching bilingual template (FR41 fallback e-mail, FR42, NFR44)

**Given** a recipient has opted OUT of the category
**When** the dispatcher tries to send
**Then** the dispatch is skipped and a structured log entry `event: 'notification.skipped_opt_out'` is written (no PII)

**Given** the e-mail send fails (Brevo error, rate limit, etc.)
**When** the failure is captured
**Then** the error is logged to GlitchTip + `lib/logger.ts`; at MVP no retry is implemented (Brevo retries handled by their queue) (AR19, NFR-Reliability)

**Given** no marketing e-mail templates exist in `lib/email/templates/`
**When** I audit the directory
**Then** all templates are transactional or opt-in (FR43)

**Given** Web Push is marked V1.5 (per architecture pre-arbitrage)
**When** I check the codebase
**Then** Web Push code is absent or stubbed with a clear TODO referencing V1.5; e-mail delivery is the only active channel at MVP

**And** all e-mail templates have FR + AR variants in `lib/email/templates/<name>.<locale>.ts` and Vitest tests verify both render without errors (NFR44)

---

### Story 7.3: Service Worker offline lecture sur annuaire + guide + pack + numéros

As a resident,
I want to read the annuaire, guide, pack accueil and useful numbers entirely offline after my first visit,
So that I can use Darna in the elevator, the basement, or on the bus without signal.

**Acceptance Criteria:**

**Given** Serwist is configured in `sw/index.ts` with cache strategies
**When** I inspect the SW config
**Then** strategies are: `CacheFirst` for `/annuaire/*`, `/guide/*`, `/numeros-utiles`, `/pack-accueil`, and static assets (fonts, OG images); `NetworkFirst` for `/alertes/*` (because they change fast); `StaleWhileRevalidate` for the public landing (FR45)

**Given** I visit `/annuaire` once online
**When** I go offline and revisit
**Then** the page renders from cache in < 100ms with a small "Hors ligne — dernière mise à jour il y a Xh" badge (NFR8)

**Given** I try to publish a rating/comment/alerte while offline
**When** the action runs
**Then** Serwist's `BackgroundSyncQueue` queues the request and the UI shows "Action enregistrée — sera envoyée à la reconnexion"; on network restore, the queue replays the request and notifies success (FR45)

**Given** the service worker has an update available
**When** I refresh the app
**Then** the new SW activates gracefully (`skipWaiting()` + `clients.claim()`) without forcing a hard reload that would lose my state (NFR-UX)

**Given** I open the app for the first time without any cache
**When** I am offline (e.g., no signal on first launch)
**Then** I see a clear offline fallback page "Aucune connexion détectée — Darna a besoin d'une connexion pour la première visite" (graceful degradation)

**And** the SW cache size is bounded (e.g., 50 MB max per Workbox best-practices) and a cleanup strategy removes old entries

---

### Story 7.4: Bascule langue FR/AR depuis paramètres avec mémorisation

As a resident,
I want to switch my UI language between FR and AR from my settings with persistence,
So that I read Darna in my preferred language across sessions and devices.

**Acceptance Criteria:**

**Given** I open `/(community)/profil/parametres`
**When** the page renders
**Then** a language selector shows current locale + alternative (e.g., "Langue : Français" → tap to switch to "العربية") (FR46)

**Given** I switch from FR to AR
**When** the action runs
**Then** (a) my `profiles.locale='ar'` is updated, (b) the locale cookie is updated to `ar`, (c) the page re-renders in AR with `<html lang="ar" dir="rtl">` (minimal page reload acceptable to apply layout direction) (FR46)

**Given** I switch device or browser
**When** I log in again
**Then** my `profiles.locale='ar'` is read by the middleware and the cookie is set; the UI starts in AR

**Given** the AR translation for a specific key is missing
**When** the page renders in AR
**Then** the FR fallback is shown silently (no console error, no DOM "MISSING_KEY") (FR48, NFR47)

**Given** I clear my cookies and visit `/` with `Accept-Language: ar`
**When** the middleware processes
**Then** I am redirected to `/ar` (FR47)

**And** the selector itself is keyboard-accessible (Tab + Space to toggle), RTL-correct, and uses logical Tailwind properties (NFR37, NFR45)

---

### Story 7.5: Détection Accept-Language + fallback FR + fallback contenu manquant

As a visitor,
I want the system to auto-detect my language from the browser AND gracefully fallback to FR when content is missing in AR,
So that I am never confronted with broken pages.

**Acceptance Criteria:**

**Given** a visitor opens `/` with `Accept-Language: ar-MA, ar;q=0.9, fr;q=0.8`
**When** the middleware processes
**Then** they are redirected to `/ar` (FR47)

**Given** a visitor opens `/` with `Accept-Language: en-US, en;q=0.9`
**When** the middleware processes
**Then** they are redirected to `/fr` (default fallback for unsupported language) (FR47)

**Given** a guide entry has `body_fr_markdown` populated and `body_ar_markdown=NULL`
**When** I view it in AR mode
**Then** the FR markdown is rendered with a small "non traduit" badge in AR ("غير مترجم") — the entry remains visible (FR48)

**Given** a useful_number has only `label_fr` filled
**When** I view it in AR mode
**Then** the FR label shows with a subtle indicator (FR48)

**Given** an alerte uses a template with both FR + AR
**When** it's published
**Then** both fields exist by default (templates seeded with both); free-form alerts may be FR-only and fallback applies

**And** the fallback is COMPLETE — no string in any UI ever shows "undefined" or a translation key like `errors.foo.bar` (NFR47)

---

### Story 7.6: Navigation clavier complète + `prefers-reduced-motion` respecté

As a power user or a screen-reader user,
I want to navigate the entire MVP with keyboard only and have motion-sensitive options respected,
So that the app is accessible to all and feels right to me.

**Acceptance Criteria:**

**Given** I navigate any page with Tab only
**When** I move focus
**Then** every interactive element receives focus in logical reading order (top → bottom, left → right in LTR, right → left in RTL) with a visible focus ring (≥ 2px contrasted outline) (FR49, NFR37)

**Given** a modal or dialog is open
**When** I press Escape
**Then** it closes and focus returns to the trigger element (focus trap correctness)

**Given** I navigate keyboard-only
**When** I traverse interactive elements
**Then** there are no keyboard traps (every element can be exited via Tab/Shift+Tab) and skip-to-main-content link is the first focusable element on every page

**Given** I have `prefers-reduced-motion: reduce` in my OS
**When** I use the app
**Then** all transitions, animations, parallax, autoplay are disabled or replaced with instant transitions (`motion-safe:` Tailwind utility used everywhere — NFR39, FR50)

**Given** `e2e/keyboard-navigation.spec.ts` runs in CI (extension of Story 1.10)
**When** the test traverses the 5 user journeys keyboard-only
**Then** each journey is completable end-to-end and the test asserts no `tabindex="-1"` traps exist on focusable elements

**Given** I use a screen reader (VoiceOver iOS or TalkBack Android)
**When** I navigate
**Then** ARIA labels are correct on all primary actions, headings are properly nested (h1 → h2 → h3), and live regions announce async updates (e.g., "Note enregistrée") (NFR38)

**And** the page passes axe-core a11y scan with zero WCAG AA violations on the 5 user journeys (AR33)

---

## Epic 8: Conformité opérationnelle, exports RGPD & compteurs publics

Délivrer le pilier "conformité radicale + transparence opérationnelle" : page publique `/transparence` exposant les compteurs publics agrégés et la section "Comment vos données sont protégées" en FR/AR, export RGPD self-service JSON pour résident, export du journal de modération sur période pour co-mod (audit CNDP), purge automatique logs serveur 30j.

### Story 8.1: Page `/transparence` — compteurs publics agrégés

As a visitor,
I want to consult a public page with aggregate counters (no PII) about Darna's activity,
So that I can audit the platform's posture and trust its claims.

**Acceptance Criteria:**

**Given** I am any visitor (authenticated or not) and I open `/transparence`
**When** the page renders (Server Component, public route at `/[locale]/(public)/transparence`)
**Then** I see counters (in my locale): villas inscrites, artisans publiés, notes/avis postés, alertes émises (cumulatif), bons plans publiés (cumulatif), actions de modération (cumulatif), partages externes (FR51, PRD Measurable Outcomes)

**Given** the counters are queried
**When** the SQL runs
**Then** all values come from server-side aggregate queries (`COUNT(*)`, `GROUP BY` where needed) on the same `residence_id` — no PII is exposed, ever (NFR52, NFR16)

**Given** the page is revalidated
**When** I load it
**Then** the data is cached server-side and revalidated every 1h via `revalidateTag('transparence')` — fresh enough without overloading the DB (NFR-perf)

**Given** the journal section is below the counters (link from Story 5.4)
**When** I scroll
**Then** the moderation log redacted view is rendered (FR33, FR51 cross-link)

**Given** I am Aïcha
**When** I open `/transparence`
**Then** the counters are large, contrasted (≥ 4.5:1), and labeled clearly without jargon (NFR35, NFR40)

**And** the page is RTL-correct in AR mode, fonts auto-hostées, no analytics (NFR45, AR36, NFR52)

---

### Story 8.2: Section "Comment vos données sont protégées" sur `/transparence` FR/AR

As a visitor,
I want a plain-language explanation of Darna's data protection on the transparence page in FR and AR,
So that I understand the CNDP/RGPD posture without legal jargon.

**Acceptance Criteria:**

**Given** the section "Comment vos données sont protégées" is added to `/transparence` below the counters
**When** the page renders in FR
**Then** I read clear paragraphs (Aïcha-readable):

- "Tes données sont stockées en Union européenne (Allemagne), conformément à la loi marocaine 09-08 article 43."
- "Toutes les données au repos sont chiffrées (AES-256)."
- "Tu te connectes par un lien temporaire envoyé par e-mail — aucun mot de passe n'est jamais stocké."
- "Tu peux supprimer ton compte à tout moment ; tes données sont effacées sous 7 jours, tes contributions sont anonymisées (signées 'Voisin supprimé')."
- "Aucun cookie tiers, aucun traceur, aucun analytics. Les compteurs ci-dessus sont calculés côté serveur sur des données agrégées."
- "Liste de nos sous-traitants (DPA signés) : Supabase (Allemagne), Vercel (France), Cloudflare R2 (Europe), Brevo (France), GlitchTip (Allemagne), Upstash (Allemagne)."

**Given** the section is also translated to AR
**When** I switch to AR mode
**Then** the section reads correctly with RTL alignment and identical informational content

**Given** the content is editorial
**When** updates are needed (e.g., a new sub-processor)
**Then** edits happen via a markdown file `content/transparence/data-protection.{locale}.md` (committed to git, no co-mod CMS for legal text — versioning matters)

**And** the section is keyboard-navigable, contrast-compliant, and indexable (`/transparence` is in the public allowlist for indexing per PRD SEO Strategy)

---

### Story 8.3: Export RGPD JSON self-service résident

As a resident,
I want to export my personal data and all my contributions as a structured JSON file,
So that my RGPD article 20 right to portability is operational.

**Acceptance Criteria:**

**Given** I am authenticated and I open `/(community)/profil/export`
**When** the page renders
**Then** I see a clear explanation of what will be exported (my profile, my artisan submissions, my ratings, my comments, my alerts, my tips, my suggestions, my reactions, my reports submitted, my notification preferences) and a single "Exporter mes données" CTA (FR53)

**Given** I tap the CTA
**When** the `exportMyData()` Server Action runs
**Then** a structured JSON is generated server-side aggregating all my owned rows across the relevant tables (with my `user_id`), uploaded to R2 as `r2://darna-exports/users/<user_id>/<timestamp>.json` with a signed URL valid 24h (FR53)

**Given** the export is large (multiple contributions)
**When** generation takes > 5s
**Then** a `loading.tsx` skeleton is shown, the operation runs server-side, and on completion I receive a notification "Ton export est prêt — télécharge-le dans les 24h" with the signed URL (AR21)

**Given** the JSON is structured
**When** I inspect it
**Then** it follows a versioned schema (`{schema_version: "1.0", exported_at: <iso>, user: {...}, contributions: {ratings: [...], alerts: [...], ...}}`) suitable for re-import or audit (RGPD art. 20)

**Given** I export and then delete my account
**When** the export URL is still valid (within 24h)
**Then** the URL continues to resolve (the export is independent of my live data); after 24h, R2 lifecycle policy purges the file

**And** the export contains NO data from OTHER users (no aggregated counts that could re-identify, no third-party contributions on my entities — I get only what's mine)

---

### Story 8.4: Export journal modération co-mod sur période (audit CNDP)

As a co-mod,
I want to export the moderation log for a given date range in CSV or JSON,
So that I can produce a CNDP audit report or share a periodic governance summary.

**Acceptance Criteria:**

**Given** I am authenticated as `co_mod` and I open `/(comod)/admin/transparence`
**When** the page renders
**Then** I see a date range picker (start, end), a format selector (CSV / JSON), and a "Exporter" CTA (FR54)

**Given** I select a range and tap "Exporter"
**When** the Server Action runs
**Then** a file is generated containing all `moderation_log` events for my residence within the range, with columns: `created_at`, `event_key`, `actor_pseudonym`, `target_type`, `target_slug` (no PII), `motive_key` — uploaded to R2 with a 24h signed URL (FR54)

**Given** the export is CSV
**When** I open it
**Then** the headers are localized in my chosen language (FR or AR) and values are UTF-8 encoded with BOM for Excel compatibility

**Given** I am a `resident` and try to access this page
**When** the request hits middleware
**Then** I get HTTP 403 (NFR21)

**And** the exported file NEVER contains author PII (names, e-mails, phone) — only pseudonyms and structural identifiers, consistent with the redacted public journal view (CC #19)

---

### Story 8.5: Purge automatique logs serveur 30j

As the system,
I want server logs to be purged after 30 days automatically,
So that NFR20 / NFR55 retention bounds are enforced without manual intervention.

**Acceptance Criteria:**

**Given** Vercel's native log retention is configured for 30 days (FR55, NFR20, NFR55)
**When** I check Vercel project settings
**Then** log retention is 30 days (Vercel free tier default; explicitly verified in the runbook)

**Given** any application logs land in Vercel logs via `console.log(JSON.stringify(entry))` (per `lib/logger.ts`)
**When** entries age beyond 30 days
**Then** Vercel automatically rotates and deletes them — no separate cron needed; documentation in `docs/runbook.md` confirms this

**Given** application-level operational logs ever land in Postgres (e.g., `moderation_log` — but this is NOT a log, it's a permanent audit trail per NFR17, so excluded)
**When** I audit the schema
**Then** no `logs` table exists; the only audit trail (`moderation_log`) is permanent by design and explicitly NOT covered by NFR20

**Given** GlitchTip retains errors per its own settings
**When** I check the GlitchTip plan
**Then** the retention is documented in the runbook and set within RGPD-compliant bounds (≤ 90 days for errors with optional PII; configured at GlitchTip dashboard)

**And** the runbook's "Data retention summary" table clearly lists: server logs 30d, GlitchTip errors ≤ 90d, moderation_log permanent (audit), DB snapshots 7d (Supabase) + 12 weeks (R2 weekly dumps), all in EU jurisdiction

---

**Total Epic 1-8 :** 49 stories couvrant les 55 FRs + 55 NFRs + 40 ARs (architecture).
