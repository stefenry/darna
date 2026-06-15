---
title: 'Product Brief Distillate : Darna (SmartResidence)'
type: llm-distillate
source: 'product-brief-SmartResidence.md'
sources_consolidated:
  - 'design-artifacts/A-Product-Brief/product-brief-SmartResidence.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-05-05-1442.md'
  - 'Web research synthesis (2026-05-05)'
  - 'Multi-lens review panel (skeptic, opportunity, GTM)'
created: 2026-05-05
purpose: 'Token-efficient context for downstream PRD, architecture, and UX work'
---

# Detail Pack — Darna (SmartResidence)

> **Comment lire ce document** : il complète le brief exécutif avec la matière brute capturée pendant la découverte. Chaque bullet est conçu pour être compréhensible sans avoir le brief en contexte. Organisé par thème, pas chronologiquement. Source de vérité pour les décisions PRD à venir.

---

## 1. 🎯 Décisions structurantes (verrouillées)

- **Nom du produit** : **Darna** (دارنا — « notre maison » en darija/arabe). Domaine cible : `darna.org` (à acquérir, ~12 €/an, registrar UE).
- **Phrase-pitch officielle** : _« La mémoire collective de votre résidence — ce que vos voisins savent, enfin retrouvable. »_ Direction MÉMOIRE retenue contre direction ANNUAIRE et direction WHATSAPP++.
- **Voix éditoriale** : collective et anonyme — _« un groupe de voisins de la résidence »_. Pas d'auteur nommé dans le brief ni les communications publiques. (Le fondateur réel est Stephane Henry, identité à révéler en personne lors du recrutement des co-mods, jamais dans les artefacts.)
- **Audience double du brief** : (B) recrutement de 2-3 co-modérateurs voisins + (C) pitch syndic et résidences voisines à terme. Pas de cible commerciale, pas d'investisseur.
- **Format de livrable retenu** : un brief exécutif unique (pas de carton A5 séparé). Le pitch verbal court sera fait par Stephane lui-même via WhatsApp / café — pas besoin d'artefact dédié.
- **Identité dans les avis artisans** : **pseudonyme par défaut, identité visible sur opt-in**. Choix issu d'un arbitrage explicite contre (α) identité visible obligatoire et (γ) hybride 5★/<5★. Motivation : éviter l'autocensure des avis négatifs dans une résidence de 150 villas où tout le monde se connaît, sans renoncer au social proof local.
- **Modèle de gouvernance long terme** : **open source MIT dès J1** (option γ retenue contre β associative et α informelle). Transition vers structure associative légère déclenchée à 100 villas inscrites OU 100 €/an de coûts cumulés.
- **Hébergement** : 100 % UE (Francfort) — Supabase `eu-central-1`, Vercel `fra1`, Cloudflare R2 juridiction `eu`, registrar européen. Conforme CNDP via liste pays à protection adéquate (Loi 09-08 art. 43).
- **Calendrier final** : Cadrage 6→15 mai · Build 18 mai→14 juin (buffer Eid al-Adha ~27 mai) · Bêta 15→28 juin · Pré-amorçage 17→30 juin · Lancement début juillet 2026.

---

## 2. 🩹 Le problème — analyse profonde

- **« Mémoire perdue des WhatsApp »** : 4-5 groupes WhatsApp coexistent déjà sur la résidence. Le partage existe ; ce qui manque, c'est la **structure et la chercheabilité**. La recommandation d'un plombier en mars est introuvable en septembre. C'est l'insight central, recadrant tout le reste.
- **La résidence est une mosaïque, pas un bloc** : au moins 3 sous-communautés naturelles (par genre, par statut, par autorité). Conséquence : ne pas forcer un canal unique. Mutualiser uniquement l'information référentielle ; respecter les espaces sociaux existants.
- **Onboarding récurrent et structurel** : l'existence d'un groupe WhatsApp « Arrivants dernière tranche » prouve que l'arrivée d'un nouvel habitant est un événement répété, déstabilisant pour lui et fatigant pour la communauté. **Porte d'entrée naturelle** pour Darna.
- **4 types d'information distincts** que WhatsApp mélange et fait pourrir ensemble :
  - **(A) Référentielle durable** — artisans, codes, horaires (cœur Darna)
  - **(B) Éphémère** — alertes ponctuelles, désinsectisation (alertes auto-expirantes Darna)
  - **(C) P2P** — chat perdu, perceuse à prêter (bons plans Darna)
  - **(D) Régulation sociale** — bruit, conflits → **HORS-SCOPE EXPLICITE** (modération structurelle : pas d'espace fourni, pas de no man's land)
- **Périmètre élargi à l'info locale** : bouchons autoroute, météo, événements ville pertinents pour V2+. Couplé au scaling V3 : alertes ville mutualisables entre résidences voisines.
- **Douleur tiède, pas brûlante** : personne n'est en souffrance active. Implication forte : **adoption par CONFORT, pas par soulagement de douleur**. Pitch = « 5 secondes pour trouver », pas « fini la galère ». Conséquence GTM : prévoir une adoption lente, ne pas paniquer si seulement 15 villas à 3 mois.
- **Aucun champion, aucun précédent** : personne n'a jamais tenu de fichier Excel des artisans. Implication produit : l'app doit s'**auto-organiser sans rôles d'admin imposés**.
- **Cohabitation respectueuse avec le syndic** : le syndic a déjà son canal WhatsApp 100 % descendant. Pas de remplacement, juste cohabitation. Darna = canal **horizontal collaboratif**.
- **Village fermé connu = paradigme de confiance par défaut** : 150 villas, voisins identifiables. Pas de KYC, pas de validation préventive. **Modération réactive uniquement**.
- **Validation terrain** : Stephane a parlé du problème à plusieurs voisins informellement au printemps 2026. Diagnostic confirmé, pas testé formellement. Si besoin de durcir, prévoir 5 micro-conversations supplémentaires avant lancement bêta.

---

## 3. 👥 Personas (6 archétypes terrain)

| Code   | Nom                       | Profil                                | Rôle dans la conception                                                                                                |
| ------ | ------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **P1** | **Aïcha, 72 ans**         | Voisine âgée, 1ʳᵉ génération mobile   | **Standard ergonomique non-négociable** — règle Aïcha : si elle ne s'en sort pas en 30 secondes, l'interface est ratée |
| **P2** | **Karim & Salma, 30 ans** | Jeune couple emménagé récemment       | Onboarding incarné — pack accueil pensé pour eux                                                                       |
| **P3** | **Yassine, 38 ans**       | Cadre pressé, parent, télétravailleur | Efficacité brute — recherche rapide, deep links, copy-paste WhatsApp en un tap                                         |
| **P4** | **Ali Ouameur, 65 ans**   | Président réel du syndic              | Pivot d'autorité — décisions concernant la cohabitation Darna/syndic à arbitrer en pensant à lui                       |
| **P5** | **Nadia, 35 ans**         | Maman solo récemment installée        | Test ultime de confiance — modération, vie privée, sentiment de sécurité                                               |
| **P6** | **Mohamed, gardien**      | Hub humain illettré                   | **Exclu du MVP** — révèle la pureté horizontale par contraste. Pas de fonctionnalité « relais gardien » au V1          |

**Profils des 5 bêta-testeurs à recruter** (entre 15 et 28 juin 2026) : 1 Aïcha · 1 nouvel arrivant · 1 utilisateur WhatsApp intensif · 1 voisin proche du syndic · 1 sceptique. La diversité prime sur l'amitié — il faut tester la friction, pas la complaisance.

---

## 4. 🚫 Idées rejetées (NE PAS RE-PROPOSER)

| Idée                                                                                                                                        | Raison du rejet                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Application native iOS / Android**                                                                                                        | Stores = friction d'install, validation, mises à jour pénibles. PWA = format choisi.                                      |
| **Monétisation, abonnement, freemium**                                                                                                      | Hors scope idéologique. Compromettrait la pureté communautaire et la défendabilité face syndic.                           |
| **Anonymat total des contributeurs**                                                                                                        | Tué le social proof local. Pseudonyme par défaut + opt-in identité = compromis retenu.                                    |
| **Gamification, classements publics, badges utilisateurs**                                                                                  | Détourne la motivation intrinsèque. Provoque des dérives sociales.                                                        |
| **Vues / statistiques / métriques publiques**                                                                                               | Choix idéologique : Darna n'est pas un outil de visibilité personnelle.                                                   |
| **Présence sociale (qui est en ligne, vu à, lu par)**                                                                                       | Pression sociale qui ruine la simplicité.                                                                                 |
| **Notifications par défaut**                                                                                                                | Tout est opt-in strict. 3 catégories maximum, débrayables individuellement.                                               |
| **Mot de passe**                                                                                                                            | Magic link uniquement (e-mail OU SMS au choix). Session 12 mois.                                                          |
| **Menu hamburger**                                                                                                                          | Banni. Tout doit tenir en 3 tuiles + 1 niveau de profondeur max.                                                          |
| **Zone de discussion (chat, fil de commentaires longs)**                                                                                    | Contenu ≠ Conversation. On poste, on ne discute pas.                                                                      |
| **Espace politique / religieux / régulation conflits voisinage**                                                                            | Hors-scope **structurel** : l'app ne fournit pas l'espace. Pas de modération à faire car pas de territoire.               |
| **Intégration du syndic au MVP**                                                                                                            | V2 si demande. MVP = pure horizontalité.                                                                                  |
| **Intégration du gardien / poste de garde au MVP**                                                                                          | Mohamed (gardien réel) est illettré → l'inclure briserait la pureté horizontale. V2+ via relais volontaires si pertinent. |
| **Logique marketplace pour les artisans**                                                                                                   | Wesabi, Recommended.app font ça. Confiance communautaire ≠ lead-gen.                                                      |
| **Tracking comportemental, profilage, analytics intrusifs**                                                                                 | Conformité CNDP + posture commun numérique. Pas de Google Analytics, etc.                                                 |
| **Couvoiturage structuré au MVP**                                                                                                           | V2+ si demande. Trop spécifique pour le MVP.                                                                              |
| **Multi-résidences au MVP**                                                                                                                 | V3 strict. Critères de réplicabilité explicites avant de pitcher.                                                         |
| **Anti-dérive sécuritaire** : pas de fonctionnalité de surveillance, signalement de personnes suspectes, registre des entrées/sorties, etc. | Refus explicite et permanent.                                                                                             |
| **Bouton 👎 (dislike)**                                                                                                                     | Débat ouvert (cf. open questions). Tendance actuelle = ne pas l'inclure pour éviter la toxicité.                          |

---

## 5. 🛠️ Indices techniques pour le PRD et l'architecture

### Stack confirmée (économie zéro coût marginal)

- **Frontend** : PWA (probablement React + Vite ou Next.js, à arbitrer dans l'architecture). Service worker pour install + cache offline lecture.
- **Backend / DB / Auth** : Supabase (Postgres + Auth + Storage + Realtime), région `eu-central-1` (Francfort).
- **Hébergement frontend** : Vercel, fonctions serverless en `fra1`.
- **Stockage fichiers** (photos d'artisans, logos, avatars éventuels) : Cloudflare R2, juridiction `eu`.
- **SMS magic link** : provider à choisir (Twilio, MessageBird, ou solution locale marocaine — vérifier conformité CNDP). Indispensable pour Aïcha et profils non-email.
- **Domaine** : `darna.org` à acheter, registrar européen (OVH, Gandi, ou Porkbun).

### Auth

- Magic link par e-mail OU SMS (choix utilisateur)
- Session 12 mois, renouvellement transparent
- Aucune autorisation système au lancement (pas de demande de notif, pas de localisation, pas de contacts)
- Inscription minimaliste : numéro de villa + tranche + prénom (rien d'autre)

### Architecture de données (suggestions à valider en archi)

- Modèle « résidence » paramétrable dès le MVP même si une seule résidence active — préparer V3 multi-résidences sans refactor majeur
- Soft-delete + journal d'audit pour les actions de modération (transparence radicale = journal public)
- Champs multilingues prévus pour les tags artisans (FR/AR au MVP, structure ouverte pour Darija/Berbère en V1.5)
- Deep links partageables sur chaque entité (artisan, alerte, bon plan, page guide) — URL canonique + slug court

### UX architecture

- **Écran d'accueil = 3 tuiles : Annuaire / Alertes / Guide**
- Bons plans, numéros utiles, pack accueil = accessibles à 1 tap (depuis Guide ou barre supérieure)
- Recherche en TOP de l'écran annuaire, filtres rapides par catégorie de compétence
- Bouton « Partager » de premier rang (visible à côté du tél), un tap = lien copié dans le presse-papier (pas de modal)
- 👍 = action sociale minimale viable (1 tap, friction zéro), 👎 = à débattre

### Notifications

- 3 catégories opt-in strict (à définir précisément ; suggestions : alertes urgentes / nouvelles entrées annuaire / activité communautaire)
- Web Push uniquement (PWA), aucun SMS push, aucun e-mail marketing

### Page `/install` OS-aware

- Détection navigateur (Safari iOS, Chrome Android, autres)
- Captures d'écran et instructions step-by-step pour iOS « Add to Home Screen » (point de friction documenté)
- Redirection « ouvrir dans Safari » depuis le navigateur in-app WhatsApp pour iOS

### Open source

- Licence MIT
- Repo public sur GitHub dès J1
- Repo mirroré sur 2ᵉ plateforme (GitLab ou Codeberg) — anti-bus-factor
- README en FR + EN
- Documentation de fork structurée (à écrire pour V3, pas critique au MVP)

---

## 6. ⚖️ Conformité CNDP / Loi 09-08 — checklist opérationnelle

- ✅ Hébergement UE exclusif (Francfort) — conforme art. 43 (pays à protection adéquate)
- ✅ Consentement explicite des artisans **avant** publication d'une fiche (workflow opérationnel à définir : qui contacte ? via quel canal ? template SMS/WhatsApp ?)
- ✅ Droit de réponse opérationnel pour les artisans notés (interface dédiée, notification de nouvelle note ?)
- ✅ Droit d'effacement < 7 jours (compte + données associées + cascade sur contributions ?)
- ✅ Pseudonyme par défaut sur les avis (cf. décision §1)
- ✅ Modération réactive < 24 h sur contenu manifestement abusif/diffamatoire (procédure écrite à finaliser)
- ✅ Pas de profilage, pas d'analytics intrusifs
- ✅ Pas de catégorie politique/religieuse/conflits voisinage (modération **structurelle**)
- ✅ Mentions légales + politique de confidentialité publiées avant lancement (templates à rédiger)
- ✅ Identification du responsable de traitement (initiateur Stephane jusqu'à V2 asso)
- ⚠️ DPIA (Data Protection Impact Assessment) recommandée — à évaluer si CNDP l'exigerait pour ce volume
- ⚠️ Contact juridique de recours **pré-identifié** (avocat/notaire) avant le premier contentieux
- ⚠️ Page publique « comment demander un retrait » avec e-mail dédié

---

## 7. 🛡️ Garde-fous structurels (12 issus du Reverse Brainstorming)

Issus de l'analyse des 12 modes de sabotage potentiels. Catégories : adoption sans friction · continuité long terme · qualité d'expérience · conformité légale.

- **Anti-friction d'adoption** : zéro autorisation système au lancement, magic link sans mdp, geste copié de WhatsApp, lecture publique sans login (contribution privée)
- **Continuité long terme** : recovery multi-canal (mdp partagés, Git mirroré, runbook), recrutement co-mod #4 visé au mois 6, ritual trimestriel léger
- **Qualité d'expérience** : motivation intrinsèque (pas de gamification), zéro métriques publiques, transparence radicale (journal public modération)
- **Conformité légale** : RGPD/CNDP by design, mentions légales claires, statut juridique explicite

---

## 8. 🌐 Intelligence concurrentielle (à reconnaître pour ne pas reproduire)

| Joueur                                    | Modèle                                                                                | Ce qu'on évite                                                  | Ce qu'on apprend                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **BuildingLink, ADDA, Buildium**          | SaaS B2B vendu aux syndics, 7 000+ communautés (BuildingLink), 1.3M+ résidents (ADDA) | Top-down, payant, app store, English-first                      | Le marché « résidence » existe et a du volume — mais pas via le canal habitants                                             |
| **Nextdoor / Closeby**                    | Réseau social de quartier ouvert                                                      | Quartiers ouverts, ad-monetized, faible MENA, pas multilingue   | L'effet de proximité géographique fonctionne                                                                                |
| **Syndic Connect, votresyndic.ma, ADALA** | SaaS marocains côté syndic, alignés Loi 18-00                                         | Outillage légal/financier, pas couche horizontale               | Loi 18-00 (réforme 2025 — comptes trimestriels obligatoires) crée une attente de transparence côté résidents — vent porteur |
| **Wesabi, Recommended.app, CityByApp**    | Marketplaces artisans MENA                                                            | Lead-gen, annonces payantes, pas confiance communautaire fermée | Le besoin d'annuaire artisan fiable est confirmé au Maroc — mais le format marketplace n'y répond pas                       |
| **WhatsApp Communities (Meta)**           | Pinned messages, sub-groups, announcement channels                                    | Reste basé chat = mémoire impossible                            | Meta a vu le problème, n'a pas su le résoudre — validation par contraste                                                    |

**Risque de réplication par concurrents** :

- Meta peut shipper de la recherche structurée dans Communities → erode wedge sur la mémoire chercheable
- Syndic SaaS marocains peuvent bundler un module « app résident » top-down → menace stratégique long terme

---

## 9. 🌱 Effets de réseau et boucles de viralité (sous-exploités à l'avenir)

- **Cohabitation WhatsApp = canal viralité** : chaque deep link partagé dans WhatsApp est une impression Darna gratuite
- **Onboarding flywheel** : chaque nouvel habitant = activation garantie via le pack accueil (à négocier avec syndic pour insertion dans dossier de bienvenue)
- **Boucle artisan-side (V2+)** : badge public partageable « recommandé par mes voisins de [résidence] » que l'artisan peut afficher sur sa carte de visite ou ses devis → distribution par les artisans eux-mêmes
- **Trust graph cross-résidences (V3)** : ratings d'artisans partagés entre Darnas fédérés tout en préservant la vie privée locale → effet de réseau qui compose à chaque nouvelle résidence

---

## 10. 🎚️ Périmètre — In / Out / Maybe par version

### MVP (V1, début juillet 2026)

- ✅ Annuaire artisans (notation typée, FR/AR, prix relatif, facture)
- ✅ Alertes éphémères avec modèles
- ✅ Bons plans typés expirables
- ✅ Numéros utiles
- ✅ Guide résident (FAQ deep-linkable)
- ✅ Pack accueil nouveaux arrivants
- ✅ Inscription magic link e-mail OU SMS
- ✅ Deep links partageables WhatsApp
- ✅ Page /install OS-aware
- ✅ Annuaire pré-amorcé (10-15 artisans)
- ✅ CNDP/RGPD opérationnel
- ✅ Co-modération + journal public + règle d'escalade

### V1.5 (priorité haute, hors chemin critique build)

- 🟡 Tags Darija + Berbère (ajout post-MVP)
- 🟡 Documentation de fork pour réplicabilité
- 🟡 Tableau de bord interne pour co-mods (suivi qualitatif)

### V2 (si traction)

- 🟠 Espace ados (organisation matchs, activités) — parking diplomatique
- 🟠 Espace parents
- 🟠 Annonces officielles syndic (si demande)
- 🟠 Co-modération recrutée avant lancement (pour autres résidences qui forkent)
- 🟠 Badge artisan partageable
- 🟠 Transition asso loi 1901 (ou équivalent marocain)
- 🟠 Compte famille étendue (la fille d'Aïcha hors résidence)

### V3 (réplication multi-résidences)

- 🔵 Architecture multi-tenant activée
- 🔵 Trust graph cross-résidences
- 🔵 Alertes ville mutualisables
- 🔵 Migration possible vers hébergeur marocain
- 🔵 Critères pré-requis : 100 villas + 6 mois stable + zéro incident CNDP + procédure fork écrite + 1 étude de cas

### Hors-scope permanent

- ❌ Toute logique politique, religieuse, ou de régulation des conflits voisinage
- ❌ Toute fonctionnalité de surveillance/signalement de personnes
- ❌ Toute monétisation / publicité / freemium
- ❌ Tout indicateur de visibilité publique des contributeurs
- ❌ Toute présence sociale en ligne

---

## 11. ❓ Questions ouvertes à arbitrer en PRD ou en archi

1. **Domaine `darna.org`** : à vérifier disponible et acheter rapidement (avant le 15 mai idéalement, pour le cadrage)
2. **Bouton 👎** : à inclure ou pas ? Tendance = non (toxicité). Mais à trancher explicitement avec règle.
3. **Modèle de notification précis** : quelles 3 catégories exactement ? Suggestions à arbitrer : (a) alertes urgentes coupures/sécurité (b) nouvelles entrées annuaire dans les 7 derniers jours (c) activité sur mes contributions (réponse à un avis, etc.)
4. **Provider SMS** : Twilio, MessageBird, ou solution locale marocaine ? Coûts variables, conformité CNDP à vérifier
5. **Workflow de consentement artisan** : qui contacte les artisans pour obtenir leur consentement avant publication ? Via quel canal (SMS, WhatsApp, papier) ? Quel taux de conversion attendre ? Quoi faire des fiches sans consentement (cachées ? anonymisées ? pas créées) ?
6. **Identité technique du contact de secours** (SLA 24 h) : à désigner nominativement avant lancement bêta
7. **Cardholder pour les coûts initiaux** : Stephane confirme qu'il porte personnellement jusqu'à transition asso ? Engagement écrit ?
8. **Format exact de la « note typée par compétence »** : checkboxes (dépannage / petits travaux / travail soigné / urgences) avec note 1-5 par axe coché ? Ou note globale + tags compétences ? À tester avec mock-ups en bêta.
9. **Échelle de prix relative ($→$$$$)** : 4 niveaux ? Référentiel relatif à quoi (résidence ? pays ?) ? À cadrer en UX scenarios.
10. **Pages légales** : qui rédige (avocat ? template open source adapté ?) et avant quelle date ?
11. **Stratégie de mesure compatible avec privacy-first** : comment tracker le palier 15 villas / 30 villas / 75 villas sans analytics intrusifs ? Compteur côté serveur uniquement, agrégé ? Sondage co-mod hebdomadaire ?
12. **Choix de framework PWA précis** : Next.js (familier, écosystème Vercel) vs Vite + React (plus léger) vs SvelteKit (plus performant pour PWA) — à arbitrer en architecture
13. **Stratégie de démo à AG du syndic** : si le lancement glisse à la rentrée septembre, faut-il caler sur l'AG du syndic (date à connaître) ?
14. **Présence vs absence d'avatar utilisateur** : photo de profil = humanité, mais aussi pression sociale et risque vie privée. À trancher.

---

## 12. 📊 Métriques de pilotage compatibles avec privacy-first

Compteurs côté serveur uniquement (pas d'analytics utilisateur côté client) :

- Nombre de villas inscrites (1 villa = 1 inscription validée)
- Nombre d'artisans publiés (avec consentement)
- Nombre de notes/avis postés (cumulatif)
- Nombre d'alertes émises (cumulatif)
- Nombre de partages externes (lien copié, bouton partage activé)
- Nombre d'actions de modération (transparent journal public)

**Sondage qualitatif** : 1 sondage trimestriel de 5 questions max envoyé via Darna lui-même (notification opt-in « Vos retours »). Première vague visée à 3 mois post-lancement.

**Signal-clé qualitatif unique à observer** : un voisin répond-il à une question WhatsApp par un lien Darna (au lieu de retaper la réponse) ? Si OUI dès le mois 4-5 = adoption profonde. Si NON au mois 6 = pivot conversation à déclencher.

---

## 13. 🤝 Stratégie de recrutement co-mods (cible B)

- **Brief n'est PAS le vecteur de recrutement** — c'est un follow-up. Le recrutement se fait en personne par Stephane.
- **Pitch verbal cible 30 secondes** (à élaborer par Stephane, pas dans le brief) : _« On lance Darna pour que les voisins arrêtent de chercher 10 fois le même plombier. On cherche 2-3 personnes pour valider ponctuellement les nouvelles fiches. C'est ~2h par mois, jamais d'urgence, tu peux arrêter quand tu veux. Tu lirais un brief plus détaillé si je te l'envoie ? »_
- **Suite au pitch verbal accepté** : envoi du brief PDF par WhatsApp, café/réunion confirmation 1 semaine plus tard.
- **Profils à mixer** : 1 « bâtisseur communautaire » (lien social, pré-retraite ou actif passionné) + 1 « pragmatique investi » (cadre 35-50 ans, déjà actif WhatsApp). Géeks bienvenus en V2 quand on aura besoin de fork-helpers.
- **Stephane confirme avoir 1-2 personnes en tête**, les autres suivront. Pas de stress sur ce point.

---

## 14. 🎤 Stratégie de pitch syndic (cible C, déclenchement mois 6)

- **Trigger explicite** : 50 villas inscrites OU mois 6 atteint, le premier déclenche.
- **Demande unique et minimale** : insérer un QR Darna dans le pack de bienvenue remis aux nouveaux acquéreurs. Pas de demande financière, pas d'intégration technique, pas de gouvernance partagée.
- **Argumentaire principal** : Darna offloade la coordination horizontale qui ne relève pas du mandat syndic + mémoire qui survit aux rotations de mandat.
- **Argumentaire défensif** : conformité CNDP démontrée par les 6 mois d'exploitation sans incident, hébergement UE, code open source auditable, statut juridique clarifié.
- **Posture** : pas demandeur, pas frondeur. Mode « voici ce qu'on fait, voici comment on peut être complémentaire, vous décidez ».

---

## 15. 🌍 Posture « commun numérique » (différenciation idéologique)

- Alignement explicite revendiqué avec **Maroc Digital 2030** (souveraineté numérique nationale)
- Alignement avec le mouvement international des **biens publics numériques** (Digital Public Goods Alliance, GovStack)
- **Anti-plateforme par construction** : pas de captation de valeur, pas d'effet lock-in, pas d'extractivisme
- Ouvre la porte à des **partenariats institutionnels** (ADD — Agence du Développement du Digital ; CNDP en mode pédagogique ; civic tech locale comme Bluesquare, UM6P, Al Akhawayn ; FNAI / fédérations syndics) — sans dépendance, en posture de bien commun

---

_Distillat généré le 5 mai 2026 à partir du brief exécutif, du brainstorming initial, de la veille web, et des revues sceptique / opportunités / GTM. À utiliser comme contexte d'entrée pour `bmad-create-prd`, `bmad-create-architecture`, `wds-1-project-brief`, et tout autre skill downstream du pipeline SmartResidence._
