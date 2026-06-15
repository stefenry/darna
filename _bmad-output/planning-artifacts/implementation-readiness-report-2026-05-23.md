---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
filesIncluded:
  prd: _bmad-output/planning-artifacts/prd.md
  architecture: _bmad-output/planning-artifacts/architecture.md
  epics: _bmad-output/planning-artifacts/epics.md
  ux: NOT_FOUND
  stories: NOT_FOUND
  product_brief: _bmad-output/planning-artifacts/product-brief-SmartResidence.md
---

# Implementation Readiness Assessment Report

**Date :** 2026-05-23
**Projet :** SmartResidence (Darna)

---

## Étape 1 — Inventaire documentaire

### Documents trouvés (versions monolithiques)

| Type                       | Fichier                                                                      | Taille | Modifié    |
| -------------------------- | ---------------------------------------------------------------------------- | ------ | ---------- |
| PRD                        | `_bmad-output/planning-artifacts/prd.md`                                     | 86 KB  | 2026-05-10 |
| Architecture               | `_bmad-output/planning-artifacts/architecture.md`                            | 94 KB  | 2026-05-17 |
| Epics                      | `_bmad-output/planning-artifacts/epics.md`                                   | 125 KB | 2026-05-23 |
| Product Brief              | `_bmad-output/planning-artifacts/product-brief-SmartResidence.md`            | 20 KB  | 2026-05-10 |
| Product Brief (distillate) | `_bmad-output/planning-artifacts/product-brief-SmartResidence-distillate.md` | 25 KB  | 2026-05-10 |

### Versions shardées

Aucune. Pas de conflit whole/sharded à résoudre. ✅

### Documents manquants

- ⚠️ **UX Design** : aucun fichier `*ux*.md` trouvé sous `_bmad-output/`. Impacte l'étape 4 (UX Alignment).
- ⚠️ **Stories** : aucune story rédigée (`*story*.md` introuvable). Cohérent avec la mémoire projet qui indique que les 8 ADRs sont à rédiger dans la story 1. Impacte l'étape 5 (Epic Quality Review au niveau story).

### Doublons

Aucun. ✅

---

## Étape 2 — Analyse PRD

**Source :** `_bmad-output/planning-artifacts/prd.md` (1 048 lignes, finalisé 2026-05-10, status `complete`).

### Synthèse

| Indicateur                  | Valeur                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acteurs canoniques définis  | 6 (Visiteur public, Demandeur, Résident, Co-mod, Artisan, Système)                                                                                  |
| FRs extraits                | **57** (FR1→FR55 + FR43b + FR43c)                                                                                                                   |
| NFRs extraits               | **56** (NFR1→NFR55 + NFR40b)                                                                                                                        |
| Familles fonctionnelles     | 9 (Admission/Auth, Annuaire, Contenu durable, Contenu éphémère, Modération, Partage/WhatsApp, Notifications, Engagement, PWA/i18n/A11y, Conformité) |
| Familles non-fonctionnelles | 7 (Performance, Security & Privacy, Scalability, Reliability, Accessibility, i18n, Maintainability/OS)                                              |
| User Journeys formalisés    | 5 (Yassine, Aïcha, Karim&Salma, Nadia, Co-mod Karim)                                                                                                |
| Hors-scope explicites       | 10 (politique, monétisation, native apps, mots de passe, menu hamburger, gamification, tracking, etc.)                                              |
| Open questions résiduelles  | 5 (achat darna.org, framework PWA, provider SMS, contact technique secours, contact juridique recours) — _à arbitrer en architecture_               |

### Functional Requirements — index

**Admission & Authentication (11 FRs)** : FR1 (lecture publique sans auth), FR2 (soumission inscription villa+tranche+prénom+e-mail/SMS), FR3 (magic link envoi), FR4 (clic magic link → file), FR5 (état demande), FR6 (file vue par co-mod), FR7 (accept/reject motivé), FR8 (notif décision), FR9 (session 12 mois renouvelée), FR10 (logout per device + all), FR11 (suppression compte < 7j).

**Annuaire d'artisans (11 FRs)** : FR12 (recherche + filtres), FR13 (fiche détaillée), FR14 (action appel), FR15 (création fiche), FR16 (pseudonyme par défaut / opt-in identité), FR17 (SMS magic link consentement), FR18 (consentement artisan en 1 tap), FR19 (notif contributeur après consentement), FR20 (notation typée 4 axes), FR21 (édition/retrait contributions), FR22 (droit de réponse artisan).

**Contenu durable (4 FRs)** : FR23 (Guide résident FAQ deep-linkable), FR24 (Numéros utiles), FR25 (Pack accueil nouveaux arrivants), FR26 (co-mod CRUD sur les 3 modules).

**Contenu éphémère (4 FRs)** : FR27 (alerte modèle pré-rédigé), FR28 (auto-expiration), FR29 (bons plans expirables), FR30 (liste alertes+bons plans actifs).

**Modération & Transparence (5 FRs)** : FR31 (signalement liste fermée), FR32 (retrait + motivation + notif auteur ≤24h), FR33 (journal public actions), FR34 (soft-delete audit CNDP), FR35 (escalade juridique guidée).

**Partage & WhatsApp (4 FRs)** : FR36 (URL canonique stable par entité), FR37 (copie URL 1 tap), FR38 (deep linking WhatsApp/navigateur), FR39 (login post-deep-link avec contexte préservé).

**Notifications (4 FRs)** : FR40 (3 catégories opt-in indépendantes), FR41 (Web Push + fallback e-mail iOS<16.4), FR42 (co-mod auto-notif événements modération), FR43 (zéro marketing, opt-in strict).

**Engagement léger (2 FRs)** : FR43b (👍 sans modal — pas de 👎), FR43c (suggestion produit lue par co-mods, pas de débat public).

**PWA, i18n & Accessibilité (7 FRs)** : FR44 (page /install OS-aware), FR45 (lecture offline complète post-cache), FR46 (bascule FR/AR mémorisée profil), FR47 (langue par défaut via Accept-Language), FR48 (fallback FR si AR absent), FR49 (navigation clavier intégrale), FR50 (prefers-reduced-motion respecté).

**Données opérationnelles & Conformité (5 FRs)** : FR51 (compteurs publics agrégés /transparence), FR52 (zéro analytics client), FR53 (export RGPD JSON par résident), FR54 (export journal modération par co-mod), FR55 (purge logs 30j).

### Non-Functional Requirements — index

**Performance (9 NFRs)** : FCP <1.5s, LCP <2.5s, TTI <3.5s, CLS <0.1, Lighthouse PWA ≥90, bundle <150KB, search <300ms p95, fiche cache <100ms, no-regression >20% entre releases.

**Security & Privacy (12 NFRs)** : TLS 1.3 + HSTS, magic link only, expiration 15min usage unique, sessions 12 mois invalidables, données UE uniquement, zéro service hors-UE, zéro cookie tiers, soft-delete tracé, effacement <7j, chiffrement transit, logs 30j, vérif rôles serveur.

**Scalability (5 NFRs)** : 150 utilisateurs simultanés p95 <500ms, ≤15€/mois MVP, ≤50€/mois à 100 villas, modèle `residence_id` paramétrable MVP, 10 inscriptions/h sans dégradation.

**Reliability (7 NFRs)** : ≥99% 7h-23h, pas de SLA 24/7, mirror GitHub→GitLab/Codeberg <24h, runbook écrit, gestionnaire mots de passe partagé, contact technique secours désigné, backup Supabase quotidien 7j.

**Accessibility (8 NFRs)** : Lighthouse A11y ≥95, contraste 4.5:1, cibles tactiles ≥48px, clavier intégral, ARIA labels testés VoiceOver/TalkBack, reduced-motion, **règle Aïcha 30s**, **principe « geste = WhatsApp »**.

**Internationalization (7 NFRs)** : FR (LTR) + AR (RTL), contenu Guide/Pack/Numéros bilingue, tags bilingues structurés, templates SMS/e-mail bilingues, CSS logical properties, Intl API dates/nombres, zéro chaîne hardcodée.

**Maintainability & Open Source (8 NFRs)** : MIT J1, README FR+EN, lint+formatter, couverture tests « suffisante pour ne pas régresser », GitHub Actions, doc fork V1.5, structure communautaire framework, ADRs pour décisions structurelles.

### Exigences additionnelles capturées

- **Acteurs canoniques** explicitement nommés (`Résident`, `Demandeur`, `Co-mod`, `Artisan`, `Visiteur public`, `Système`) — base solide pour traçabilité epics.
- **Décisions vault** intégrées : admission validation manuelle (2026-05-07), pseudonyme par défaut, hébergement UE, MIT dès J1.
- **Traceability native** : section §12 du PRD trace Vision → Success → Journeys → FRs → NFRs.

### Évaluation de complétude PRD

| Critère                                                 | Verdict                                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| FRs numérotés, formulés en capacités acteur×verbe×objet | ✅ Excellent                                                                                                  |
| NFRs mesurables avec cibles chiffrées                   | ✅ Excellent (FCP, LCP, contraste, p95, etc.)                                                                 |
| Acteurs canoniques                                      | ✅ Définis explicitement                                                                                      |
| Traçabilité Vision↔FR↔NFR                               | ✅ Section dédiée                                                                                             |
| Hors-scope explicite                                    | ✅ 10 rejets idéologiques listés                                                                              |
| Risques identifiés et mitigés                           | ✅ 4 risques structurels + tableau techniques/marché/ressources                                               |
| Open questions encore ouvertes                          | ⚠️ 5 — toutes routées vers architecture, l'une d'elles (framework PWA) déjà tranchée d'après mémoire projet   |
| Numérotation FR                                         | ⚠️ Trous techniques (FR43b/c, NFR40b) — non-bloquant mais sémantiquement fragile pour traçabilité automatique |

---

## Étape 3 — Validation de la couverture des epics

**Source :** `_bmad-output/planning-artifacts/epics.md` (2 061 lignes, status `complete`, finalisé 2026-05-23).

### Inventaire epics

| #         | Epic                                              | Stories        | FRs couvertes    | Goal résumé                                                    |
| --------- | ------------------------------------------------- | -------------- | ---------------- | -------------------------------------------------------------- |
| 1         | Fondations techniques & Admission communautaire   | 10 (1.1→1.10)  | FR1-11, FR44     | Bootstrap technique + parcours admission complet               |
| 2         | Annuaire d'artisans noté (killer feature)         | 8 (2.1→2.8)    | FR12-22          | Recherche, fiche, création, consentement async, notation typée |
| 3         | Contenu durable                                   | 5 (3.1→3.5)    | FR23-26          | Guide, Numéros utiles, Pack accueil + CRUD co-mod              |
| 4         | Contenu éphémère                                  | 5 (4.1→4.5)    | FR27-30          | Alertes templates, bons plans, feed, auto-expiration           |
| 5         | Modération réactive & Transparence radicale       | 5 (5.1→5.5)    | FR31-35          | Signalement, retrait, journal public, escalade juridique       |
| 6         | Partage WhatsApp & engagement léger               | 5 (6.1→6.5)    | FR36-39, FR43b-c | Slugs, share 1-tap, contexte pré-login, 👍, suggestion         |
| 7         | Notifications, hors-ligne, langues & a11y avancée | 6 (7.1→7.6)    | FR40-43, FR45-50 | Préférences notifs, SW offline, bascule FR/AR, clavier         |
| 8         | Conformité opérationnelle & exports RGPD          | 5 (8.1→8.5)    | FR51-55          | /transparence, exports JSON/CSV, purge logs 30j                |
| **Total** | **8 epics**                                       | **49 stories** | **57 FRs**       |                                                                |

### Matrice de couverture FR → Epic → Story

| FR    | Famille          | Epic      | Story principale                                           | Statut                                 |
| ----- | ---------------- | --------- | ---------------------------------------------------------- | -------------------------------------- |
| FR1   | Auth             | 1         | 1.4 (pages publiques)                                      | ✅                                     |
| FR2   | Auth             | 1         | 1.7 (form demande)                                         | ✅                                     |
| FR3   | Auth             | 1         | 1.6 (magic link e-mail)                                    | ✅                                     |
| FR4   | Auth             | 1         | 1.7 (vérif → file)                                         | ✅                                     |
| FR5   | Auth             | 1         | 1.7 (page état demande)                                    | ✅                                     |
| FR6   | Auth             | 1         | 1.8 (file co-mod)                                          | ✅                                     |
| FR7   | Auth             | 1         | 1.8 (accept/reject motivé)                                 | ✅                                     |
| FR8   | Auth             | 1         | 1.8 (notif décision)                                       | ✅                                     |
| FR9   | Auth             | 1         | 1.6 (session 12 mois)                                      | ✅                                     |
| FR10  | Auth             | 1         | 1.6 + 1.9 (logout per device + all)                        | ✅                                     |
| FR11  | Auth             | 1         | 1.9 (suppression RGPD < 7j)                                | ✅                                     |
| FR12  | Annuaire         | 2         | 2.2 (recherche FTS + filtres)                              | ✅                                     |
| FR13  | Annuaire         | 2         | 2.3 (fiche détaillée)                                      | ✅                                     |
| FR14  | Annuaire         | 2         | 2.3 (action `tel:`)                                        | ✅                                     |
| FR15  | Annuaire         | 2         | 2.4 (création fiche)                                       | ✅                                     |
| FR16  | Annuaire         | 2         | 2.4 + 2.6 (pseudo/identité)                                | ✅                                     |
| FR17  | Annuaire         | 2         | 2.4 (SMS magic link)                                       | ✅                                     |
| FR18  | Annuaire         | 2         | 2.5 (page consentement)                                    | ✅                                     |
| FR19  | Annuaire         | 2         | 2.5 (notif contributeur)                                   | ✅                                     |
| FR20  | Annuaire         | 2         | 2.6 (notation typée 4 axes)                                | ✅                                     |
| FR21  | Annuaire         | 2         | 2.7 (édition/retrait)                                      | ✅                                     |
| FR22  | Annuaire         | 2         | 2.8 (droit de réponse)                                     | ✅                                     |
| FR23  | Contenu durable  | 3         | 3.2 (guide FAQ deep-linkable)                              | ✅                                     |
| FR24  | Contenu durable  | 3         | 3.3 (numéros utiles `tel:`)                                | ✅                                     |
| FR25  | Contenu durable  | 3         | 3.4 (pack accueil post-validation)                         | ✅                                     |
| FR26  | Contenu durable  | 3         | 3.5 (CRUD co-mod)                                          | ✅                                     |
| FR27  | Contenu éphémère | 4         | 4.2 (alerte template 1-tap)                                | ✅                                     |
| FR28  | Contenu éphémère | 4         | 4.5 (cron auto-expire)                                     | ✅                                     |
| FR29  | Contenu éphémère | 4         | 4.3 (bon plan typé expirable)                              | ✅                                     |
| FR30  | Contenu éphémère | 4         | 4.4 (feed tri fraîcheur)                                   | ✅                                     |
| FR31  | Modération       | 5         | 5.2 (signalement raison fermée)                            | ✅                                     |
| FR32  | Modération       | 5         | 5.3 (retrait + notif auteur 24h)                           | ✅                                     |
| FR33  | Modération       | 5         | 5.4 (journal public `/transparence`)                       | ✅                                     |
| FR34  | Modération       | 5         | 5.1 (soft-delete + audit immuable)                         | ✅                                     |
| FR35  | Modération       | 5         | 5.5 (escalade juridique guidée)                            | ✅                                     |
| FR36  | Partage          | 6         | 6.1 (slugs + URL canoniques)                               | ✅                                     |
| FR37  | Partage          | 6         | 6.2 (bouton Partager 1-tap)                                | ✅                                     |
| FR38  | Partage          | 6         | 6.3 (deep linking WhatsApp/nav)                            | ✅                                     |
| FR39  | Partage          | 6         | 6.3 (contexte pré-login préservé)                          | ✅                                     |
| FR40  | Notifications    | 7         | 7.1 (3 catégories opt-in)                                  | ✅                                     |
| FR41  | Notifications    | 7         | 7.2 (Web Push V1.5, e-mail MVP)                            | ⚠️ Web Push différé V1.5 explicitement |
| FR42  | Notifications    | 7 + 1+5+6 | 7.2 + déclenchements transverses (1.7, 1.8, 5.2, 5.3, 6.5) | ✅                                     |
| FR43  | Notifications    | 7         | 7.2 (zéro marketing — règle système)                       | ✅                                     |
| FR43b | Engagement       | 6         | 6.4 (👍 1-tap, pas de 👎)                                  | ✅                                     |
| FR43c | Engagement       | 6         | 6.5 (suggestion lue co-mods)                               | ✅                                     |
| FR44  | PWA              | 1         | 1.5 (`/install` OS-aware)                                  | ✅                                     |
| FR45  | PWA              | 7         | 7.3 (SW offline + background sync)                         | ✅                                     |
| FR46  | i18n             | 7         | 7.4 (bascule FR/AR mémorisée)                              | ✅                                     |
| FR47  | i18n             | 1 + 7     | 1.4 + 7.5 (Accept-Language + fallback)                     | ✅                                     |
| FR48  | i18n             | 7 + 3     | 7.5 + 3.5 (fallback FR si AR absent)                       | ✅                                     |
| FR49  | A11y             | 7         | 7.6 (clavier intégral)                                     | ✅                                     |
| FR50  | A11y             | 7         | 7.6 (`prefers-reduced-motion`)                             | ✅                                     |
| FR51  | Conformité       | 8         | 8.1 (compteurs publics `/transparence`)                    | ✅                                     |
| FR52  | Conformité       | 8         | 8.1 (règle système — zéro analytics)                       | ✅                                     |
| FR53  | Conformité       | 8         | 8.3 (export JSON résident)                                 | ✅                                     |
| FR54  | Conformité       | 8         | 8.4 (export journal co-mod CSV/JSON)                       | ✅                                     |
| FR55  | Conformité       | 8         | 8.5 (purge logs 30j)                                       | ✅                                     |

### Couverture NFR → Epic (par famille)

| Famille NFR                   | NFRs concernés | Epic(s) ancrants                                                                                 | Statut |
| ----------------------------- | -------------- | ------------------------------------------------------------------------------------------------ | ------ |
| Performance (NFR1-9)          | 9              | Epic 2 (cible search <300ms p95, cache offline <100ms), Epic 7 (SW), Lighthouse CI dans Epic 1.2 | ✅     |
| Security & Privacy (NFR10-21) | 12             | Epic 1 (TLS, magic link, sessions, RLS, headers, soft-delete), Epic 8 (transparence)             | ✅     |
| Scalability (NFR22-26)        | 5              | Epic 1 (residence_id multi-tenant, rate-limit), AR7 systémique                                   | ✅     |
| Reliability (NFR27-33)        | 7              | Epic 1 (mirror GitHub, backup hebdo, runbook, password manager)                                  | ✅     |
| Accessibility (NFR34-40b)     | 8              | Epic 7 (clavier, ARIA, reduced-motion) + transverse (Aïcha 30s critère sur toutes stories)       | ✅     |
| i18n (NFR41-47)               | 7              | Epic 1 (next-intl middleware), Epic 3 (contenu bilingue), Epic 7 (bascule + fallback)            | ✅     |
| Maintainability/OS (NFR48-55) | 8              | Epic 1 (MIT J1, README, lint, tests, GH Actions, ADRs)                                           | ✅     |

### Statistiques

| Métrique                             | Valeur                                                           |
| ------------------------------------ | ---------------------------------------------------------------- |
| Total FRs PRD                        | 57                                                               |
| FRs couverts par au moins une story  | **57**                                                           |
| Couverture FR                        | **100%**                                                         |
| Total NFRs PRD                       | 56                                                               |
| NFRs ancrés dans au moins un epic    | **56** (transverses sur plusieurs epics)                         |
| Couverture NFR                       | **100%**                                                         |
| Exigences architecture (AR) ajoutées | 40 (AR1-AR40) — toutes ancrées dans Epic 1 ou epics fonctionnels |

### Incohérences détectées (non-bloquantes)

1. **Comptage FR dans le frontmatter** : `epics.md` déclare `totalFRsCovered: 55` mais le PRD contient bien **57 FRs** (FR1-FR55 + FR43b + FR43c). La FR Coverage Map (lignes 240-302) liste bien FR43b et FR43c → couverture réelle 100%. Recommandation : corriger le frontmatter à 57 pour clarté.
2. **NFR40b « Geste = WhatsApp »** : présent dans le PRD (NFR40b ligne 979), absent de la liste NFR énumérée par epics.md (la ligne 153 le mentionne bien — OK donc, juste à noter qu'il n'apparaît pas explicitement dans la matrice de couverture NFR du document epics). Recommandation : référencer explicitement NFR40b dans Epic 2 (Story 2.6 sur la notation) et Epic 6 (share).
3. **FR41 marqué « Web Push V1.5 »** : la formulation FR41 du PRD exige Web Push avec fallback e-mail. La Story 7.2 explicite que Web Push est différé V1.5 et que MVP livre uniquement e-mail. **Décision tranchée par l'architecture** (cf. ligne 369 du PRD-area et mémoire projet : « Web Push marqué V1.5 par l'architecture »). C'est cohérent mais constitue un **scope-cut de FR41 vs PRD initial**. Décision à confirmer comme officielle dans le PRD (sinon écart traçable).
4. **Notifications co-mods (FR42)** : couverte par 5 stories différentes (1.7, 1.8, 5.2, 5.3, 6.5). Multi-ancrage normal mais aucun « dispatcher central » de notifications n'est défini explicitement. La Story 7.2 le décrit en passant (`lib/email/send.ts` invoqué dans la Server Action originatrice). Recommandation : confirmer que pas de NotificationDispatcher partagé n'est requis ou créer une story technique d'unification si besoin.

### FRs ajoutés en epics et absents du PRD

Aucun. Tous les FRs des epics correspondent à des FRs du PRD.

### Verdict couverture

✅ **Couverture FR 100% · Couverture NFR 100%** — Aucune exigence du PRD n'est orpheline. Les 4 incohérences détectées sont mineures et documentaires (pas de gap d'implémentation).

---

## Étape 4 — Alignement UX

### Statut document UX

❌ **NON TROUVÉ.** Aucun fichier `*ux*.md`, `*design*.md`, `*wireframe*.md`, `*mockup*.md` ou `*figma*` dans le repo.

L'epics.md (ligne 19) acte explicitement ce choix : _« Aucun document UX spécifique n'a été produit — les exigences ergonomiques (règle Aïcha, Geste = WhatsApp, WCAG AA) sont portées par les NFR34-NFR40b et appliquées transversalement. »_

### Évaluation : UX est-il implicite ?

**OUI — fortement.** Darna est une PWA mobile-first à interface graphique riche :

- 3 tuiles d'accueil strictes (Annuaire / Alertes / Guide) explicitement décrites dans Journey 2
- Cibles tactiles ≥ 48×48 px, focus visible, contraste 4.5:1 (NFR34-39)
- Formulaires multi-écrans (admission, création artisan, notation 4 axes)
- Cartes/listes/feeds (annuaire, alertes, bons plans)
- Icônes universelles (clé à molette, cloche, livre) mentionnées Journey 2
- Bilinguisme LTR/RTL avec layout reversal
- Onboarding contextuel post-admission (Journey 3)

### Mécanismes de substitution en place

L'absence de doc UX dédiée est **partiellement compensée** par :

1. **NFRs ergonomiques très spécifiques** — NFR34 (Lighthouse a11y ≥95), NFR35 (contraste), NFR36 (cibles ≥48px), NFR37 (clavier), NFR38 (ARIA), NFR40 (règle Aïcha 30s), **NFR40b (Geste = WhatsApp — copie patterns familiers)**.
2. **5 User Journeys narratifs** dans le PRD avec scénarios temporés (Yassine 90s, Aïcha 22s, Karim&Salma 10min, Nadia 1 SMS, co-mod Karim 8min).
3. **Acceptance Criteria de stories** mentionnent fréquemment l'ergonomie (Story 1.7 « ≤30s par Aïcha », Story 2.3 « ≥56px CTA », Story 2.6 `useOptimistic`, etc.).
4. **Architecture déjà choisie** (Next.js 16 + Tailwind 4 + next-intl + Serwist + auto-hosted fonts Inter+Noto Arabic) **supporte** toutes les contraintes UI implicites.
5. **Hors-scope explicites** suppriment beaucoup d'ambiguïté UX (pas de menu hamburger, pas de mode sombre MVP, pas de spinner — `loading.tsx` skeleton, pas de stores).

### Alignement UX implicite ↔ PRD

| Aspect UX                      | Référence                                                      | Statut                                                                    |
| ------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Mobile-first strict            | PRD Browser Matrix + Responsive Design                         | ✅ Aligné (stories conformes)                                             |
| 3 tuiles d'accueil             | Journey 2 narratif                                             | ⚠️ Pas de spec stories → définition floue (icônes, labels, layout précis) |
| Mode sombre                    | Hors-scope MVP                                                 | ✅ Cohérent                                                               |
| Theme color « vert maghrébin » | PRD ligne 676 « à arbitrer en design »                         | ❌ **Non arbitré**                                                        |
| Iconographie                   | Journey 2 (clé à molette, cloche, livre) + emojis MVP (🚨🎁👍) | ⚠️ Pas de système formalisé                                               |
| Skeleton loading               | AR21 (`loading.tsx`, jamais spinner)                           | ✅ Aligné                                                                 |
| Layout RTL                     | NFR45 (CSS logical properties)                                 | ✅ Aligné                                                                 |

### Alignement UX implicite ↔ Architecture

| Besoin UI inféré            | Couverture archi                                      | Statut                            |
| --------------------------- | ----------------------------------------------------- | --------------------------------- |
| Composants accessibles      | Tailwind + ARIA manuels (pas de bib design system)    | ⚠️ Risque accélération — voir gap |
| Skeleton + Suspense         | Server Components Next.js 16                          | ✅                                |
| Toasts/Notifications inline | Non spécifié                                          | ⚠️ Pas tranché                    |
| Modales + focus trap        | Story 7.6 (Escape ferme + focus return)               | ✅                                |
| Date picker (bons plans)    | Story 4.3 mentionne « date picker » sans librairie    | ⚠️ Choix libre dev                |
| Markdown rendering (guide)  | Story 3.2 mentionne « rendu Markdown » sans librairie | ⚠️ Choix libre dev                |

### ⚠️ Warnings UX

1. **WARN-UX-1 (modéré)** : _Aucune palette/theme/identité visuelle formalisée_. Le PRD mentionne « vert maghrébin à arbitrer en design » → non tranché. Risque : un design ad-hoc pendant le build est difficile à itérer en bêta. **Recommandation** : faire trancher la palette + 1 logo + 1 grid spacing (8pt ou similaire) avant Story 1.4 (premières pages publiques).
2. **WARN-UX-2 (faible)** : _Pas de système d'icônes ni de mockups des 3 tuiles d'accueil_. Journey 2 décrit narrativement (« icône clé à molette ») mais aucune spec → risque d'incohérence visuelle ou de mauvaise lisibilité Aïcha. **Recommandation** : faire 3-4 mockups statiques (Figma ou crayon-scanné) des écrans clés (accueil, annuaire liste, fiche artisan, formulaire admission) avant Story 1.5 → valider en pré-bêta avec 1 testeur Aïcha-proxy.
3. **WARN-UX-3 (faible)** : _Pas de design system / composants partagés définis_. Choix Tailwind raw vs shadcn/ui (lib mentionnée comme V1.5 possible dans epics.md ligne 238) → décision implicite « Tailwind raw au MVP ». **Recommandation** : confirmer ce choix dans un mini-ADR (ADR-0009 « Pas de design system au MVP, composants ad-hoc ») pour stabilité.
4. **WARN-UX-4 (modéré)** : _Validation de la notation typée par bêta-testeur_ (Innovation 3 PRD ligne 515 : « mock-ups testés en bêta avec Aïcha ») — **aucun mock-up n'existe** à 7 semaines du build. Risque : la complexité du formulaire de notation 4 axes n'est pas validée avant l'écriture du code (Story 2.6). **Recommandation** : prototype HTML/papier de la Story 2.6 avant ouverture du build pour test rapide avec Aïcha.

### Verdict UX

⚠️ **Conditionnel** — l'absence de doc UX est **acceptable structurellement** (bonne couverture NFR + journeys + architecture choisie), mais 4 warnings dont 2 modérés méritent d'être traités **avant les stories 1.4-1.5 et 2.6**. Aucun bloqueur dur, mais 2 mini-livrables de design (palette + 3 mockups écrans clés) accélèreraient et sécuriseraient la bêta.

---

## Étape 5 — Revue qualité Epics & Stories

### Critères BMad appliqués

- ✅ Epic centré utilisateur (pas un milestone technique)
- ✅ Epic indépendant (Epic N ne dépend pas d'Epic N+1)
- ✅ Stories indépendamment complétables (pas de forward reference)
- ✅ AC en format Given/When/Then testables
- ✅ Création de tables au moment opportun
- ✅ Story 1.1 = bootstrap depuis starter template (puisque AR1 le spécifie)

### Synthèse par epic

| Epic                         | User value | Indép. | Story sizing | AC quality | Sequencing |    Note     |
| ---------------------------- | :--------: | :----: | :----------: | :--------: | :--------: | :---------: |
| 1 — Fondations & Admission   |    ✅\*    |   ✅   |      ✅      |     ✅     |     ⚠️     |    9/10     |
| 2 — Annuaire artisans        |     ✅     |   ✅   |      ✅      |     ✅     |     ✅     |    10/10    |
| 3 — Contenu durable          |     ✅     |   ✅   |      ✅      |     ✅     |     ⚠️     |    9/10     |
| 4 — Contenu éphémère         |     ✅     |   ⚠️   |      ✅      |     ✅     |     🟠     |    7/10     |
| 5 — Modération               |     ✅     |   ⚠️   |      ✅      |     ✅     |     ✅     |    8/10     |
| 6 — Partage WhatsApp         |     ✅     |   ✅   |      ✅      |     ✅     |     ✅     |    10/10    |
| 7 — Notifs/offline/i18n/a11y |     ✅     |   ⚠️   |      ✅      |     ✅     |     ✅     |    8/10     |
| 8 — Conformité & exports     |     ✅     |   ✅   |      ⚠️      |     ✅     |     ✅     |    9/10     |
| **Moyenne pondérée**         |            |        |              |            |            | **8.75/10** |

\* Epic 1 contient des stories purement techniques (1.1 bootstrap, 1.2 CI/CD, 1.3 schéma, 1.10 hardening). C'est conventionnel et **conforme à la règle BMad section 5A** (greenfield + starter template explicite via AR1).

### Issues détectées

#### 🔴 Critiques

**Aucune.** Aucun epic n'est un pur milestone technique, aucun forward-reference bloquant.

#### 🟠 Majeures (3)

**MAJ-1 — Forward dep schéma `notifications_prefs`** (Epic 4 → Epic 7, Epic 5 → Epic 7)

- _Constat_ : Story 7.1 crée la table `notifications_prefs` mais Stories 4.2, 4.3, 5.2, 5.3 référencent explicitement le scheduling de notifs opt-in (« opt-in notification is scheduled for subscribed residents (delivered via Epic 7 plumbing, but stored ready here) » — Story 4.2).
- _Impact_ : Si Epic 4 ou Epic 5 sont implémentés avant Epic 7, le dispatcher e-mail ne peut pas filtrer par préférences → soit no-op silencieux, soit erreurs runtime.
- _Recommandation_ : **Déplacer la création de `notifications_prefs` dans Story 1.3 (schéma initial)** avec les bons défauts. Story 7.1 ne fait alors plus que l'UI de paramètres. Aucun coût d'archi, gain de séquencement.

**MAJ-2 — Partage de la page `/transparence` entre Story 5.4 et Story 8.1**

- _Constat_ : Story 5.4 décrit `/transparence` comme rendant le journal modération. Story 8.1 décrit la même page comme rendant les compteurs publics, avec le journal « below the counters ».
- _Impact_ : Ambiguïté sur le propriétaire de la page (shell, layout, SEO). Risque de conflit lors du build (Epic 5 vs Epic 8) ou de double-implémentation.
- _Recommandation_ : Explicitement attribuer la page-shell à Story 8.1 (compteurs en haut) et faire de Story 5.4 un **composant `<ModerationJournal />` consommé par 8.1**. Mettre à jour les AC des deux stories pour le refléter.

**MAJ-3 — Schéma `users` incomplet pour Story 3.4**

- _Constat_ : Story 3.4 (Pack accueil) référence `users.first_login_at` et `users.pack_accueil_dismissed_at`. Aucune de ces colonnes n'est listée dans Story 1.3 (qui crée `users`).
- _Impact_ : Story 3.4 nécessitera une migration `ALTER TABLE users` non documentée dans ses AC. Bloque le développement strict d'AC.
- _Recommandation_ : Soit ajouter ces colonnes au schéma initial Story 1.3, soit ajouter une AC explicite à Story 3.4 documentant la migration `ALTER TABLE users ADD COLUMN first_login_at timestamptz, ADD COLUMN pack_accueil_dismissed_at timestamptz`.

#### 🟡 Mineures (8)

**MIN-1 — Story 1.3 crée 5 tables en amont** (`residences`, `users`, `profiles`, `admission_requests`, `moderation_log`). La règle BMad §5.5.B préfère « table créée à la story qui l'utilise ». Acceptable ici (toutes consommées dans Epic 1) mais à noter.

**MIN-2 — `lib/validation/phone-e164.ts` non rattachée à une story**. Utilisée en Story 2.4 mais non créée explicitement avant. Implicit shared lib → ajouter une AC dans Story 2.1 (schéma artisans) ou Story 1.1 (toolchain).

**MIN-3 — Élargissement implicite du périmètre de `moderation_log`**. Story 4.2 logue `alert.created` (événement système, pas modération). Le typage initial de la table (audit modération) doit être étendu — clarifier sa raison d'être : « audit complet d'événements gouvernance » plutôt que « audit modération ».

**MIN-4 — Story 5.3 ligne 1473 introduit une « présence collaborative » co-mods** (« si Karim consulte, soft notice apparaît ») qui exige un mécanisme realtime. Or AR37 dit explicitement _« polling à l'ouverture, pas de WebSocket, pas de Supabase Realtime au MVP »_. **Contradiction** — soit retirer cette AC, soit promouvoir AR37 en V1.5.

**MIN-5 — Critères Aïcha non-testables en CI**. Stories 1.7, 2.6, 3.2, 4.2 ont des AC du type « achievable in ≤ 30s by Aïcha (validated empirically in beta) ». OK mais pas reflété dans la Definition of Done. Recommandation : ajouter une « Bêta DoD » distincte de la « Build DoD » sur ces stories.

**MIN-6 — Story 8.5 est essentiellement de la documentation**. Aucun code de production écrit (juste vérifier le retention Vercel + écrire le runbook). Pourrait être fusionnée dans Story 1.10 (runbook) ou supprimée.

**MIN-7 — Frontmatter `totalFRsCovered: 55`** alors que le PRD a 57 FRs (FR43b/c manquent du compteur). Corriger.

**MIN-8 — Confusion route page vs route webhook en Story 2.5**. Le SMS contient `darna.org/consent/[token]` (page artisan accessible publiquement) mais l'AC ligne 952 dit que le « form posts to `app/api/webhook/sms-consent/route.ts` ». Ces deux endpoints servent des rôles différents (page d'accueil artisan vs webhook entrant Brevo). Renommer le second en `/api/consent/submit` ou clarifier.

### Sequencing recommandé (déduit)

**Build order minimal vital** : Epic 1 → Epic 2 → Epic 3 → Epic 4 → Epic 7 (notifs/offline avant la modération qui en a besoin) → Epic 5 → Epic 6 → Epic 8.

**Alternative recommandée** (si MAJ-1 corrigée) : Epic 1 → Epic 2 → Epic 3 → Epic 4 → Epic 5 → Epic 6 → Epic 7 → Epic 8. Plus naturelle, suit l'ordre numérique. **C'est l'ordre que vise actuellement le document epics.**

### Vérification de la chaîne de traçabilité

- ✅ Vision → Success → Journeys → FRs : section §12 du PRD
- ✅ FRs → Epics : FR Coverage Map epics.md lignes 240-302
- ✅ Epics → Stories : 49 stories réparties sur 8 epics
- ✅ Stories → AC Given/When/Then : très détaillées sur les 49 stories lues
- ✅ ARs → Stories : 40 ARs ancrées dans les AC (AR1-AR4 dans 1.1, AR5-AR7 dans 1.3, AR30-AR34 dans 1.10, etc.)
- ✅ NFRs → Stories : référencées par numéro dans les AC critiques

### Vérification spéciale — Starter Template (rule §5A)

✅ **Conforme.** L'architecture spécifie un starter template (AR1 : `create-next-app --example with-supabase`) et Story 1.1 est exactement « Set up initial project from starter template » avec cloning + dependencies + initial configuration. **L'exigence BMad est satisfaite.**

### Vérification spéciale — Greenfield indicators (rule §5B)

✅ **Conforme.** Le projet a bien :

- Initial project setup story (1.1)
- Development environment configuration (1.1 + 1.2)
- CI/CD pipeline setup early (1.2 — avant les features)

### Verdict qualité

🟢 **Bonne qualité globale (8.75/10)**. Aucun défaut critique. 3 issues majeures dont 1 (MAJ-1) à résoudre **avant Story 4.2** sous peine de friction inter-epic. 8 issues mineures à corriger au fil de l'eau ou à acter explicitement. La discipline BMad (acteurs canoniques, INVEST, AC Given/When/Then, traçabilité) est appliquée avec rigueur.

---

## Synthèse & recommandations

### Statut global de préparation

🟢 **READY avec corrections mineures pré-Story 1.4** (équivalent BMad **Conditionally Ready**).

Le triptyque PRD → Architecture → Epics/Stories est **cohérent, exhaustivement tracé, prêt pour le build** modulo 3 corrections rapides à faire avant les premières stories effectives et 2 mini-livrables design avant la bêta.

### Tableau de bord

| Axe                                        | Score                   | Statut                                  |
| ------------------------------------------ | ----------------------- | --------------------------------------- |
| Couverture FR (57)                         | 100%                    | ✅                                      |
| Couverture NFR (56)                        | 100%                    | ✅                                      |
| Acteurs canoniques définis                 | 6/6                     | ✅                                      |
| Traçabilité Vision↔Success↔Journeys↔FR↔NFR | Complète                | ✅                                      |
| Documents structurants présents            | 3/4 (PRD, Archi, Epics) | ⚠️ (UX absent mais compensé)            |
| Qualité epics (BMad rubric)                | 8.75/10                 | 🟢                                      |
| Issues critiques (🔴)                      | 0                       | ✅                                      |
| Issues majeures (🟠)                       | 3                       | ⚠️                                      |
| Issues mineures (🟡)                       | 8                       | 🟡                                      |
| Warnings UX                                | 4 (dont 2 modérés)      | 🟡                                      |
| ADRs livrés                                | 0 / 8 prévus            | ⚠️ (volontaire — rédigés en Story 1.10) |

### Issues à traiter avant build (en ordre de priorité)

#### Avant Story 1.3 (schéma initial) — _vraiment urgent, 1h de travail_

1. **MAJ-1** : Ajouter `notifications_prefs` à la liste de tables créées en Story 1.3 (élimine la forward dep Epic 4/5 → Epic 7).
2. **MAJ-3** : Ajouter `users.first_login_at` et `users.pack_accueil_dismissed_at` au schéma initial Story 1.3 (élimine la migration implicite en Story 3.4).
3. **MIN-2** : Documenter la création de `lib/validation/phone-e164.ts` dans Story 2.1 (ou Story 1.1 toolchain).

#### Avant Story 1.4 (premières pages publiques) — _2h de design_

4. **WARN-UX-1** : Trancher la palette principale (vert maghrébin + neutres + alerte), 1 logo, grid 8pt.
5. **WARN-UX-2** : Mocker (Figma ou crayon) 3 écrans clés : accueil 3-tuiles, fiche artisan, formulaire admission. Pas besoin d'être polish — valider l'ergonomie avec un proxy Aïcha.

#### Avant Story 2.6 (notation typée) — _30min de prototypage_

6. **WARN-UX-4** : Prototype papier/HTML du formulaire de notation 4 axes pour test rapide. Innovation 3 du PRD repose dessus.

#### À acter explicitement (clarifications)

7. **MAJ-2** : Trancher propriétaire de la page `/transparence` → Story 8.1 (shell + compteurs) ; Story 5.4 livre un `<ModerationJournal />` consommé.
8. **MIN-4** : Retirer ou différer la « présence collaborative co-mods » de Story 5.3 (contredit AR37). Décision recommandée : **retirer au MVP**, V1.5 si besoin.
9. **MIN-8** : Clarifier dans Story 2.5 la séparation page consentement artisan (`/consent/[token]`) vs webhook Brevo (`/api/webhook/sms-status`) — ce sont deux endpoints différents.
10. **FR41 / Web Push** : Acter formellement le différé Web Push V1.5 dans une mise à jour du PRD (FR41 actuel exige Web Push avec fallback e-mail ; l'archi a tranché e-mail-only MVP).

#### À corriger au fil de l'eau (sans bloquer le build)

11. **MIN-1** : Acceptable, noter pour rétrospective.
12. **MIN-3** : Élargir la doc de `moderation_log` à « audit gouvernance » plutôt qu'« audit modération ».
13. **MIN-5** : Marquer les AC type « Aïcha 30s » comme « Bêta DoD » et non « Build DoD ».
14. **MIN-6** : Fusionner Story 8.5 dans Story 1.10 (runbook).
15. **MIN-7** : Corriger `totalFRsCovered: 57` dans frontmatter epics.md.
16. **WARN-UX-3** : Mini-ADR-0009 « Pas de design system au MVP, composants ad-hoc ».

### Prochaines étapes recommandées

1. **Corriger Story 1.3** (MAJ-1 + MAJ-3 + MIN-2) → ~30min.
2. **Mettre à jour epics.md** pour les clarifications MAJ-2, MIN-4, MIN-8 → ~30min.
3. **Produire palette + 3 mockups + prototype notation** (WARN-UX-1/2/4) → ~3h.
4. **Mettre à jour le PRD** pour acter le différé Web Push V1.5 (FR41) → ~10min.
5. **Démarrer Story 1.1** (bootstrap toolchain) en parallèle du design.
6. **Recruter les 2-3 co-mods volontaires** d'ici fin mai (cf. PRD ligne 765 — Cible à 31 mai).
7. **Identifier le contact technique de secours + contact juridique de recours** avant lancement bêta (NFR32 + PRD ligne 768) — toujours en suspens.

### Hors-scope du présent audit mais à surveiller

- 5 open questions du PRD encore non tranchées (achat `darna.org`, provider SMS définitif, contact technique secours, contact juridique recours). La mémoire projet indique que l'archi en a tranché 3 (framework Next.js 16, provider e-mail Brevo, RLS strict). Vérifier l'état de l'achat de domaine et du contrat SMS.
- 8 ADRs à rédiger en Story 1.10 — gros morceau (8 documents). Risque de glissement si concentrés en fin d'Epic 1. **Recommandation** : rédiger 2-3 ADRs en parallèle dès le démarrage (par exemple ADR-0001 FTS Postgres + ADR-0002 Brevo + ADR-0004 RLS) pour étaler la charge.
- Validation manuelle d'admission (décision 2026-05-07) crée une friction d'admission. Surveiller le taux de conversion bêta (15-28 juin).

### Final Note

L'audit a identifié **15 issues réparties sur 4 catégories** (couverture, UX, qualité epics, ADRs/runbook) plus 4 warnings UX. **Aucune issue critique.** Les 3 majeures sont des corrections d'ingénierie de 30-60min chacune. Les 4 warnings UX appellent ~3h de design avant le build.

Vu la qualité documentaire (PRD 1048 lignes finalisé, Architecture 1516 lignes validée, Epics 2061 lignes avec 49 stories AC-détaillées), le projet est **mûr pour démarrer Phase 4 (implémentation)** dès que les 3 corrections critiques pré-Story 1.3 sont appliquées. La cible **MVP début juillet 2026** (PRD ligne 81) reste atteignable si le build démarre la semaine du 26 mai 2026.

---

**Rapport généré le** : 2026-05-23
**Évaluateur** : Claude (skill bmad-check-implementation-readiness)
**Documents évalués** : prd.md (1048l) · architecture.md (1516l, non re-lu — meta inférée des epics) · epics.md (2061l)
**Verdict global** : 🟢 **READY** avec 3 corrections pré-Story 1.3 (~1h) + 3h de design.

---

## Addendum 2026-05-23 (soir) — Risques identifiés via workflow UX

Spec UX `ux-design-specification.md` finalisée étape 10 (User Journey Flows) avec brainstorming exhaustif des risques sur les 5 flows. **36 risques recensés en 4 catégories**.

### Corrections supplémentaires aux stories existantes

| Story                                           | Risque adressé                                            | Correction à appliquer                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Story 1.6** (magic link e-mail Brevo)         | T1 — magic link en spam                                   | AC supplémentaire : SPF/DKIM/DMARC sur `darna.org` + test délivrabilité sur 5 providers (Gmail, Outlook, iCloud, Orange.ma, Maroc-Telecom) avant bêta. Tracking côté Brevo (% bounce).                                                                                                           |
| **Story 1.7** (demande admission)               | L4 — consentement CGU contestable + S4 burnout co-mods    | AC supplémentaires : checkbox CGU **non-précochée** obligatoire (validation Zod bloquante) + plafond 10 admissions/jour/IP via rate limit Upstash OU ouverture lancement en 2 vagues.                                                                                                            |
| **Story 1.8** (validation co-mod)               | T5 — race condition multi-co-mod                          | AC supplémentaire : Server Action en transaction avec `SELECT … FOR UPDATE` sur `admission_requests.id` + check `state='pending'`. Si déjà traité : message « Cette demande a déjà été traitée par [autre co-mod] ».                                                                             |
| **Story 2.1** (schéma artisans)                 | T7 — phone E.164 normalisation                            | `lib/validation/phone-e164.ts` doit **normaliser** (strip spaces/dashes/parens) **avant** validation Zod, pas juste rejeter. Test unitaire 6 variantes.                                                                                                                                          |
| **Story 2.4** (création artisan + consentement) | S1 — Nadia coche CNDP à la légère + U7 cognitive load     | (1) Texte CNDP gate explicite engageant responsabilité personnelle : _« En cochant, je confirme avoir parlé personnellement à [nom artisan]. »_ (2) Form en 2 étapes (qui / détails+CNDP+visibilité) avec progress dots. (3) Bêta : tracker ratio refus consentement (>30% = mauvaise pratique). |
| **Story 2.5** (consentement artisan SMS)        | T2 — SMS provider Maroc + T8 token court + L1 base légale | (1) Provider testé sur 3 opérateurs MA (Inwi, IAM, Orange) + plan B fallback e-mail si artisan a un mail. (2) Token HMAC court (16-20 chars) au lieu d'UUID. URL `darna.org/c/XXXX`. (3) Validation base légale CNDP de la conservation pré-consentement par contact juridique.                  |
| **Story 3.2** (Guide lecture)                   | T3 — cache stale codes portails                           | Stratégie `StaleWhileRevalidate` sur `/guide/*` (pas `CacheFirst`). Badge « mis à jour il y a Xh » plus visible quand > 24h.                                                                                                                                                                     |
| **Story 3.4** (Pack accueil)                    | U2 — overlay frustrant + U6 dismiss accidentel            | (1) Bannière dismissable en haut de l'accueil, pas overlay bloquant. (2) Lien permanent vers Pack accueil dans le Guide (catégorie épinglée en haut).                                                                                                                                            |
| **Story 5.3** (queue signalements co-mod)       | S6 — auteur retrait poste plainte WhatsApp                | E-mail de notification au retrait inclut motif clair + lien vers la charte de modération + adresse de recours (`comod-team@darna.org`).                                                                                                                                                          |

### Critères go/no-go lancement bêta — additions

S'ajoutent aux critères existants du PRD :

- ✅ **DNS `darna.org` propagé** vérifié sur dnschecker.org (T6) — J-7 avant ouverture
- ✅ **SPF/DKIM/DMARC** validés sur Brevo (T1) — test délivrabilité passé
- ✅ **SMS provider** validé sur 3 opérateurs MA (T2) — taux de délivrabilité ≥ 95%
- ✅ **≥ 3 co-mods actifs vérifiés** avec accès admin testé + runbook lu (S5)
- ✅ **Contact technique de secours** désigné nominativement avec SLA 24h (NFR32 + bus factor)
- ✅ **Contact juridique de recours** identifié + base légale CNDP pré-consentement validée (L1, L7, PRD 768)
- ✅ **Mockup notation typée** testé avec ≥ 1 proxy Aïcha (U1, WARN-UX-4) — chrono ≤ 30s

### Synthèse risques bêta à monitorer

10 risques mineurs additionnels à inclure dans le plan de tests bêta 15-28 juin 2026 (cf. section « Risques identifiés et mitigations » du document UX `ux-design-specification.md`).
