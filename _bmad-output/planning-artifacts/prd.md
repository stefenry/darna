---
stepsCompleted:
  [
    'step-01-init',
    'step-01b-continue',
    'step-02-discovery',
    'step-02b-vision',
    'step-02c-executive-summary',
    'step-03-success',
    'step-04-journeys',
    'step-05-domain',
    'step-06-innovation',
    'step-07-project-type',
    'step-08-scoping',
    'step-09-functional',
    'step-10-nonfunctional',
    'step-11-polish',
    'step-12-complete',
  ]
status: complete
finalized: 2026-05-10
releaseMode: phased
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-SmartResidence.md
  - _bmad-output/planning-artifacts/product-brief-SmartResidence-distillate.md
  - _bmad-output/brainstorming/brainstorming-session-2026-05-05-1442.md
  - LocalVault/01-PROJECTS/Darna/decisions.md
  - LocalVault/01-PROJECTS/Darna/open-questions.md
documentCounts:
  briefs: 2
  brainstorming: 1
  vault_decisions_and_questions: 2
  research: 0
  projectDocs: 0
projectType: greenfield
workflowType: prd
project_name: Darna
codename_repo: SmartResidence
created: 2026-05-05
classification:
  projectType: web_app
  projectTypeAnnotations:
    - 'PWA installable (service worker, page /install OS-aware, install prompts iOS+Android)'
    - 'Hybride WhatsApp (deep linking partageable de premier rang)'
  domain: civic-tech / community-commons
  domainNote: 'Non-régulé sectoriellement mais nominatif sous double juridiction CNDP (Maroc, Loi 09-08) + RGPD (UE) ; risque diffamation structurel droit marocain'
  complexity:
    overall: medium
    axes:
      functional: low
      compliance: high
      accessibility_i18n: high
      scaling: low
  projectContext: greenfield
  projectContextNote: 'Greenfield technique sur brownfield social (4 groupes WhatsApp actifs avec habitudes ancrées — cohabitation = exigence, pas option)'
  productPosture: 'Commun numérique open source MIT, anti-plateforme par construction, voix éditoriale collective anonyme'
  newDecisions:
    - date: 2026-05-07
      decision: "Inscription = magic link puis validation manuelle par 1 des 3-4 admins (modération préventive sur l'admission, réactive sur le contenu). Remplace l'auto-inscription décidée le 2026-05-05."
---

# Product Requirements Document — Darna

**Author:** Stephane Henry
**Date:** 2026-05-05 (création) · 2026-05-10 (finalisation polish)
**Project codename (repo):** SmartResidence
**Public name:** Darna (دارنا)

## Document Map

Ce PRD est lisible en bloc ou par sections autonomes. Chaque section cible une question distincte ; les LLMs downstream (UX, architecture, epics) peuvent extraire individuellement.

| §   | Section                                  | Question à laquelle elle répond                                      |
| --- | ---------------------------------------- | -------------------------------------------------------------------- |
| 1   | **Executive Summary**                    | Quel produit, pour qui, contre quel problème ?                       |
| 2   | **Project Classification**               | Quel type de projet, complexité, juridiction ?                       |
| 3   | **Success Criteria**                     | À quoi reconnaît-on que Darna a réussi ?                             |
| 4   | **Product Scope**                        | Qu'est-ce qui est dans MVP / V1.5 / V2 / V3 / hors-scope permanent ? |
| 5   | **User Journeys**                        | Quels parcours réels les utilisateurs suivent-ils ?                  |
| 6   | **Domain-Specific Requirements**         | Quelles contraintes CNDP/RGPD/diffamation/accessibilité s'imposent ? |
| 7   | **Innovation & Novel Patterns**          | Qu'est-ce qui est nouveau et comment on le valide ?                  |
| 8   | **Web App / PWA Specific Requirements**  | Quelles contraintes propres à une PWA installable hybride WhatsApp ? |
| 9   | **Project Scoping & Phased Development** | Stratégie MVP, ressources, et mitigation des risques majeurs ?       |
| 10  | **Functional Requirements**              | **Capability contract** — quoi exactement l'app doit savoir faire ?  |
| 11  | **Non-Functional Requirements**          | À quel niveau de qualité (perf, sécurité, accessibilité, etc.) ?     |
| 12  | **Traceability**                         | Chaîne Vision → Success → Journeys → FRs → NFRs                      |

## Executive Summary

**Darna** (دارنا — « notre maison ») est une PWA communautaire pour les **150 villas d'une résidence marocaine**, conçue comme un **commun numérique de quartier** : open source MIT, gratuite, sans store, sans monétisation, voix éditoriale collective anonyme. Le produit transforme la mémoire dispersée des conversations WhatsApp en référentiel structuré, chercheable et partageable.

**Problème résolu.** Sur la résidence, l'information pratique circule déjà via 4 groupes WhatsApp coexistants — mais sans mémoire : la recommandation d'un plombier postée en mars est introuvable en septembre. Les nouveaux arrivants reposent les mêmes questions, le ciment communautaire s'effrite. C'est une **douleur tiède, pas brûlante** — adoption attendue par confort, pas par soulagement.

**Utilisateurs cibles.** 150 foyers, échelle ergonomique calée sur la « règle Aïcha » (72 ans, 1ʳᵉ génération mobile, 30 secondes pour exécuter toute fonctionnalité ou l'interface est ratée). 6 personas terrain identifiés (Aïcha, Karim/Salma, Yassine, Ali Ouameur président syndic, Nadia maman solo, Mohamed gardien — ce dernier explicitement hors-MVP pour préserver la pureté horizontale).

**Killer feature : annuaire d'artisans noté par les voisins** — notation typée par compétence (dépannage / petits travaux / travail soigné / urgences), bilingue FR/AR au MVP, échelle de prix relative, mention « facture émise » (trait local Maroc). Pseudonyme par défaut sur les avis, identité visible sur opt-in. Six modules complémentaires forment le MVP : alertes éphémères, bons plans, numéros utiles, guide résident, pack accueil, inscription par magic link.

**Cible de lancement** : début juillet 2026 sur la résidence (cadrage 6→15 mai · build 18 mai→14 juin · bêta 5 voisins 15→28 juin · pré-amorçage annuaire 17→30 juin).

### What Makes This Special

Quatre piliers de différenciation, dont aucun concurrent (BuildingLink, Nextdoor, Wesabi, WhatsApp Communities) ne couvre la combinaison :

1. **🧠 Mémoire structurée comme valeur centrale** — pas un nouveau canal de discussion mais un référentiel qui gagne en valeur avec le temps. Anti-WhatsApp par construction.
2. **🤝 Cohabitation choisie avec WhatsApp via deep links** — chaque fiche est une URL partageable. WhatsApp devient canal de viralité, pas concurrent à arracher. **Pas d'effort d'adoption forcée.**
3. **🌳 Pureté horizontale habitants-pour-habitants** — pas de syndic, pas de gardien, pas d'autorité intégrée au MVP. Code MIT public, voix collective anonyme, gouvernance distribuée à 3-4 admins volontaires.
4. **🌱 Valeur dès le premier utilisateur** — utile même seul (mémoire perso d'artisans). Tue le cold start qui condamne 90% des apps communautaires.

**Core insight (issu du brainstorming First Principles)** : _Le problème n'est pas « créer un espace de partage » — les groupes WhatsApp existent déjà — mais « créer une mémoire structurée et chercheable de ce qui se partage déjà informellement »._

**Vision long terme (2-3 ans)** : Une fédération informelle de Darnas indépendants entre résidences, chacune forkant son propre code, sans franchise ni plateforme propriétaire — un commun numérique de quartier régional, aligné Maroc Digital 2030 et le mouvement des biens publics numériques (DPGA).

**Why now** : Réforme Loi 18-00 (2025, transparence syndics) crée une attente côté résidents · Maroc Digital 2030 légitime la souveraineté numérique nationale · échec validé de WhatsApp Communities (Meta a vu le problème, n'a pas su le résoudre).

## Project Classification

| Champ                  | Valeur                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project Type**       | `web_app` — PWA installable (service worker, page `/install` OS-aware iOS/Android, install prompts) + hybride WhatsApp (deep linking partageable de premier rang)                                                          |
| **Domain**             | `civic-tech / community-commons` — non-régulé sectoriellement mais nominatif sous **double juridiction CNDP (Maroc, Loi 09-08) + RGPD (UE)** ; risque diffamation structurel droit marocain                                |
| **Complexity**         | `medium` éclatée en 4 axes : fonctionnelle = `low` (CRUD + auth + storage), conformité = `high` (CNDP/RGPD/diffamation), accessibilité/i18n = `high` (règle Aïcha + RTL FR/AR), scaling = `low` (~150 utilisateurs au MVP) |
| **Project Context**    | `greenfield` technique sur **brownfield social** (4 groupes WhatsApp actifs avec habitudes ancrées — cohabitation = exigence, pas option)                                                                                  |
| **Posture produit**    | Commun numérique open source MIT — anti-plateforme par construction, voix éditoriale collective anonyme                                                                                                                    |
| **Modèle d'admission** | Magic link (e-mail OU SMS) → file d'attente → **validation manuelle par 1 des 3-4 admins** → accès. Modération préventive sur l'admission, réactive sur le contenu (décision 2026-05-07).                                  |

**Stack confirmée** (zéro coût marginal jusqu'à ~150 utilisateurs) : PWA (framework à arbitrer en architecture) + Supabase `eu-central-1` (Postgres + Auth + Storage + Realtime) + Vercel `fra1` (frontend + serverless) + Cloudflare R2 juridiction `eu` (stockage fichiers) + registrar européen (`darna.org`).

## Success Criteria

> **Note de cadrage** : Darna n'a ni croissance commerciale à servir, ni investisseur à rassurer. Les paliers ci-dessous sont des **boussoles, pas des KPIs de pilotage**. Le succès final se mesure à un seul critère qualitatif : _Darna est-il devenu un service utile et invisible que personne ne remarque ?_

### User Success

Le succès utilisateur se manifeste par 5 micro-moments observables :

1. **« 5 secondes pour trouver »** — un résident cherche un artisan, ouvre Darna, trouve une fiche notée et le numéro en moins de 5 secondes (vs. 5 minutes de scroll WhatsApp). C'est l'aha-moment central.
2. **« Tiens, je vais regarder sur Darna »** — un résident pense à Darna comme premier réflexe pour une question pratique, avant WhatsApp. Mesurable qualitativement par les co-mods.
3. **« Aïcha s'en sort seule »** — toute fonctionnalité du MVP est exécutable en moins de 30 secondes par Aïcha (72 ans, 1ʳᵉ génération mobile) sans aide. **Critère ergonomique non-négociable validé en bêta.**
4. **« Le nouveau voisin n'a plus à demander »** — un nouvel arrivant trouve seul codes / numéros / artisans / règles via le pack accueil + guide résident, sans poster sur WhatsApp.
5. **« Le voisin contributeur reste »** — un résident qui a posté une fiche d'artisan revient au moins 1 fois par mois (rétention douce, sans gamification).

### Community Success

Remplace le concept de « business success » — Darna est un commun numérique sans modèle économique.

**Paliers d'adoption** (boussoles, pas objectifs de pilotage) :

| Horizon                               | Cible                                                                                 | Signal qualitatif clé                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3 mois** post-lancement (oct. 2026) | **15 villas inscrites** (10%) · 15 artisans seedés et notés · 2-3 co-mods actifs      | Au moins une anecdote vérifiable : _« j'ai trouvé mon plombier sur Darna en 5 secondes »_                                                                  |
| **6 mois** (jan. 2027)                | 75 villas inscrites (50% — masse critique) · 30+ artisans notés par plusieurs voisins | Darna cité spontanément dans les groupes WhatsApp (_« regarde sur Darna »_). Aucun incident de modération majeur.                                          |
| **12 mois** (juil. 2027)              | 100+ villas inscrites (~70%)                                                          | Auto-suffisance modération (initiateurs non-indispensables au quotidien) · Au moins **1 résidence voisine** manifeste son intérêt pour répliquer le modèle |

**Signal-clé qualitatif unique à observer dès le mois 4** : _Un voisin répond-il à une question WhatsApp par un lien Darna (au lieu de retaper la réponse) ?_

- Si OUI = adoption profonde
- Si NON au mois 6 = pivot conversation à déclencher

### Technical Success

Critères techniques mesurables, alignés sur les contraintes de la classification (PWA + CNDP/RGPD + Aïcha + i18n) :

1. **Performance PWA** : First Contentful Paint < 1.5s sur 4G, Lighthouse PWA score ≥ 90, fonctionnel offline en lecture (cache du référentiel artisans).
2. **Conformité CNDP/RGPD opérationnelle dès J1** : registre de traitement publié, consentement artisan documenté, droit d'effacement opérationnel (< 7 jours, testé), pages légales en ligne.
3. **Disponibilité** : ≥ 99% sur les heures de présence résidents (~7h-23h locale). Pas de SLA formel, monitoring artisanal suffisant.
4. **Coût** : ~0 € à 15 €/mois en MVP, ≤ 30-50 €/mois à 100 villas (free tiers Vercel + Supabase + R2 quasi suffisants).
5. **Bilingue FR/AR fonctionnel au lancement** : RTL géré, tags artisans bilingues, contenu guide résident traduit. Darija + Berbère ajoutés en V1.5.
6. **Open source vivant** : repo public GitHub MIT dès J1, mirror sur GitLab/Codeberg (anti-bus-factor), README FR + EN.
7. **Zéro incident CNDP majeur sur 6 mois** — critère pour le pitch syndic et la réplicabilité V3.

### Measurable Outcomes (compatibles privacy-first)

Compteurs côté serveur uniquement (zéro analytics utilisateur côté client) :

- Nombre de villas inscrites (1 villa = 1 inscription validée par admin)
- Nombre d'artisans publiés (avec consentement documenté)
- Nombre de notes/avis postés (cumulatif)
- Nombre d'alertes émises (cumulatif)
- Nombre de partages externes (lien copié, bouton partage activé)
- Nombre d'actions de modération (transparent, journal public)

**Sondage qualitatif** : 1 sondage trimestriel de 5 questions max envoyé via Darna (notification opt-in « Vos retours »). Première vague à 3 mois post-lancement.

## Product Scope

### MVP — V1 (cible : début juillet 2026)

**7 fonctionnalités cœur** (non-négociables pour le lancement) :

1. ✅ **Annuaire d'artisans noté** — notation typée par compétence (dépannage / petits travaux / travail soigné / urgences), tags FR + AR, prix relatif ($→$$$$), indicateur facture émise, pseudonyme par défaut + opt-in identité
2. ✅ **Alertes éphémères** — auto-expirantes, modèles pré-rédigés (1 tap = 1 alerte propre)
3. ✅ **Bons plans** — typés et expirables, pas de dérive Le Bon Coin
4. ✅ **Numéros utiles** — accès rapide (poste de garde, syndic, urgences, pharmacie)
5. ✅ **Guide résident** — FAQ structurée, deep-linkable
6. ✅ **Pack d'accueil nouveaux arrivants** — onboarding différencié
7. ✅ **Inscription + admission** — magic link e-mail OU SMS + validation manuelle 1/3-4 admins, session 12 mois

**Briques transverses MVP** :

- Page `/install` OS-aware (iOS Safari + Android Chrome)
- Deep links partageables sur chaque entité (URL canonique + slug court)
- Annuaire pré-amorcé (10-15 artisans seedés par les co-mods 14 jours avant ouverture publique)
- Conformité CNDP/RGPD opérationnelle + procédure de retrait écrite + contact juridique de recours identifié
- Co-modération à 3-4 admins + journal public d'actions + règle d'escalade (contenu hors-cadre = retrait sous 24h, notification auteur)

### Growth Features (Post-MVP)

**V1.5 — Priorité haute, hors chemin critique du build** (été 2026) :

- 🟡 Tags Darija + Berbère pour les artisans
- 🟡 Documentation de fork pour réplicabilité (préparer V3)
- 🟡 Tableau de bord co-mods pour suivi qualitatif

**V2 — Si traction démontrée** (fin 2026 / début 2027) :

- 🟠 Espace ados (organisation matchs, activités) — parking diplomatique
- 🟠 Espace parents
- 🟠 Annonces officielles syndic (si demande)
- 🟠 Badge artisan partageable (« recommandé par mes voisins de [résidence] »)
- 🟠 Compte famille étendue (la fille d'Aïcha hors résidence)
- 🟠 Transition vers structure associative légère (déclenchée à 100 villas OU 100 €/an cumulés)
- 🟠 Co-modération recrutée avant lancement (pour autres résidences qui forkent)

### Vision (V3 — Fédération inter-résidences)

**Critères pré-requis avant tout pitch sérieux** :

- 100 villas inscrites
- 6 mois d'exploitation stable
- Zéro incident CNDP majeur
- Procédure de fork documentée
- Au moins 1 étude de cas écrite

**V3 inclut** :

- 🔵 Architecture multi-tenant activée (modèle « résidence » paramétrable déjà préparé en MVP)
- 🔵 Trust graph cross-résidences (ratings d'artisans partagés, vie privée locale préservée)
- 🔵 Alertes ville mutualisables entre résidences voisines
- 🔵 Migration possible vers hébergeur marocain (si scaling et cadre juridique le justifient)

### Hors-scope permanent (rejets idéologiques explicites)

- ❌ Toute logique politique, religieuse, ou de régulation des conflits voisinage
- ❌ Toute fonctionnalité de surveillance / signalement de personnes
- ❌ Toute monétisation, publicité, freemium
- ❌ Tout indicateur de visibilité publique des contributeurs (vues, stats, classements)
- ❌ Toute présence sociale en ligne (« qui est en ligne », « vu à »)
- ❌ Application native iOS/Android (PWA only, pas de stores)
- ❌ Mot de passe (magic link uniquement)
- ❌ Menu hamburger (3 tuiles + 1 niveau de profondeur max)
- ❌ Gamification, classements, badges utilisateurs
- ❌ Tracking comportemental, profilage, analytics intrusifs

## User Journeys

### Journey 1 — Yassine cherche un plombier (Happy Path : recherche d'artisan)

**Persona** : Yassine, 38 ans, cadre télétravailleur, parent. Profil P3 — efficacité brute.

**Opening scene.** Vendredi 18h. Le robinet de la cuisine fuit. Yassine ne veut pas perdre 30 minutes à scroller WhatsApp pour retrouver le nom du plombier que les Untel ont recommandé en mars dernier.

**Rising action.** Il ouvre Darna depuis l'écran d'accueil de son téléphone (PWA installée le mois dernier). Tuile **Annuaire** → recherche « plombier ». 4 fiches s'affichent, classées par note typée sur l'axe « Dépannage ». Il filtre par prix relatif ($-$$).

**Climax.** Il ouvre la fiche d'**Hassan**, 4.5/5 sur Dépannage, 4 voisins l'ont noté, mention « facture émise ✅ ». Le commentaire d'un voisin pseudonyme : _« est venu un dimanche, prix correct, parle pas anglais »_. Yassine clique sur le numéro → appel direct depuis le téléphone.

**Resolution.** 90 secondes entre l'ouverture de l'app et l'appel. Hassan vient le lendemain matin. Yassine note Hassan à son tour (4.5/5 Dépannage, $$, facture émise) en 30 secondes.

**Capabilities révélées** :

- Recherche full-text + filtres rapides sur l'annuaire (catégorie compétence, prix, note)
- Affichage de fiche artisan structuré (notation typée, prix relatif, indicateur facture, commentaires pseudonymisés)
- Action « appeler » de premier rang (intent `tel:`)
- Workflow de notation rapide post-intervention (≤ 30 sec)

---

### Journey 2 — Aïcha cherche le code du portail piéton (Primary Edge Case : règle Aïcha)

**Persona** : Aïcha, 72 ans, 1ʳᵉ génération mobile. Profil P1 — standard ergonomique non-négociable.

**Opening scene.** Aïcha rentre du marché. Elle a oublié le code du portail piéton — sa fille aînée le lui avait écrit sur un papier qu'elle ne retrouve pas. Son neveu lui a installé Darna la semaine dernière en lui disant « tu cliques juste sur le rond rouge ».

**Rising action.** Elle déverrouille le téléphone. Elle voit le rond rouge **Darna** sur l'écran d'accueil (PWA installée). Elle tape dessus. Elle voit 3 grandes tuiles : **Annuaire** (avec une icône clé à molette), **Alertes** (cloche), **Guide** (livre).

**Climax.** Elle tape sur **Guide**. Elle voit une liste de questions courtes en français. La 2ᵉ : _« Quels sont les codes des portails ? »_. Elle tape. La page s'ouvre : portail principal, portail piéton, garage. Police grande, contraste élevé.

**Resolution.** 22 secondes entre le déverrouillage du téléphone et la lecture du code. Elle ne se sent pas idiote. Elle ne demande à personne. **Règle Aïcha : validée.**

**Capabilities révélées** :

- Écran d'accueil = 3 tuiles strictes (Annuaire / Alertes / Guide), icônes universelles, pas de menu hamburger
- Guide résident structuré en FAQ avec questions courtes, deep-linkables, hiérarchie 1 niveau
- Typographie accessible (police grande, contraste WCAG AA min, RTL géré pour AR)
- Lecture publique sans login (Aïcha est inscrite mais ce parcours marcherait aussi avant validation admin)

---

### Journey 3 — Karim & Salma viennent d'emménager (Nouveau résident)

**Personas** : Karim & Salma, 30 ans, jeune couple, emménagés il y a 3 jours dans la villa 87, tranche C. Profil P2 — onboarding incarné.

**Opening scene.** Le syndic leur a remis un petit livret papier d'accueil avec un QR code en bas de la page « Pour rejoindre la communauté ». Salma scanne avec son téléphone. Une page `/install` s'ouvre, détecte iOS Safari, lui montre 3 captures pour « Ajouter à l'écran d'accueil ».

**Rising action.** Salma installe la PWA. Elle ouvre Darna. Page d'inscription : numéro de villa (87), tranche (C), prénom (Salma), e-mail. Elle reçoit un magic link, clique. Message : _« Ton inscription est en file. Un voisin va valider sous 24h max. Tu seras notifiée par e-mail. »_

**Climax.** 4 heures plus tard, e-mail : _« Bienvenue sur Darna, Salma 👋 »_. Elle ouvre l'app. Onboarding contextuel : 3 écrans courts (_« Trouver un artisan »_, _« Voir le guide résident »_, _« Recevoir les alertes »_). À la fin, un module **Pack d'accueil nouveaux arrivants** lui est mis en avant : codes portails, horaires gardien, jours de poubelles, contacts utiles, traditions locales (livraison ramadan, distribution Aïd).

**Resolution.** En 10 minutes, Salma a une vue d'ensemble de la résidence qui lui aurait pris 3 semaines de questions WhatsApp embarrassantes. Elle envoie un screenshot du pack d'accueil à Karim au bureau.

**Capabilities révélées** :

- Page `/install` OS-aware (détection iOS Safari / Android Chrome, captures step-by-step, gestion de Safari in-app WhatsApp pour iOS)
- Workflow d'admission : magic link → file d'attente → notification d'acceptation
- Onboarding contextuel post-validation (3 écrans, skippable)
- Module « Pack accueil nouveaux arrivants » (contenu différencié vs guide résident général)
- Possibilité de partager du contenu Darna vers WhatsApp (deep link ou screenshot natif)

---

### Journey 4 — Nadia poste sa première fiche d'artisan (Contributeur)

**Persona** : Nadia, 35 ans, maman solo, installée depuis 8 mois. Profil P5 — test ultime de confiance.

**Opening scene.** Une électricienne, **Fatima**, vient de réparer une prise chez Nadia. Travail propre, prix juste, facture émise sans qu'on demande. Nadia veut partager mais hésite : et si Fatima n'aimait pas être listée publiquement ?

**Rising action.** Nadia ouvre Darna. Tuile **Annuaire** → bouton « + Ajouter un artisan ». Formulaire : nom, téléphone, compétences (checkboxes : électricité ✓), notation typée, prix relatif, indicateur facture. **Avant publication** : message clair _« Avons-nous le consentement de cet artisan ? Darna respecte la CNDP — nous lui enverrons un SMS pour qu'il valide sa fiche avant qu'elle soit visible. »_

**Climax.** Nadia coche « Je confirme avoir prévenu Fatima ». Elle a le choix de signer en pseudonyme (par défaut) ou en identité visible. Elle laisse pseudonyme. Elle commente : _« Très ponctuelle, parle français, accepte de venir le soir. »_ Elle valide. Message : _« Merci ! Fatima va recevoir un SMS pour confirmer. Sa fiche apparaîtra sous 48h une fois consentie. »_

**Resolution.** Fatima reçoit le SMS le lendemain (template Darna, multilingue) avec un lien magic. Elle ouvre, voit comment sa fiche apparaîtra, accepte en 1 tap. Sa fiche est publiée. Nadia reçoit une notification : _« La fiche de Fatima est en ligne. »_ Nadia se sent utile sans se sentir exposée.

**Capabilities révélées** :

- Workflow de création de fiche artisan (formulaire structuré, multi-champs, multi-compétences)
- Workflow de consentement artisan asynchrone (SMS magic link → page de revue → validation/rejet)
- Pseudonymisation par défaut sur les avis, opt-in identité visible (mémorisé par profil)
- Notation typée à la création (1-5 par axe coché)
- Indicateur d'état de publication (en attente consentement / publié / rejeté)
- Notification au contributeur lorsque l'artisan a consenti

---

### Journey 5 — Le co-mod traite la file d'admission + un signalement (Admin / Operations)

**Persona** : Karim (de la villa 12, autre Karim que celui de Journey 3), 45 ans, co-mod volontaire, profil bâtisseur communautaire. Engagé pour ~2h/mois.

**Opening scene.** Lundi 9h. Karim reçoit une notification e-mail Darna : _« 2 demandes d'admission en attente · 1 signalement de contenu »_. Il ouvre l'app sur son téléphone, clique sur l'onglet **Modération** (visible uniquement pour les co-mods).

**Rising action — File d'admission.** Première demande : _« Salma, villa 87, tranche C »_. Karim sait qu'une nouvelle famille a emménagé villa 87 (annoncée WhatsApp la semaine dernière). Il valide en 1 tap. Deuxième demande : _« Mehdi, villa 203 »_. La résidence va de villa 1 à 150. Il rejette avec motif _« Numéro de villa hors résidence »_. Mehdi recevra un e-mail neutre lui proposant de re-vérifier son numéro.

**Rising action — Signalement.** Un voisin a signalé un commentaire sur la fiche du peintre **Anouar** : _« Ce type est un voleur, ne le prenez surtout pas »_. Karim ouvre le commentaire en contexte. Il consulte le journal public d'actions. Il applique la règle d'escalade : contenu manifestement abusif → retrait sous 24h, notification à l'auteur du commentaire avec motif (_« Propos non factuels, droit à la critique respecté mais formulation diffamatoire au regard du droit marocain »_).

**Climax.** L'action de Karim est inscrite au journal public : _« 2026-09-14 — Commentaire retiré sur fiche Anouar (motif : formulation diffamatoire). Auteur notifié. Co-mod : Karim. »_ Tout le monde voit l'action ; rien n'est secret.

**Resolution.** Total : 8 minutes pour les 3 actions. Karim ferme l'app. Il pense : _« 2h par mois, ça tient. »_

**Capabilities révélées** :

- Interface de modération réservée aux co-mods (tab/section visible selon rôle)
- File d'admission avec 2 actions atomiques : valider / rejeter avec motif
- Notification e-mail aux co-mods sur événements pertinents (admission demandée, contenu signalé)
- Signalement de contenu par tout résident inscrit (1 tap sur entité)
- Journal public d'actions de modération (transparence radicale, lecture libre)
- Notification automatique aux personnes concernées (auteur du contenu retiré, demandeur d'admission rejeté)
- Authentification rôle co-mod (3-4 admins définis, pas de hiérarchie entre eux)

---

### Journey Requirements Summary

Les 5 parcours révèlent **8 capacités fonctionnelles cœur** que le PRD doit couvrir dans la section Functional Requirements (step-09) :

1. **Recherche & navigation annuaire** (Journey 1) — full-text + filtres typés, fiche structurée, action appel
2. **Notation typée multi-axes** (Journeys 1, 4) — création + lecture + agrégation
3. **Guide résident & FAQ** (Journey 2) — contenu hiérarchisé, deep-linkable, accessibilité forte
4. **PWA install & onboarding** (Journey 3) — page `/install` OS-aware, onboarding contextuel post-admission
5. **Pack accueil nouveaux arrivants** (Journey 3) — module dédié au contenu de bienvenue
6. **Admission & inscription** (Journeys 3, 5) — magic link → file → validation/rejet → notification
7. **Création de fiche + consentement artisan asynchrone** (Journey 4) — workflow CNDP-compliant à 2 étapes
8. **Modération** (Journey 5) — file d'admission, signalement, retrait, journal public, notifications

**Capacités transverses révélées** :

- 🔐 Auth + rôles (résident vs co-mod)
- 🔔 Notifications opt-in (3 catégories : alertes urgentes / activité contributions / nouveautés annuaire)
- 🌐 i18n FR/AR (RTL géré, contenu bilingue dans tous les flux)
- 📱 PWA installable avec service worker + cache offline en lecture
- 🔗 Deep linking partageable sur chaque entité (artisan, alerte, bon plan, page guide)
- 📊 Compteurs côté serveur (privacy-first, pas d'analytics client)

## Domain-Specific Requirements

### Compliance & Regulatory

Darna opère sous **double juridiction simultanée** : les utilisateurs et les artisans sont au Maroc, l'infrastructure et les données sont en UE.

**🇲🇦 Maroc — Loi 09-08 sur la protection des données personnelles (CNDP)**

- Hébergement UE conforme à l'**article 43** (liste des pays à protection adéquate). Aucun transfert vers pays tiers requis.
- **Consentement explicite des artisans** avant publication d'une fiche nominative (workflow asynchrone SMS magic link, cf. Journey 4).
- **Droit de réponse** opérationnel pour tout artisan noté (interface dédiée + notification de nouvelle note).
- **Droit d'effacement** opérationnel sous **7 jours max** (compte + données associées + cascade sur contributions, soft-delete + purge programmée).
- **Pseudonymisation par défaut** sur les avis (opt-in identité visible).
- **Mentions légales + politique de confidentialité** publiées avant le lancement (templates open source à adapter).
- **Identification du responsable de traitement** (initiateur Stephane jusqu'à transition associative à 100 villas / 100 €/an cumulés).
- **DPIA** (Data Protection Impact Assessment) à évaluer — recommandée vu la nature nominative + communauté fermée + double juridiction. Décision à trancher avant lancement bêta.

**🇲🇦 Maroc — Droit de la diffamation (risque structurel)**

Le droit marocain est strict sur la diffamation, particulièrement entre voisins identifiables. Mitigation à 5 niveaux :

1. Pseudonyme par défaut sur les avis (réduit l'exposition de l'auteur du commentaire)
2. Consentement préalable de l'artisan avant publication (l'artisan accepte d'être listé et noté)
3. Droit de réponse opérationnel (l'artisan peut publier sa version)
4. Modération réactive < 24h sur contenu manifestement abusif (procédure écrite + journal public)
5. **Contact juridique de recours pré-identifié** (avocat/notaire) **avant le premier contentieux potentiel** — non-négociable avant lancement.

**🇪🇺 UE — RGPD (où vivent les données)**

- Privacy by design dès le MVP — appliqué structurellement (zéro analytics intrusifs, magic link sans mdp, lecture publique sans login).
- Registre de traitement publié.
- Droits des personnes concernées (accès, rectification, effacement, portabilité) opérationnels.
- Cookies & consentement : **aucun cookie tiers, aucun tracker** → pas de bandeau cookies à afficher (par construction).

**🇲🇦 Vent porteur — Loi 18-00 (réforme 2025, transparence syndics)**

- Crée une attente de transparence côté résidents — aligne le pitch syndic (Darna offloade ce que la Loi 18-00 ne couvre pas : la coordination horizontale).
- Pas une obligation pour Darna mais un **argumentaire défensif** lors du pitch syndic au mois 6 / 50 villas.

### Technical Constraints

**Hébergement & souveraineté**

- Région unique : **UE — Francfort** (Supabase `eu-central-1`, Vercel `fra1`, Cloudflare R2 juridiction `eu`, registrar européen).
- **Aucun service hors UE** dans la chaîne (pas de Google Analytics, pas de Mailchimp US, pas de Twilio US sans option EU). SMS provider à choisir parmi options conformes.
- Migration vers hébergeur marocain envisagée seulement en V3 si scaling et cadre juridique le justifient.

**Sécurité**

- Authentification par magic link uniquement (pas de mot de passe = pas de fuite de hash).
- Sessions 12 mois avec renouvellement transparent.
- Rôles : résident (par défaut) vs co-mod (3-4 admins). Pas de hiérarchie entre co-mods.
- **Soft-delete + journal d'audit** sur toutes les actions de modération (transparence radicale = lecture publique du journal).
- Recovery multi-canal (gestionnaire de mots de passe partagé entre co-mods, dépôt Git mirroré GitHub + GitLab/Codeberg, runbook écrit, contact technique de secours désigné avec SLA 24h).

**Accessibilité (WCAG AA)**

- Contraste minimum WCAG AA sur tous les écrans.
- Police de base ≥ 16px, possibilité de zoom navigateur natif sans casse.
- Cibles tactiles ≥ 48×48 px (recommandation Material).
- Toutes les actions accessibles au clavier.
- ARIA labels sur les éléments interactifs.
- **Critère d'acceptation** : Aïcha (72 ans, 1ʳᵉ génération mobile) exécute toute fonctionnalité du MVP en moins de 30 secondes sans aide. Validé empiriquement en bêta.

**Internationalisation (i18n) — bilingue FR/AR au MVP**

- Direction d'écriture mixte : **LTR (français) + RTL (arabe)**, géré au niveau du layout (CSS logical properties, `dir="rtl"` conditionnel).
- Tags artisans bilingues dans la base (champs traduisibles, structure ouverte pour Darija/Berbère en V1.5).
- Contenu éditorial du guide résident traduit FR + AR.
- Templates SMS (consentement artisan, magic link, validation admission) bilingues — choix utilisateur ou détection langue navigateur.
- Dates, nombres, devises localisés selon la langue active.

**Privacy-first measurements**

- **Compteurs côté serveur uniquement** (pas d'analytics utilisateur côté client : pas de Google Analytics, pas de Plausible, rien).
- Métriques agrégées : nombre villas inscrites, nombre artisans publiés, nombre actions de modération.
- Aucun tracking inter-pages, aucune session fingerprint.
- Logs serveur retenus 30 jours maximum (rétention minimale opérationnelle).

### Integration Requirements

**Posture explicite : aucune intégration externe au MVP** (cohérent avec la pureté horizontale).

| Système externe                                          | Statut                                               | Justification                                                                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WhatsApp**                                             | Cohabitation **non-API** via deep links partageables | Pas d'OAuth, pas d'API Meta. Chaque entité Darna a une URL canonique copiable dans WhatsApp. Lien profond ouvre l'app installée.                  |
| **Provider SMS** (magic link + consentement artisan)     | Intégration **transactionnelle** uniquement          | Provider à arbitrer (Twilio EU, MessageBird, ou solution locale MA conforme CNDP). Pas de templating marketing.                                   |
| **Provider e-mail** (magic link + notifications co-mods) | Intégration **transactionnelle** uniquement          | Service EU (ex. Postmark EU, Resend). Aucun e-mail marketing, opt-in strict pour notifications.                                                   |
| **Syndic**                                               | **Hors-scope MVP**                                   | Cohabitation respectueuse via remise du QR Darna dans le pack de bienvenue (pitch au mois 6 / 50 villas). Pas d'API, pas d'intégration technique. |
| **Analytics**                                            | **Hors-scope permanent**                             | Compteurs serveur uniquement. Aucun outil tiers.                                                                                                  |
| **Stockage fichiers** (photos artisans, avatars)         | Cloudflare R2 juridiction `eu`                       | Direct sur l'infra, pas un service externe au sens intégration.                                                                                   |

### Risk Mitigations (4 risques structurels)

| Risque                                                                 | Mitigation concrète                                                                                                                                                                                                                                                                   | Métrique de suivi                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **⚖️ Diffamation / e-réputation** d'un artisan suite à un avis négatif | Pseudonyme par défaut · droit de réponse · consentement préalable · contact juridique pré-identifié · runbook de retrait < 24h · journal public                                                                                                                                       | Zéro contentieux ouvert sur 12 mois                           |
| **🔋 Burnout des co-modérateurs** ou départ avant maturité             | Charge plafonnée ~2h/mois (à recalibrer après ajout file d'admission, cf. open-questions) · clause de sortie sans condition · recrutement co-mod #4 visé au mois 6 · ritual trimestriel léger                                                                                         | Au moins 3 co-mods actifs en continu sur les 12 premiers mois |
| **🚫 Pushback du syndic** percevant Darna comme un pouvoir parallèle   | Pureté horizontale revendiquée (Darna ne décide rien à la place du syndic) · cadrage explicite « offload de coordination, pas de prérogative » dès le 1er contact · engagement formel à ne porter aucune zone politique ou conflictuelle · pitch syndic différé au mois 6 / 50 villas | Aucun blocage formel du syndic sur 12 mois                    |
| **🪙 Déclin d'engagement** après la nouveauté (mois 6-12)              | Boucles d'usage ancrées dans des moments à forte intention (recherche d'artisan, arrivée nouveau voisin) · pré-amorçage annuaire · suivi qualitatif du **signal-clé** : _un voisin répond-il à une question WhatsApp par un lien Darna ?_                                             | Au moins 1 occurrence du signal-clé observable au mois 4-5    |

**Risques additionnels identifiés** (suite ajout file d'admission le 2026-05-07) :

- Friction d'admission qui décourage les inscriptions (≠ règle Aïcha zéro friction côté entrée). Mitigation : SLA admin ≤ 24h, UX d'attente claire.
- Surcharge admin si afflux d'inscriptions concentré (lancement, post-pré-amorçage, nouveaux arrivants). Mitigation : interface admin file d'attente avec actions atomiques + notifications push co-mods.

### Posture éthique & alignement institutionnel

Darna se revendique explicitement comme un **bien commun numérique** :

- Alignement **Maroc Digital 2030** (souveraineté numérique nationale)
- Alignement **Digital Public Goods Alliance (DPGA)** + **GovStack** (mouvement international des biens publics numériques)
- Anti-plateforme par construction : pas de captation de valeur, pas de lock-in, pas d'extractivisme
- Ouverture explicite à des **partenariats institutionnels non-extractifs** (ADD, CNDP en mode pédagogique, civic-tech locale comme Bluesquare / UM6P / Al Akhawayn, FNAI / fédérations syndics) — sans dépendance, en posture de bien commun

## Innovation & Novel Patterns

### Detected Innovation Areas

Darna n'invente aucune brique technique nouvelle. Toute son innovation est **conceptuelle** : un recadrage du problème + 5 choix de design qui, combinés, n'existent pas ailleurs sur ce segment.

#### Innovation 1 — Mémoire structurée vs canal de discussion

**Recadrage** : le problème n'est pas « créer un espace de partage » (les 4 groupes WhatsApp existent et fonctionnent) mais **« créer une mémoire structurée et chercheable de ce qui se partage déjà informellement »**.

**Pourquoi c'est nouveau** :

- WhatsApp Communities (Meta) reste basé sur le chat → reproduit l'oubli structurel
- BuildingLink/ADDA = SaaS top-down vendu au syndic, pas une mémoire horizontale
- Nextdoor = quartier ouvert, faiblement multilingue, ad-monetized

Aucun acteur ne traite la mémoire perdue comme **valeur centrale** pour communauté fermée.

**Validation** : signal-clé qualitatif au mois 4-5 — _un voisin répond-il à une question WhatsApp par un lien Darna (au lieu de retaper la réponse) ?_ Si OUI = recadrage validé.

**Fallback si l'hypothèse échoue** : pivoter vers un mode « bookmarklet WhatsApp » qui capture des messages WhatsApp dans Darna automatiquement (V2 si la friction de re-saisie tue l'adoption).

#### Innovation 2 — Cohabitation choisie avec WhatsApp via deep links

**Recadrage** : ne pas chercher à remplacer WhatsApp mais à **transformer WhatsApp en canal de viralité** via deep links partageables. Chaque entité Darna a une URL canonique copiable d'un tap.

**Pourquoi c'est nouveau** : tous les concurrents (BuildingLink, Nextdoor, Wesabi) proposent un effort d'arrachement vers leur plateforme. Darna est le seul à formaliser la **complémentarité** comme stratégie produit.

**Validation** : ratio de partages externes / contributions internes mesurable côté serveur. Cible MVP : ≥ 30% des contributions générant au moins 1 partage externe.

**Fallback** : si le partage WhatsApp ne décolle pas, ajouter un bouton « Partager dans le groupe WhatsApp Résidence » avec template pré-rédigé (V1.5).

#### Innovation 3 — Notation typée par compétences

**Recadrage** : remplacer les étoiles génériques par une **notation multi-axes** typée selon les types d'intervention attendus (Dépannage / Petits travaux / Travail soigné / Urgences).

**Pourquoi c'est nouveau** : aucune marketplace artisan MENA (Wesabi, Recommended.app, CityByApp) n'utilise ce format. Sur Darna, un artisan peut être 5/5 en Dépannage et 2/5 en Travail soigné — ce qui correspond à la réalité terrain.

**Couplé à 2 traits locaux Maroc** :

- Tags multilingues FR/AR (Darija/Berbère en V1.5) — multilinguisme natif vs UI traduite
- Mention « facture émise » oui/non/sur demande — trait fiscal local critique

**Validation** : feedback qualitatif des bêta-testeurs sur le format de notation (mock-ups testés en bêta 15-28 juin 2026).

**Fallback** : si la notation typée embrouille les utilisateurs (Aïcha en particulier), simplifier à note globale + tags compétences en V1.5.

#### Innovation 4 — Valeur dès le premier utilisateur

**Recadrage** : Darna est utile **même seul** (mémoire perso d'artisans, signets de codes portails, contacts utiles) → tue le cold start qui condamne 90% des apps communautaires.

**Pourquoi c'est nouveau** : tous les concurrents nécessitent une masse critique avant de servir leur premier utilisateur. Darna a un **MLP (Minimum Lovable Product)** au sens strict — l'annuaire pré-amorcé par les co-mods 14 jours avant le lancement public matérialise cette propriété.

**Validation** : usage observé même chez les co-mods avant ouverture publique (mois -1 à 0 du lancement).

#### Innovation 5 — Modération structurelle vs modération humaine

**Recadrage** : pour les zones à charge émotionnelle (politique, religion, conflits voisinage, surveillance), Darna **ne fournit pas l'espace**. Pas de « no man's land » à modérer humainement.

**Pourquoi c'est nouveau** : Nextdoor brûle des millions sur la modération humaine de ces zones. Darna les exclut **par construction du produit** — il n'y a rien à modérer car il n'y a pas de surface d'attaque.

**Validation** : zéro incident de modération sur ces zones sur 12 mois (mesurable trivialement = zéro signalement entrant).

#### Innovation 6 — Commun numérique open source MIT dès J1

**Recadrage** : Darna est publié en open source MIT **dès le premier jour**, pas après une phase commerciale. Voix éditoriale collective anonyme, transparence radicale (journal public modération), gouvernance distribuée à 3-4 admins volontaires.

**Pourquoi c'est nouveau** : aucune app de quartier (segment SaaS B2B ou marketplace) n'est open source. Darna se positionne explicitement comme bien commun numérique aligné DPGA / Maroc Digital 2030.

**Validation** : au moins 1 résidence voisine manifeste son intérêt à forker au mois 12 (critère du palier 12 mois).

**Risque** : faible adoption open source (pas de fork). Acceptable — l'open source sert d'abord la **transparence** et l'**anti-bus-factor**, pas la diffusion.

### Market Context & Competitive Landscape

| Segment concurrent            | Joueurs représentatifs                                              | Différence Darna                                                                                                | Vol marché (preuve d'opportunité)                                                    |
| ----------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **SaaS B2B syndic**           | BuildingLink (7 000+ communautés), ADDA (1.3M+ résidents), Buildium | Vendu au syndic, payant, top-down, English-first. Darna = horizontal habitants.                                 | Marché « résidence » existant, mais pas via canal habitants                          |
| **Réseaux sociaux quartier**  | Nextdoor, Closeby                                                   | Quartiers ouverts, ad-monetized, faible MENA, mono-lingue. Darna = communauté fermée 150 villas, MIT, bilingue. | Effet de proximité géographique fonctionne                                           |
| **Marketplace artisans MENA** | Wesabi, Recommended.app, CityByApp                                  | Lead-gen payant. Darna = confiance communautaire fermée, gratuit.                                               | Besoin d'annuaire artisan fiable confirmé MA, mais format marketplace n'y répond pas |
| **SaaS syndic MA**            | Syndic Connect, votresyndic.ma, ADALA                               | Outillage légal/financier syndic. Darna = couche horizontale habitants.                                         | Loi 18-00 (réforme 2025) crée attente de transparence — vent porteur                 |
| **Communauté chat**           | WhatsApp Communities (Meta)                                         | Reste chat = mémoire impossible. Darna = mémoire structurée.                                                    | Meta a vu le pb, n'a pas su le résoudre — validation par contraste                   |

**Risques de réplication par concurrents** :

- 🔴 **Meta peut shipper de la recherche structurée dans WhatsApp Communities** → erode wedge sur la mémoire chercheable. Mitigation : ouverture explicite à fédération inter-résidences (V3) — Meta ne fera jamais d'open source pour quartier.
- 🟡 **Syndic SaaS marocains peuvent bundler un module « app résident » top-down** → menace stratégique long terme. Mitigation : pureté horizontale revendiquée comme positionnement permanent (incompatible avec un module bundlé syndic).

### Validation Approach

**Innovation est validée par 4 mécanismes complémentaires** :

1. **Bêta privée 15-28 juin 2026** — 5 voisins représentatifs (1 Aïcha, 1 nouvel arrivant, 1 utilisateur WhatsApp intensif, 1 voisin proche du syndic, 1 sceptique). Test des innovations 1, 3, 4 (mémoire / notation typée / single-user value).
2. **Pré-amorçage 17-30 juin 2026** — 10-15 artisans seedés par les co-mods 14 jours avant ouverture publique. Test de l'innovation 4 (single-user value) chez les co-mods avant ouverture.
3. **Signal-clé qualitatif observable au mois 4-5** — _« lien Darna posté dans WhatsApp par un voisin »_. Test de l'innovation 1 (mémoire) et 2 (cohabitation WhatsApp).
4. **Observation longitudinale sur 12 mois** — paliers 15/75/100 villas + zéro incident CNDP majeur + manifestation d'intérêt d'une résidence voisine. Test de l'innovation 6 (commun numérique).

**Décision-trigger** : si au mois 6 le signal-clé n'est jamais observé ET que l'adoption est < 30 villas, **pivot conversation** à déclencher (re-cadrer le problème ou re-cibler les modules).

### Risk Mitigation (innovation-specific)

| Risque innovation                                                           | Probabilité | Impact                       | Mitigation                                                                                        |
| --------------------------------------------------------------------------- | ----------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Recadrage « mémoire vs chat » non-perçu par les utilisateurs (Innovation 1) | Moyenne     | Élevé — pivot nécessaire     | Pitch verbal centré « 5 sec pour trouver » testé en bêta + sondage M3 + signal-clé M4             |
| Notation typée trop complexe pour Aïcha (Innovation 3)                      | Faible      | Moyen — simplification V1.5  | Mock-ups testés en bêta avec Aïcha · fallback note globale + tags                                 |
| Cold start malgré pré-amorçage (Innovation 4)                               | Faible      | Élevé — risque structurel    | 15 artisans seedés + recrutement co-mods avant lancement + lancement ancré sur événement physique |
| Open source MIT non-perçu comme valeur par les voisins (Innovation 6)       | Élevée      | Faible — bénéfice secondaire | Open source sert d'abord la transparence et l'anti-bus-factor ; adoption fork = bonus V3          |
| Cohabitation WhatsApp ratée — utilisateurs ne partagent pas (Innovation 2)  | Moyenne     | Moyen — ajustement V1.5      | Bouton Partager de premier rang · template pré-rédigé Darna→WhatsApp si signal absent au M3       |

## Web App / PWA Specific Requirements

### Project-Type Overview

Darna est une **Progressive Web App (PWA) installable** mono-page (SPA), hybridée avec WhatsApp via deep linking. Pas d'application native iOS ou Android (rejet idéologique permanent : pas de stores, pas de validation tierce, pas de mises à jour à gérer pour l'utilisateur).

**Cycle d'usage type** (depuis Journey 1 — Yassine cherche un plombier) :

1. Lien WhatsApp tapé → ouverture du navigateur → détection app installée → bascule dans l'app (deep link)
2. OU ouverture directe depuis l'icône PWA sur l'écran d'accueil → cache offline servi instantanément → mise à jour silencieuse en arrière-plan
3. Action utilisateur (recherche, lecture, contribution) → synchronisation Supabase
4. Action de partage → URL canonique copiée → paste WhatsApp

### Technical Architecture Considerations

**Architecture frontend** : SPA (Single-Page Application) plutôt que MPA, pour offrir l'expérience d'app native attendue post-installation (transitions fluides, état préservé, offline en lecture). Framework PWA précis à arbitrer en architecture (Next.js vs Vite+React vs SvelteKit — décision à venir dans `bmad-create-architecture`).

**Service worker** : indispensable pour :

- Cache offline du référentiel artisans (lecture seule fonctionnelle sans réseau)
- Cache de l'app shell (rendu instantané au démarrage)
- Background sync (contributions postées hors-ligne re-tentées au retour réseau)
- Gestion des install prompts iOS/Android

**Deep linking** : chaque entité a une URL canonique `darna.org/{type}/{slug}` — partageable, copiable, ouvrant l'app installée si présente, sinon le navigateur. Format des slugs : court, lisible, multilingue (UTF-8 normalisé).

### Browser Matrix

**Cibles primaires** (≥ 90% du trafic attendu) :

| Navigateur         | Versions supportées | Justification                                                                                                                                             |
| ------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **iOS Safari**     | 15+                 | Profils Aïcha, Yassine, Nadia. Part de marché iOS Maroc ~25-30%. Compromis Safari = WebView WhatsApp iOS = friction install (page `/install` doit gérer). |
| **Android Chrome** | 95+                 | Part de marché Android Maroc ~70-75%. Install prompts natifs disponibles (Add to Home Screen propose via prompt).                                         |

**Cibles secondaires** (lecture publique / accès co-mods desktop) :

- **Firefox** (desktop + Android) — co-mods sur desktop pour modération
- **Edge** (desktop) — co-mods sur desktop pour modération
- **Samsung Internet** — part de marché Android non-négligeable

**Hors-scope** :

- IE11 (zéro effort)
- Opera Mini (mode compression incompatible PWA)
- Versions Safari < 15 / Chrome < 95 (~5% du marché, message « mettez à jour votre navigateur »)

### Responsive Design

**Mobile-first strict.** Le smartphone est le terminal dominant (≥ 95% du trafic attendu sur la résidence). Les ergonomies tablette et desktop sont des **fallbacks fonctionnels**, pas des cibles design optimisées.

**Breakpoints** :

- ≤ 480px (smartphones standards) — **cible primaire de design**, mise en page colonne unique
- 481-768px (smartphones larges, phablets, mode paysage) — colonne unique élargie
- 769-1024px (tablettes) — fallback, possibilité de 2 colonnes pour le module Modération
- ≥ 1025px (desktop) — fallback fonctionnel, utilisé essentiellement par les co-mods

**Cibles tactiles** : ≥ 48×48 px (Material) sur tous les éléments interactifs. Contrainte appliquée même sur desktop (cohérence + accessibilité).

**Pas de mode paysage spécifique** : layout colonne fonctionne en portrait et paysage sans adaptation majeure.

### Performance Targets

| Métrique                                 | Cible                                    | Justification                               |
| ---------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| **First Contentful Paint** (4G médian)   | < 1.5s                                   | Règle Aïcha — sentiment de réactivité       |
| **Largest Contentful Paint** (4G médian) | < 2.5s                                   | Web Vitals « Good »                         |
| **Time to Interactive** (4G médian)      | < 3.5s                                   | Action possible avant frustration           |
| **Cumulative Layout Shift**              | < 0.1                                    | Pas de saut de layout pendant le chargement |
| **Lighthouse PWA score**                 | ≥ 90                                     | Critère qualité PWA                         |
| **Lighthouse Accessibility score**       | ≥ 95                                     | Cohérent avec WCAG AA + règle Aïcha         |
| **Bundle JS initial**                    | < 150 KB gzippé                          | Réseau marocain mobile peut être lent       |
| **Cache offline**                        | 100% du référentiel artisans + app shell | Lecture fonctionnelle sans réseau           |
| **Disponibilité**                        | ≥ 99% sur 7h-23h locale                  | Pas de SLA formel, monitoring artisanal     |

**Tests perf** : Lighthouse CI dans le pipeline + tests manuels sur smartphone Android entrée de gamme (proxy pour Aïcha) + iPhone SE 2020 (proxy pour parc iOS résidence).

### SEO Strategy

**Approche binaire** — séparer ce qui est public de ce qui est communautaire :

**🌍 Pages publiques indexables** (canonical, sitemap.xml, meta description) :

- `/` — page d'accueil avec pitch + bouton install
- `/install` — page OS-aware d'installation
- `/manifesto` — posture commun numérique (open source, anti-plateforme)
- `/transparence` — journal public des actions de modération
- `/legal/mentions` — mentions légales
- `/legal/confidentialite` — politique de confidentialité
- `/legal/cgu` — conditions générales d'utilisation
- `/contact` — comment demander un retrait (contact CNDP)
- `/source` — lien vers le repo GitHub MIT

**🔒 Pages communautaires non-indexables** (`noindex, nofollow` + auth requise) :

- Annuaire artisans, fiches artisans, alertes, bons plans, numéros utiles, guide résident, pack accueil
- Tout contenu nominatif (artisan, contributeur)
- Profil utilisateur, paramètres, file de modération

**robots.txt** : deny global avec exceptions pour les routes publiques listées ci-dessus + sitemap.xml référencé.

**Meta tags spécifiques** :

- `<meta name="theme-color">` — couleur de marque (vert maghrébin à arbitrer en design)
- `<link rel="manifest">` — manifeste PWA pour install
- Open Graph minimal pour pages publiques (titre, description, image)
- Pas de Twitter Card (cohérent avec posture anti-plateforme)

**Internationalisation SEO** : `hreflang` FR/AR sur les pages publiques, URLs distinctes par langue (`/fr/`, `/ar/`) ou paramètre. Décision exacte à arbitrer en architecture.

### Real-time Requirements

**Posture** : real-time est utile mais **non-critique** pour Darna. Pas d'usage temps réel synchronisé entre utilisateurs (chat, présence, etc. — tout cela est rejet permanent).

**Cas d'usage temps réel limités** :

1. **Alertes éphémères** (cf. brief module 🚨) — réception push notif sur abonnés opt-in dans les minutes suivant la publication. Mécanisme : Web Push (PWA) + service worker.
2. **Notifications co-mods** (file d'admission, signalement de contenu) — Supabase Realtime peut être utilisé, ou simple polling à l'ouverture de l'onglet Modération. À arbitrer en architecture selon la consommation réseau.
3. **Confirmation de consentement artisan** (Journey 4) — notification au contributeur quand l'artisan a validé. Push notif opt-in.
4. **Validation d'admission** (Journey 3) — notification e-mail (pas push) à Salma quand un co-mod a validé. Pas de besoin temps réel.

**Hors temps réel** :

- Annuaire (lecture, recherche, filtres) — données pas critiques en synchro temps réel
- Notation, commentaires — synchro à la prochaine consultation suffit
- Guide, pack accueil — contenu quasi-statique

**Décision technique** : Supabase Realtime utilisé pour les notifications co-mods uniquement. Web Push API pour les notifications push utilisateur. Pas de WebSocket persistant côté client.

### Accessibility Level (WCAG AA + Règle Aïcha)

Cf. section _Domain-Specific Requirements > Technical Constraints > Accessibilité_ pour le détail.

**Synthèse PWA-spécifique** :

- **Skip-to-main-content** au focus initial du document
- **Focus visible** sur tous les éléments interactifs (outline 2px contrasté)
- **Navigation clavier complète** sur toutes les actions (validation co-mod sans souris)
- **Lecteurs d'écran** testés avec VoiceOver iOS (Aïcha potentiellement) et TalkBack Android
- **Contraste AA min** 4.5:1 sur texte normal, 3:1 sur grands textes
- **Pas de capture clavier** (Escape ferme toujours les modales)
- **Annonces ARIA live** sur les changements asynchrones (validation admission, notification reçue)
- **Mouvement réduit** respecté (`prefers-reduced-motion: reduce` désactive transitions)
- **Mode sombre** non-obligatoire au MVP — couplé à `prefers-color-scheme` si implémenté en V1.5

### Implementation Considerations

**Choix de framework PWA — à arbitrer en architecture (`bmad-create-architecture`)**

| Option                          | Pour                                                                                 | Contre                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **Next.js 14+ (App Router)**    | Écosystème Vercel natif, SSR/SSG pour SEO pages publiques, API routes intégrées, RSC | Bundle plus lourd, complexité courbe d'apprentissage si solo dev         |
| **Vite + React + React Router** | Bundle minimal, PWA Vite plugin éprouvé, simplicité                                  | SSR demande effort additionnel pour SEO pages publiques                  |
| **SvelteKit**                   | Performance PWA top, bundle ~50% plus petit, DX excellente                           | Communauté plus restreinte, moins de templates open source réutilisables |

**Recommandation préliminaire (à valider en architecture)** : **Next.js 14+ (App Router)** — meilleur compromis SSR/SEO + PWA + intégration Vercel + écosystème mature pour solo dev.

**Outils PWA** :

- Workbox (ou plugin équivalent du framework) pour service worker robuste
- Manifeste web standard (icônes, theme color, display: standalone)
- Web Push API + provider (peut-être OneSignal EU, ou implémentation directe)

**Tests PWA** :

- Lighthouse CI dans le pipeline GitHub Actions
- Tests manuels d'installation sur iPhone (Safari) et smartphone Android (Chrome)
- Test de cache offline (mode avion)
- Test de mise à jour service worker (deux releases consécutives)
- Test du deep linking depuis WhatsApp WebView (iOS in-app browser cas critique)

**Compatibilité Safari iOS — point de friction documenté** :

- Pas d'install prompt automatique (Safari) → page `/install` avec instructions step-by-step
- Web Push iOS Safari nécessite iOS 16.4+ et PWA installée — fallback notification e-mail pour iOS < 16.4
- Service worker scope : limité au domaine, pas de partage cross-origin

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**Type de MVP retenu : Problem-Solving MVP** (pas Experience MVP, pas Platform MVP, pas Revenue MVP).

**Pourquoi** : Darna résout un problème spécifique (la mémoire perdue des artisans dans les WhatsApp) plutôt que d'offrir une expérience riche ou une plateforme extensible. La règle d'or : _« le MVP doit suffire pour qu'un voisin trouve un plombier en 5 secondes »_. Tout ce qui ne contribue pas directement à cette promesse est différé.

**MLP (Minimum Lovable Product), pas juste MVP** : la valeur dès le premier utilisateur (Innovation 4) est une exigence non-négociable. L'annuaire pré-amorcé par les co-mods 14 jours avant l'ouverture publique matérialise cette propriété. **Le jour du lancement, Darna est utile, pas juste fonctionnel.**

**Approche de validation** : pas de pivot avant le mois 6. Les paliers d'adoption sont des **boussoles, pas des KPIs de pilotage** (cf. Success Criteria). Le signal-clé qualitatif au mois 4-5 est le seul mécanisme de pivot trigger.

### Resource Requirements

**Équipe MVP** (cadrage 6 mai → bêta 28 juin → lancement début juillet 2026) :

| Rôle                             | Personne                                                | Engagement                                              | Période                          |
| -------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- | -------------------------------- |
| **Product / fondateur**          | Stephane                                                | Temps personnel élastique                               | 6 mai → ∞                        |
| **Co-modérateurs**               | 2-3 voisins volontaires (à recruter avant 31 mai)       | ~2-3h/mois (à recalibrer après ajout admission)         | À partir du pré-amorçage 17 juin |
| **Développement build**          | À déterminer (probable solo Stephane assisté agents IA) | Effort concentré sur 4 semaines (18 mai-14 juin) + bêta | 18 mai → 14 juin                 |
| **Contact technique de secours** | Voisin/ami à désigner                                   | Astreinte SLA 24h, anti-bus-factor                      | Avant lancement bêta             |
| **Contact juridique de recours** | Avocat/notaire à pré-identifier                         | Conseil ponctuel, premier contentieux potentiel         | Avant lancement public           |

**Compétences requises (build)** : Next.js / React, PostgreSQL/Supabase, Tailwind ou équivalent, Workbox (service worker), i18n (FR/AR + RTL), accessibilité WCAG. Pas de besoin DevOps avancé (Vercel + Supabase = managé).

**Coûts financiers** :

- ~0 € à 15 €/mois en MVP (free tiers)
- ~30-50 €/mois à 100 villas
- Coûts initiaux (domaine ~12 €/an, SMS éventuels) assumés personnellement par Stephane jusqu'à transition associative à 100 villas / 100 €/an cumulés

### Phased Roadmap Strategy

Cf. section _Product Scope_ (step-03) pour la liste détaillée des fonctionnalités par phase. Récapitulatif stratégique :

| Phase                                             | Objectif stratégique                                                                                     | Trigger de passage                                                                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **MVP V1** (cible début juillet 2026)             | Prouver que l'annuaire d'artisans noté + le pack accueil + le guide résident résolvent la mémoire perdue | Bêta 5 voisins (15-28 juin) validée + zéro incident bêta majeur                                                                  |
| **V1.5** (été-automne 2026, hors chemin critique) | Élargir l'i18n (Darija + Berbère) + préparer la réplicabilité (doc fork) + outiller les co-mods          | Lancement V1 stabilisé (≥ 1 mois sans incident technique majeur)                                                                 |
| **V2** (fin 2026 / début 2027, conditionnel)      | Étendre par couches sociales (ados, parents, syndic optionnel) si la traction le justifie                | ≥ 75 villas inscrites (palier 6 mois atteint) + ≥ 2 demandes spontanées de modules                                               |
| **V3** (2027+, vision)                            | Fédération inter-résidences + architecture multi-tenant activée                                          | 100 villas + 6 mois stable + zéro incident CNDP majeur + 1 résidence voisine intéressée + procédure fork écrite + 1 étude de cas |

**Décisions de scope explicites prises pendant le PRD** (cf. open-questions résolues) :

- ✅ Admission par validation manuelle admin (décision 2026-05-07) — ajouté au MVP malgré la friction (consolidation paradigme communauté fermée).
- ✅ Pseudonyme par défaut + opt-in identité — décision 2026-05-05, conservé.
- ✅ Modération préventive sur l'admission, réactive sur le contenu — découle de la décision 2026-05-07.

**Décisions de scope explicites différées au-delà du MVP** :

- 🔵 Module ados / parents — V2 (parking diplomatique, demande utilisateur attendue)
- 🔵 Annonces officielles syndic — V2 (uniquement si demande explicite syndic)
- 🔵 Compte famille étendue (fille d'Aïcha hors résidence) — V2
- 🔵 Tableau de bord co-mods avec analytics qualitatives — V1.5

### Risk Mitigation Strategy

#### Technical Risks

| Risque                                                                                | Probabilité | Impact                                 | Mitigation MVP                                                                                                                                           |
| ------------------------------------------------------------------------------------- | ----------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Compatibilité PWA Safari iOS** (in-app WhatsApp WebView, pas d'install prompt auto) | Élevée      | Élevé — perte adoption iOS             | Page `/install` OS-aware avec captures step-by-step + redirection « ouvrir dans Safari » détectée. Test prioritaire en bêta avec un utilisateur iOS.     |
| **Workflow consentement artisan asynchrone** (taux de conversion SMS magic link)      | Moyenne     | Moyen — fiches en attente non publiées | Pré-amorçage 17-30 juin par les co-mods qui contactent les artisans en personne d'abord (taux conversion ~95%). Workflow public à roder progressivement. |
| **Performance Lighthouse PWA ≥ 90 sur Android entrée de gamme**                       | Faible      | Moyen — déception perf chez Aïcha      | Tests perf hebdomadaires sur appareil de référence Android entrée de gamme · Lighthouse CI dans pipeline.                                                |
| **i18n RTL/LTR mixte (FR + AR)**                                                      | Moyenne     | Faible — bugs visuels limités          | Utilisation CSS logical properties dès le début · review systématique des écrans en mode AR pendant le build.                                            |

**Compétence-risque solo dev** : si Stephane est seul sur le build, le bus factor pendant 4 semaines est un risque structurel. Mitigation : contact technique de secours désigné AVANT lancement bêta (cf. open-questions urgent).

#### Market Risks

| Risque                                                                                                               | Probabilité | Impact                                     | Mitigation                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Adoption < 15 villas à 3 mois** (palier minimal)                                                                   | Moyenne     | Faible — palier déjà adouci, douleur tiède | Pas de panique avant le mois 6. Pivot conversation seulement si signal-clé absent au mois 4-5 ET adoption < 30 villas au mois 6.        |
| **Aucun voisin ne répond à une question WhatsApp par un lien Darna avant le mois 6** (signal-clé qualitatif négatif) | Moyenne     | Élevé — recadrage produit                  | Fallback documenté en Innovation : ajouter un bouton « Partager dans le groupe WhatsApp Résidence » avec template pré-rédigé en V1.5.   |
| **Pushback du syndic**                                                                                               | Faible      | Moyen                                      | Pitch syndic différé au mois 6 / 50 villas. Posture « offload de coordination » documentée dès le 1er contact.                          |
| **Burnout co-mods** (charge admission sous-estimée)                                                                  | Élevée      | Élevé — perte de continuité                | Recalibrer la charge co-mod au mois 1 (post-pré-amorçage). Recruter co-mod #4 visé au mois 6. Clause de sortie sans condition garantie. |

#### Resource Risks

| Risque                                                               | Probabilité | Impact                                | Mitigation                                                                                                                                                                        |
| -------------------------------------------------------------------- | ----------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ressources dev plus restreintes que prévu** (Stephane temps perso) | Moyenne     | Élevé — glissement calendrier         | Lancement ancré sur événement physique commun = flexibilité de la date (fête de quartier, AG syndic, rentrée scolaire). Si glissement → cible septembre 2026 au lieu de juillet.  |
| **Coûts financiers explosent au-delà de 15 €/mois en MVP**           | Faible      | Faible — Stephane porte               | Free tiers Vercel + Supabase + R2 dimensionnés pour ~150 utilisateurs. Provider SMS = poste variable surveillé.                                                                   |
| **Bus factor sur l'unique dev** (maladie, indisponibilité)           | Moyenne     | Élevé — projet bloqué                 | Contact technique de secours désigné AVANT lancement bêta. Repo open source MIT mirroré GitHub + GitLab/Codeberg. Runbook écrit.                                                  |
| **Co-mods déclinent ou se désistent avant lancement**                | Faible      | Élevé — pureté horizontale compromise | Stephane confirme avoir 1-2 personnes en tête dès maintenant. Pitch verbal en personne d'ici fin mai. Profils diversifiés (1 bâtisseur + 1 pragmatique) maximisent la robustesse. |

## Functional Requirements

> **Capability Contract** : tout ce qui n'est pas listé ici n'existera pas dans le produit final. UX, architecture et epics se reposeront exclusivement sur cette liste.
>
> **Acteurs canoniques** : `Résident` (inscrit et validé) · `Demandeur` (en attente d'admission) · `Co-mod` (résident avec rôle modérateur) · `Artisan` (entité externe sans compte permanent, interagit via SMS magic link) · `Visiteur public` (non authentifié, accède aux pages publiques) · `Système` (Darna lui-même).

### Admission & Authentication

- **FR1** : Un `Visiteur public` peut consulter les pages publiques (accueil, install, manifesto, transparence, légales) sans s'authentifier.
- **FR2** : Un `Visiteur public` peut soumettre une demande d'inscription en fournissant numéro de villa, tranche, prénom et e-mail OU numéro de téléphone (au choix).
- **FR3** : Un `Demandeur` reçoit un magic link sur le canal choisi (e-mail ou SMS) à des fins de vérification de propriété de l'identifiant.
- **FR4** : Un `Demandeur` qui clique sur le magic link voit son identifiant vérifié et passe à l'état « en file d'attente ».
- **FR5** : Un `Demandeur` peut consulter l'état de sa demande (en attente / acceptée / rejetée) avec une indication de SLA.
- **FR6** : Un `Co-mod` peut consulter la file d'attente d'admission avec les informations soumises (villa, tranche, prénom).
- **FR7** : Un `Co-mod` peut accepter ou rejeter une demande d'admission ; le rejet exige un motif sélectionné dans une liste fermée.
- **FR8** : Un `Demandeur` est notifié de la décision (acceptation ou rejet motivé) sur son canal d'inscription.
- **FR9** : Un `Résident` accepté dispose d'une session valide 12 mois renouvelée silencieusement à chaque accès actif.
- **FR10** : Un `Résident` peut se déconnecter explicitement de son appareil, et de tous ses appareils en bloc.
- **FR11** : Un `Résident` peut demander la suppression de son compte ; le `Système` exécute la suppression et la purge des données associées sous 7 jours, avec cascade sur les contributions selon les règles RGPD.

### Annuaire d'artisans

- **FR12** : Un `Résident` peut consulter l'annuaire d'artisans avec recherche full-text et filtres rapides (catégorie de compétence, prix relatif, indicateur facture, note).
- **FR13** : Un `Résident` peut consulter une fiche artisan détaillée affichant identité, compétences, notation typée multi-axes, prix relatif, indicateur facture, commentaires (pseudonymisés ou nominatifs selon le choix de chaque contributeur).
- **FR14** : Un `Résident` peut déclencher un appel téléphonique vers un artisan depuis sa fiche.
- **FR15** : Un `Résident` peut créer une fiche artisan en fournissant nom, téléphone, compétences (≥1 cochée), prix relatif, indicateur facture, et un commentaire optionnel.
- **FR16** : Un `Résident` peut publier sa contribution en pseudonyme (par défaut) ou en identité visible (opt-in mémorisé sur son profil).
- **FR17** : Le `Système` envoie un SMS magic link à l'artisan référencé pour solliciter son consentement avant publication.
- **FR18** : Un `Artisan` ouvre le SMS magic link, voit comment sa fiche apparaîtra et peut accepter ou refuser la publication en un tap, sans création de compte permanent.
- **FR19** : Un `Résident` est notifié quand l'artisan a consenti et que sa contribution est publiée.
- **FR20** : Un `Résident` peut noter un artisan déjà publié sur les axes typés (Dépannage / Petits travaux / Travail soigné / Urgences), sur une échelle 1-5 par axe coché, et ajouter un commentaire optionnel.
- **FR21** : Un `Résident` peut éditer ou retirer ses propres contributions (fiche, note, commentaire) à tout moment.
- **FR22** : Un `Artisan` peut, via un canal de droit de réponse opérationnel, demander la rectification d'informations ou publier une réponse à un avis le concernant.

### Modules de contenu durable

- **FR23** : Un `Résident` peut consulter le **Guide résident** structuré en FAQ, organisé en thèmes, avec recherche, et chaque entrée individuellement deep-linkable.
- **FR24** : Un `Résident` peut consulter les **Numéros utiles** en accès rapide (poste de garde, syndic, urgences, pharmacie de quartier, autres contacts définis par les co-mods).
- **FR25** : Un nouveau `Résident` accède automatiquement à un **Pack accueil nouveaux arrivants** comme contenu mis en avant lors de son premier login post-validation.
- **FR26** : Un `Co-mod` peut créer, éditer et retirer des entrées dans le Guide résident, les Numéros utiles et le Pack accueil.

### Modules de contenu éphémère

- **FR27** : Un `Résident` peut publier une **alerte éphémère** à partir d'un modèle pré-rédigé (coupure d'eau, désinsectisation, chien perdu, etc.) en un tap.
- **FR28** : Une alerte éphémère **expire automatiquement** selon une durée définie au moment de la publication (ex. 24h, 72h, 7 jours).
- **FR29** : Un `Résident` peut publier un **bon plan** typé et expirable (offre voisin, prêt d'objet, etc.) avec date d'expiration explicite.
- **FR30** : Un `Résident` peut consulter la liste des alertes actives et des bons plans non expirés, triés par fraîcheur.

### Modération & Transparence

- **FR31** : Un `Résident` peut signaler tout contenu (fiche artisan, commentaire, alerte, bon plan) avec une raison sélectionnée dans une liste fermée.
- **FR32** : Un `Co-mod` peut retirer un contenu signalé, motiver le retrait, et notifier l'auteur du retrait sous 24h max.
- **FR33** : Le `Système` enregistre toutes les actions de modération (retraits, validations d'admission, rejets, motifs) dans un **journal public d'actions** consultable par tout `Visiteur public`.
- **FR34** : Le `Système` applique le **soft-delete** (pas de suppression destructive) sur les actions de modération, permettant la traçabilité et l'audit CNDP.
- **FR35** : Un `Co-mod` peut déclencher un escalade vers le contact juridique de recours via un workflow guidé (préparation d'un dossier de contexte avec liens journal).

### Partage & Cohabitation WhatsApp

- **FR36** : Chaque entité (artisan, alerte, bon plan, page guide, page numéros utiles) dispose d'une **URL canonique** courte, lisible, et stable.
- **FR37** : Un `Résident` peut copier l'URL canonique d'une entité vers le presse-papier en un tap (sans modal intermédiaire).
- **FR38** : Un `Résident` ouvrant une URL canonique depuis WhatsApp ou tout navigateur arrive directement sur l'entité ciblée (deep linking).
- **FR39** : Un `Visiteur public` ouvrant une URL canonique communautaire est invité à s'inscrire ou se connecter avec contexte préservé (post-login, atterrit sur l'entité).

### Notifications

- **FR40** : Un `Résident` peut activer ou désactiver indépendamment 3 catégories de notifications opt-in : (a) alertes urgentes coupures/sécurité, (b) nouvelles entrées annuaire dans les 7 derniers jours, (c) activité sur ses contributions (avis posté, consentement artisan reçu, retrait).
- **FR41** : Le `Système` délivre les notifications utilisateur via Web Push (PWA installée) avec fallback e-mail si Web Push indisponible (iOS < 16.4 par exemple).
- **FR42** : Un `Co-mod` reçoit une notification automatique (e-mail + Web Push si installé) sur tout événement de modération nécessitant son intervention (admission demandée, contenu signalé).
- **FR43** : Le `Système` n'envoie aucun e-mail marketing ; toutes les communications sont transactionnelles ou opt-in strict.

### Engagement & Feedback léger

- **FR43b** : Un `Résident` peut « aimer » (👍) un commentaire d'avis, une alerte ou un bon plan en un tap, sans modal intermédiaire. Le compteur agrégé est public ; pas de bouton 👎 au MVP (rejet explicite — toxicité).
- **FR43c** : Un `Résident` peut soumettre une **suggestion d'évolution produit** via un formulaire libre accessible depuis ses paramètres. Les suggestions sont lues uniquement par les co-mods (pas de débat public, pas de vote, pas de classement) et alimentent les revues trimestrielles de roadmap.

### PWA, i18n & Accessibilité

- **FR44** : Un `Visiteur public` peut accéder à une page `/install` qui détecte son OS et son navigateur, et lui présente des instructions d'installation step-by-step adaptées (iOS Safari, Android Chrome, autres en fallback).
- **FR45** : Un `Résident` peut utiliser Darna en mode lecture entièrement hors-ligne (annuaire artisans, guide résident, pack accueil, numéros utiles) après l'avoir consulté au moins une fois en ligne.
- **FR46** : Un `Résident` peut basculer la langue de l'interface entre **français (LTR)** et **arabe (RTL)** depuis ses paramètres ; le choix est mémorisé sur son profil.
- **FR47** : Le `Système` propose une langue par défaut au `Visiteur public` selon l'en-tête `Accept-Language` du navigateur, FR si indéterminé.
- **FR48** : Le `Système` affiche le contenu éditorial (guide résident, pack accueil) dans la langue active, avec fallback explicite vers FR si traduction absente.
- **FR49** : Un `Résident` peut consulter et utiliser toutes les fonctionnalités du MVP au clavier seul (navigation focus + actions clavier sur tous les contrôles).
- **FR50** : Le `Système` respecte la préférence `prefers-reduced-motion` du navigateur en désactivant transitions et animations non-essentielles.

### Données opérationnelles & Conformité

- **FR51** : Le `Système` expose des compteurs publics agrégés (nombre de villas inscrites, nombre d'artisans publiés, nombre d'actions de modération) accessibles depuis la page `/transparence`.
- **FR52** : Le `Système` ne capture, ne stocke et ne transmet aucune donnée comportementale utilisateur côté client (ni via Google Analytics, ni via toute autre solution analytics).
- **FR53** : Un `Résident` peut consulter et exporter ses propres données personnelles (export RGPD : profil + contributions) au format JSON.
- **FR54** : Un `Co-mod` peut exporter le journal public de modération sur une période définie (audit CNDP).
- **FR55** : Le `Système` purge automatiquement les logs serveur après 30 jours de rétention.

## Non-Functional Requirements

### Performance

- **NFR1** : Le **First Contentful Paint** mesuré en 4G médian Maroc reste < 1.5s (mesuré via Lighthouse CI, p75).
- **NFR2** : Le **Largest Contentful Paint** reste < 2.5s en 4G médian.
- **NFR3** : Le **Time to Interactive** reste < 3.5s en 4G médian.
- **NFR4** : Le **Cumulative Layout Shift** reste < 0.1 sur toutes les pages.
- **NFR5** : Le score **Lighthouse PWA** atteint ≥ 90 sur la page d'accueil et l'annuaire.
- **NFR6** : Le bundle JavaScript initial reste < 150 KB gzippé après tree-shaking et code-splitting.
- **NFR7** : Une recherche dans l'annuaire (full-text + filtres) renvoie ses résultats en < 300ms p95 sur le quantile médian de 150 utilisateurs.
- **NFR8** : Une consultation de fiche artisan déjà en cache rend en < 100ms (lecture offline).
- **NFR9** : Test de performance hebdomadaire sur smartphone Android entrée de gamme (proxy Aïcha) — pas de régression > 20% acceptée entre 2 releases consécutives.

### Security & Privacy

- **NFR10** : Toute communication client-serveur transite en **TLS 1.3** (HTTPS strict, HSTS activé).
- **NFR11** : L'authentification est exclusivement par **magic link** (e-mail ou SMS, choix utilisateur). Aucun mécanisme de mot de passe n'existe dans le système.
- **NFR12** : Les magic links expirent dans les **15 minutes** suivant leur émission et ne sont utilisables qu'une seule fois.
- **NFR13** : Les sessions utilisateur sont valides 12 mois, renouvelées silencieusement à chaque accès, et invalidables explicitement par le résident (déconnexion appareil ou tous appareils).
- **NFR14** : Toute donnée personnelle (profil, contributions) est stockée uniquement dans la juridiction UE (Supabase `eu-central-1`, Cloudflare R2 `eu`).
- **NFR15** : Aucun service hors-UE n'est utilisé dans la chaîne de traitement (pas de Google Analytics, pas de Mailchimp US, pas de Twilio US — provider SMS et e-mail conformes UE/CNDP uniquement).
- **NFR16** : Aucun cookie tiers, aucun tracker comportemental, aucune empreinte navigateur n'est posé sur le client (par construction — pas de bandeau cookies à afficher).
- **NFR17** : Le `Système` applique le **soft-delete** sur toutes les actions de modération avec horodatage et acteur tracé, conformément aux obligations CNDP d'audit.
- **NFR18** : Une demande d'effacement de compte est exécutée sous **7 jours maximum**, avec cascade sur les contributions selon les règles RGPD/CNDP.
- **NFR19** : Les données nominatives en transit (e-mails de notif, SMS magic link) sont chiffrées via le canal du provider.
- **NFR20** : Les logs serveur sont retenus **30 jours maximum** et purgés automatiquement.
- **NFR21** : Les rôles et permissions sont vérifiés **côté serveur** sur chaque requête sensible (pas seulement côté client).

### Scalability

- **NFR22** : Le MVP supporte **150 utilisateurs simultanés** (cible résidence) sans dégradation perceptible des temps de réponse (p95 < 500ms sur les pages courantes).
- **NFR23** : Le coût d'infrastructure reste ≤ **15 €/mois** au stade MVP (free tiers Vercel + Supabase + R2 dimensionnés pour 150 utilisateurs actifs).
- **NFR24** : Le coût d'infrastructure reste ≤ **50 €/mois** à 100 villas inscrites avec usage normal.
- **NFR25** : Le modèle de données est **« résidence »-paramétrable dès le MVP** (foreign key sur `residence_id` activable), permettant la transition V3 multi-tenant sans refactor majeur.
- **NFR26** : Le `Système` peut absorber un afflux ponctuel de 10 inscriptions/heure sans dégradation (lancement, post-événement physique, rentrée nouveaux arrivants) — Supabase Auth dimensionné pour ce volume au free tier.

### Reliability & Availability

- **NFR27** : Le `Système` est disponible ≥ **99% sur les heures de présence** des résidents (~7h-23h locale Maroc, GMT+1).
- **NFR28** : Aucun SLA formel 24/7 n'est garanti — la disponibilité hors heures de présence est best-effort.
- **NFR29** : Le code source est **hébergé sur GitHub (origin) + mirroré sur GitLab ou Codeberg** dans les 24h suivant chaque commit (anti-bus-factor structurel).
- **NFR30** : Un **runbook écrit** documente les procédures de recovery (perte de domaine, perte d'accès Supabase, indisponibilité Vercel, retrait de l'initiateur). Mis à jour à chaque changement structurel.
- **NFR31** : Un **gestionnaire de mots de passe partagé** entre co-mods + initiateur stocke les credentials critiques (Supabase admin, Vercel, R2, registrar). Rotation à chaque départ d'un co-mod.
- **NFR32** : Un **contact technique de secours** est nominativement désigné avec SLA 24h, avant le lancement bêta.
- **NFR33** : Les sauvegardes Supabase sont activées (snapshot quotidien retenu 7 jours minimum) — fonctionnalité native du free tier suffisante.

### Accessibility

- **NFR34** : Toutes les pages publiques et les écrans MVP atteignent le score **Lighthouse Accessibility ≥ 95**.
- **NFR35** : Le contraste texte/fond est **≥ 4.5:1** sur texte normal (WCAG AA) et ≥ 3:1 sur grands textes.
- **NFR36** : Les cibles tactiles sont **≥ 48×48 px** sur tous les éléments interactifs (recommandation Material).
- **NFR37** : Toutes les fonctionnalités MVP sont opérables au **clavier seul** (focus visible, pas de capture, ordre logique, Escape ferme les modales).
- **NFR38** : Les éléments interactifs disposent de **labels ARIA appropriés** et sont annoncés par les lecteurs d'écran (testé avec VoiceOver iOS et TalkBack Android sur 5 parcours critiques minimum).
- **NFR39** : La préférence `prefers-reduced-motion: reduce` est respectée — transitions et animations non-essentielles désactivées si demandé.
- **NFR40** : **Critère ergonomique non-négociable** : Aïcha (72 ans, 1ʳᵉ génération mobile) exécute toute fonctionnalité du MVP en **moins de 30 secondes sans aide**, validé empiriquement par observation directe en bêta (15-28 juin 2026) sur ≥ 5 parcours.
- **NFR40b** : **Principe « Geste = WhatsApp »** — l'ergonomie de Darna copie les patterns familiers de WhatsApp (compose-action-envoyer, partage natif via copie-presse-papier, pas de double-validation, gestes tactiles standards) afin que toute personne familière de WhatsApp soit immédiatement opérationnelle sur Darna sans onboarding obligatoire. Critère de validation : un utilisateur WhatsApp intensif accomplit Journeys 1, 4 et 5 en bêta sans tutoriel ni question.

### Internationalization

- **NFR41** : L'interface supporte **français (LTR)** et **arabe (RTL)** au lancement MVP, avec bascule depuis les paramètres utilisateur.
- **NFR42** : Le contenu éditorial du Guide résident, du Pack accueil et des Numéros utiles est disponible en FR et AR au lancement.
- **NFR43** : Les tags artisans sont des entités **bilingues structurées** (FR + AR au MVP, structure ouverte pour Darija et Berbère en V1.5).
- **NFR44** : Les templates SMS et e-mail (magic link, consentement artisan, validation admission) sont disponibles en FR et AR avec sélection automatique selon la langue active de l'utilisateur, fallback FR.
- **NFR45** : La direction d'écriture (LTR/RTL) est gérée via **CSS logical properties** et `dir="rtl"` conditionnel sur `<html>` — pas de feuille de style dupliquée.
- **NFR46** : Les dates, nombres et devises sont localisés selon la langue active (Intl API navigateur).
- **NFR47** : Aucune chaîne hardcodée dans le code — toutes les chaînes UI passent par un système i18n unique (clé → traduction).

### Maintainability & Open Source

- **NFR48** : Le code source est publié en **licence MIT** sur un dépôt GitHub public dès le premier jour du build (pas de phase commerciale préalable).
- **NFR49** : Un **README en FR et EN** documente la mission du projet, le stack, les instructions d'installation locale, et les modalités de contribution.
- **NFR50** : Le code respecte un **linter et un formatter** standards (ex. ESLint + Prettier ou équivalent) configurés dans le pipeline CI.
- **NFR51** : La couverture de tests automatisés sur les flux critiques (admission, création fiche artisan, modération, notation, droit d'effacement) atteint un seuil **« suffisant pour ne pas régresser »** (cible empirique, pas de pourcentage formel imposé au MVP — calibré en bêta).
- **NFR52** : Le pipeline **GitHub Actions** exécute lint + tests + Lighthouse CI sur chaque pull request.
- **NFR53** : Une **documentation de fork** structurée sera produite en V1.5 (hors chemin critique MVP) pour permettre à une autre résidence d'adapter le projet sans solliciter l'équipe d'origine.
- **NFR54** : La structure des dossiers et la convention de nommage suivent les **standards de la communauté du framework retenu** (Next.js / Vite+React / SvelteKit selon archi) — pas de structure ad-hoc.
- **NFR55** : Toute modification structurelle (schéma BDD, ajout d'une route, changement d'auth) est documentée via un **ADR (Architecture Decision Record)** court dans `docs/adr/`.

## Traceability

Chaîne de traçabilité Vision → Success Criteria → User Journeys → FRs → NFRs. Garantit que chaque exigence est ancrée dans un besoin utilisateur et que rien n'est implémenté gratuitement.

### Vision → Success Criteria → Innovation pillars

| Vision                                      | Success criterion ancrant                                                            | Innovation pillar associée                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Mémoire collective de la résidence          | « 5 secondes pour trouver » (User Success #1) · 15 villas/M3 · 75 villas/M6          | Innovation 1 — Mémoire structurée                                       |
| Cohabitation choisie avec WhatsApp          | « Tiens, je vais regarder sur Darna » (User Success #2) · signal-clé qualitatif M4-5 | Innovation 2 — Cohabitation via deep links                              |
| Pureté horizontale habitants-pour-habitants | Auto-suffisance modération à 12 mois                                                 | Innovation 5 — Modération structurelle · Innovation 6 — Open source MIT |
| Valeur dès le premier utilisateur           | Annuaire pré-amorcé 17-30 juin · usage observé chez co-mods avant ouverture          | Innovation 4 — Single-user value                                        |
| Notation différenciée par compétence        | Format notation typée validé en bêta · 30+ artisans notés à M6                       | Innovation 3 — Notation typée                                           |

### User Journeys → Functional Requirements

| Journey                                               | Capacités révélées                                                              | FRs couvrants                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------- |
| **Journey 1** — Yassine cherche un plombier           | Recherche annuaire, fiche structurée, action appel, notation rapide             | FR12, FR13, FR14, FR20           |
| **Journey 2** — Aïcha cherche le code du portail      | Guide résident, accessibilité forte, lecture publique partielle                 | FR23, FR1, FR46-FR50 (i18n+a11y) |
| **Journey 3** — Karim & Salma emménagent              | Page /install OS-aware, admission async, onboarding, pack accueil               | FR2-FR5, FR8, FR25, FR44         |
| **Journey 4** — Nadia poste une fiche artisan         | Création fiche, consentement artisan async, pseudonyme par défaut, notification | FR15-FR19, FR21                  |
| **Journey 5** — Co-mod traite admission + signalement | Interface modération, file admission, signalement, retrait, journal public      | FR6-FR8, FR31-FR35, FR42         |

### Functional Requirements → Non-Functional Requirements

Chaque famille de FRs hérite de NFRs transverses garantissant sa qualité opérationnelle.

| Famille FR                                     | NFRs gouvernant la qualité                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| Admission & Authentication (FR1-FR11)          | NFR10-NFR13 (security/auth), NFR21 (rôles serveur), NFR18 (effacement < 7j)       |
| Annuaire d'artisans (FR12-FR22)                | NFR1-NFR8 (perf), NFR7 (recherche < 300ms), NFR8 (cache offline < 100ms)          |
| Modération & Transparence (FR31-FR35)          | NFR17 (soft-delete + audit), NFR21 (vérif rôles), NFR54 (export CNDP)             |
| Partage & WhatsApp (FR36-FR39)                 | NFR1-NFR6 (perf), NFR54 (URL canoniques stables)                                  |
| Notifications (FR40-FR43)                      | NFR41-NFR44 (Web Push + e-mail i18n)                                              |
| Engagement léger 👍 / Suggestion (FR43b-FR43c) | NFR40 (règle Aïcha 30s)                                                           |
| PWA, i18n, A11y (FR44-FR50)                    | NFR1-NFR9 (perf), NFR34-NFR40 (a11y), NFR40b (geste WhatsApp), NFR41-NFR47 (i18n) |
| Données & Conformité (FR51-FR55)               | NFR14-NFR21 (security/privacy), NFR48-NFR55 (open source)                         |

### Coverage Audit

- ✅ Tous les modules MVP (7 fonctionnalités cœur du Product Scope) sont couverts par au moins 1 FR
- ✅ Tous les besoins de conformité Domain sont couverts par au moins 1 NFR Security & Privacy
- ✅ Tous les piliers d'innovation ont au moins 1 critère de validation mesurable défini dans Success Criteria ou Innovation
- ✅ Tous les Journeys cartographient des FRs implémentables
- ✅ Toutes les décisions structurantes du vault `decisions.md` (admission validation manuelle 2026-05-07, pseudonyme par défaut, hébergement UE, MIT J1, etc.) sont reflétées dans le PRD
- ⚠️ Open-questions urgentes restantes (vault `open-questions.md`) : à arbitrer en architecture (`bmad-create-architecture`) — achat effectif de `darna.org` (TLD tranché 2026-05-10), framework PWA à choisir, provider SMS, contact technique de secours, contact juridique de recours
