---
title: 'Product Brief : Darna (دارنا)'
project: SmartResidence
status: complete
created: 2026-05-05
updated: 2026-05-05
audiences:
  - co-moderators (residents to recruit)
  - syndic / neighboring residences (future pitch)
inputs:
  - _bmad-output/brainstorming/brainstorming-session-2026-05-05-1442.md
voice: collective_anonymous
---

# Product Brief : **Darna** (دارنا)

> _« La mémoire collective de votre résidence — ce que vos voisins savent, enfin retrouvable. »_

---

## 📜 Résumé exécutif

**Darna** est une application web communautaire (PWA) pensée pour les habitants de notre résidence — 150 villas, des centaines de personnes, et **quatre groupes WhatsApp où l'information vit, circule, puis disparaît**. Notre quotidien est rempli de questions auxquelles un voisin a déjà répondu il y a six mois : _« Quel plombier appeler ? Le code du portail ? Qui a un avis sur l'électricien venu chez les Untel ? »_ Le savoir existe ; il n'est simplement pas retrouvable.

Darna résout ce problème par une approche radicalement simple : **transformer la mémoire dispersée des conversations WhatsApp en un référentiel structuré, chercheable, et partageable** — sans remplacer WhatsApp, en cohabitant avec lui via des liens directs. **Aucun magasin d'applications, aucun abonnement, aucune publicité.** Le projet est porté collectivement par un petit groupe de voisins, hébergé en Europe, conforme à la CNDP, et publié en **open source** dès le premier jour pour garantir sa pérennité indépendamment de ses initiateurs.

Au cœur de l'application : un **annuaire de prestataires noté par les voisins eux-mêmes**, avec une notation typée par compétences (dépannage, petits travaux, travail soigné), des tags bilingues français/arabe au lancement (darija et berbère ajoutés rapidement après), une échelle de prix relative, et la mention « facture émise » — un trait local qui change tout. Autour de ce cœur, six modules complémentaires forment un MVP que nous visons à mettre entre les mains de la résidence début juillet 2026.

Au-delà de son utilité immédiate, **Darna se revendique comme un commun numérique de quartier** — anti-plateforme par construction, aligné avec les principes de souveraineté numérique portés par Maroc Digital 2030 et le mouvement international des biens publics numériques (DPGA). C'est cette posture qui rend le projet réplicable sans franchise et défendable face aux logiques extractives qui dominent le secteur.

---

## 🩹 Le problème

Sur la résidence, l'information pratique circule **sans mémoire** :

- **WhatsApp est devenu le fond de commerce communautaire**, mais reste un fil qui défile : la recommandation d'un bon plombier postée en mars est introuvable en septembre.
- **Quatre groupes coexistent** (général, arrivants, parents, etc.) sans hiérarchie claire, et chaque arrivée d'un nouvel habitant déclenche les mêmes questions répétées.
- **Personne n'a tenu de « fichier Excel des artisans »** — non par manque de bonne volonté, mais parce que le format est inadapté : pas multi-contributeur, pas multilingue, pas partageable d'un tap.
- **Le syndic** dispose de son propre canal descendant, mais n'a ni vocation ni légitimité à animer l'horizontalité entre habitants.
- **Le coût du statu quo est faible mais constant** : du temps perdu, des artisans médiocres rappelés faute de mémoire, des nouveaux arrivants désorientés, et un ciment communautaire qui s'effrite à mesure que les anciens se lassent de répondre aux mêmes questions.

Ce n'est pas une douleur brûlante — personne n'en souffre activement. C'est une **douleur tiède**, dont chacun s'est habitué à payer le prix. C'est précisément pour cela qu'aucune solution n'a émergé spontanément, et c'est exactement la fenêtre que Darna comble.

> 💬 _Ce diagnostic se confirme dans les conversations informelles menées avec plusieurs voisins au printemps 2026 : la même mémoire perdue, les mêmes questions reposées, le même constat tranquille que « ce serait bien si quelqu'un faisait quelque chose »._

---

## 💡 La solution

Darna est une **application web installable depuis une URL** — pas de magasin, pas de téléchargement, pas de mise à jour à gérer. On scanne un QR code distribué sur la résidence, on s'inscrit en 15 secondes (numéro de villa + tranche + prénom + un lien magique par SMS ou e-mail au choix), et on a accès à :

🔧 **L'annuaire des artisans** — le cœur du produit. Chaque entrée est créée par un voisin qui a vécu l'expérience, notée par compétence (dépannage / petits travaux / travail soigné / urgences), assortie d'une fourchette de prix relative ($ → $$$$), de la mention « facture émise », et d'un commentaire facultatif. **Pseudonyme par défaut, identité visible sur opt-in** : ce choix protège les voisins qui veulent partager une critique honnête sans risquer la friction sociale ou juridique d'un nom propre dans une résidence de 150 villas, tout en laissant ceux qui assument leur recommandation valoriser leur réputation locale.

🚨 **Les alertes éphémères** — coupure d'eau, désinsectisation, chien perdu : des messages auto-expirants qui ne polluent pas la mémoire long terme, avec des modèles pré-rédigés (un tap = une alerte propre).

💰 **Les bons plans** — une rubrique typée et expirable, sans dérive Le-Bon-Coin.

📞 **Les numéros utiles** en accès rapide (poste de garde, syndic, urgences, pharmacie de quartier).

📖 **Le guide du résident** — la FAQ structurée, deep-linkable (codes, horaires, règles de la résidence).

🎒 **Le pack d'accueil nouveaux arrivants** — pour qu'arriver à la résidence devienne un événement préparé, pas une débrouille.

L'écran d'accueil tient en **trois tuiles** : **Annuaire**, **Alertes**, **Guide**. Les trois autres modules (bons plans, numéros utiles, pack accueil) sont accessibles à un tap depuis le guide ou la barre supérieure. Pas de menu hamburger, pas de notifications intrusives (3 catégories, opt-in strict), pas de présence sociale (« qui est en ligne »), pas de gamification. Chaque entrée de l'annuaire ou du guide est un **lien partageable** : un voisin peut copier-coller dans WhatsApp en un tap, et le destinataire ouvre directement la fiche.

> 🌟 **La règle Aïcha** — toute fonctionnalité qu'Aïcha (72 ans, première génération mobile) ne peut pas exécuter en moins de 30 secondes est ratée et doit être repensée. C'est le standard ergonomique non-négociable.

---

## ⚡ Ce qui rend Darna unique

Quatre catégories d'acteurs ont déjà essayé de répondre à des problèmes voisins. Aucun ne couvre le nôtre :

| Approche                            | Exemples                | Pourquoi ça ne marche pas pour nous                                                                                                       |
| ----------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 🏢 **SaaS pour syndics**            | BuildingLink, ADDA      | Vendu au syndic, payant, descendant, pas d'annuaire artisan noté entre voisins                                                            |
| 🌐 **Réseaux de voisinage ouverts** | Nextdoor                | Pensé pour les quartiers ouverts, pas les résidences fermées ; faiblement multilingue ; financé par la pub                                |
| 🛒 **Marketplaces d'artisans**      | Wesabi, Recommended.app | Logique d'annonces payantes, pas confiance communautaire fermée ; orienté lead-gen                                                        |
| 💬 **WhatsApp Communities (Meta)**  | Le concurrent direct    | Reste basé sur le chat — donc reproduit l'oubli structurel que nous voulons combattre. **Meta a vu le problème, n'a pas su le résoudre.** |

**Notre différenciation tient sur trois piliers :**

1. **🧠 La mémoire structurée comme valeur centrale** — pas un nouveau canal de discussion, mais un référentiel qui gagne en valeur avec le temps. Plus l'app vit, plus elle devient irremplaçable.
2. **🤝 La cohabitation choisie avec WhatsApp** — chaque fiche est une URL partageable. WhatsApp devient un canal de viralité (« regarde sur Darna ») au lieu d'un concurrent. **Pas d'effort d'arrachement.**
3. **🌳 La pureté horizontale habitants-pour-habitants** — pas de syndic, pas de gardien intégré, pas de figure d'autorité. Le code est ouvert, le projet appartient à la communauté.

Et un quatrième pilier, plus discret mais décisif : Darna **a de la valeur dès le premier utilisateur**. Même seul, on s'en sert pour stocker ses propres bons artisans. Cela tue le cold start qui condamne 90 % des apps communautaires.

---

## 👥 À qui ça s'adresse

**Utilisateurs primaires** : les **150 foyers de la résidence**, dans toute leur diversité — du jeune cadre télétravailleur à la retraitée qui n'a jamais ouvert un app store. La barre ergonomique est calée sur la **« règle Aïcha »** (cf. plus haut) : trois tuiles maximum, pas de jargon, pas d'autorisations système au lancement, magic link SMS ou e-mail plutôt que mot de passe.

**Trois usages dominants** émergent du terrain :

- 🛠️ **« J'ai besoin d'un artisan »** — usage de décision (« j'ai du temps pour bien choisir »), pas d'urgence : richesse de l'info > vitesse brute.
- 🆕 **« Je viens d'emménager »** — onboarding récurrent et structurel (la résidence est en croissance).
- 🔄 **« Je veux contribuer »** — partager un bon plan, recommander un prestataire, signaler une coupure.

**Utilisateurs secondaires (V2+)** : les espaces ados/parents activables par couches, sans alourdir le MVP.

---

## 📊 Critères de succès

| Horizon                        | Indicateurs                                                                                  | Signal qualitatif clé                                                                                                                                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🌱 3 mois** (post-lancement) | **15 villas inscrites** (10 %) · **15 artisans seedés et notés** · 2-3 co-modérateurs actifs | Au moins une anecdote vérifiable : _« j'ai trouvé mon plombier sur Darna en 5 secondes »_. _Note : palier intentionnellement modeste — l'adoption d'une douleur tiède sans marketing s'amorce lentement ; 30 villas est visé plutôt vers le 4-5ᵉ mois._ |
| **🌿 6 mois**                  | 75 villas inscrites (50 % — masse critique) · 30+ artisans notés par plusieurs voisins       | Darna est cité spontanément dans les groupes WhatsApp (_« regarde sur Darna »_). Aucun incident de modération majeur.                                                                                                                                   |
| **🌳 12 mois**                 | 100+ villas inscrites (~70 %)                                                                | Auto-suffisance de la modération (les initiateurs ne sont plus indispensables au quotidien) · Au moins **une résidence voisine** a manifesté son intérêt pour répliquer le modèle.                                                                      |

Ces seuils sont des **boussoles, pas des KPIs de pilotage** — le projet n'a ni croissance à servir ni investisseur à rassurer. Si à 12 mois Darna est devenu un service utile et invisible que personne ne remarque, c'est gagné.

---

## 🎯 Périmètre du MVP

**Inclus dans la première version** :

- Annuaire d'artisans noté (notation typée, tags **français + arabe** au MVP, prix relatif, indicateur facture) — _Darija et Berbère ajoutés en V1.5 (priorité, mais hors chemin critique du build)_
- Alertes éphémères avec modèles pré-rédigés
- Bons plans typés et expirables
- Numéros utiles en accès rapide
- Guide du résident (FAQ structurée, deep-linkable)
- Pack d'accueil nouveaux arrivants
- Inscription minimaliste + magic link **par e-mail OU SMS au choix** (session 12 mois)
- Liens profonds partageables sur WhatsApp
- Page `/install` avec instructions OS-aware (iOS Safari + Android Chrome)
- **Annuaire pré-amorcé** : 10-15 artisans seedés par les co-mods 14 jours avant ouverture publique
- Conformité CNDP/RGPD opérationnelle dès J1 + procédure de retrait écrite + contact juridique de recours identifié
- Co-modération à 2-3 admins volontaires + journal public des actions + règle d'escalade (contenu hors-cadre = retrait sous 24 h, notification à l'auteur, pas de débat)

**Explicitement hors-scope V1** :

- Espaces ados / parents (V2)
- Annonces officielles du syndic (V2 si demande)
- Covoiturage structuré
- Tout indicateur de visibilité publique (vues, statistiques, classements) — choix idéologique
- Toute présence sociale (« qui est en ligne », « vu à »)
- Multi-résidences (V3)
- Toute zone politique, religieuse, ou de régulation des conflits de voisinage — modération **structurelle** (l'app ne fournit pas l'espace), pas humaine

---

## 💾 Hébergement & souveraineté des données

Données hébergées **exclusivement dans l'Union européenne** (centre de données de Francfort), conformément à la liste CNDP des pays à protection adéquate (Loi 09-08, art. 43). Aucun transfert vers un pays tiers, aucun profilage, aucune revente.

| Composant                                     | Région                     | Conformité |
| --------------------------------------------- | -------------------------- | ---------- |
| Base de données + authentification (Supabase) | `eu-central-1` (Francfort) | ✅         |
| Frontend + fonctions serveur (Vercel)         | `fra1` (Francfort)         | ✅         |
| Stockage de fichiers (Cloudflare R2)          | Juridiction `eu`           | ✅         |
| Nom de domaine `darna.org`                    | Registrar européen         | ✅         |

**Coût estimé** : ~0 € à 15 €/mois au stade MVP, ~30-50 €/mois à 100 villas (offres gratuites des fournisseurs ci-dessus quasi suffisantes jusqu'à ~150 utilisateurs actifs). Les coûts initiaux (domaine ~12 €/an + éventuels SMS) sont assumés par l'initiateur du projet jusqu'à la transition vers une structure associative légère, déclenchée à 100 villas inscrites ou 100 €/an cumulés.

**Migration vers un hébergeur marocain** envisageable en V3 si le scaling et le cadre juridique le justifient.

---

## ⚖️ Cadre juridique & gouvernance

**Conformité CNDP (Maroc, Loi 09-08) et RGPD-by-design dès le MVP :**

- Consentement explicite des artisans avant publication de leur fiche
- Droit de réponse opérationnel pour les artisans notés
- Droit d'effacement (suppression de compte + données associées en moins de 7 jours)
- Modération réactive sur les avis nominatifs (suppression rapide de tout contenu manifestement abusif ou diffamatoire)
- Pseudonymisation possible de l'identité du recommandeur sur demande
- Pas de catégorie politique, religieuse, ou de régulation de conflits de voisinage

**Open source dès le premier jour** (licence MIT) — code public sur GitHub. Trois bénéfices :

- 🔍 **Transparence vérifiable** : qui veut auditer le code peut le faire (renforce la confiance face au syndic et aux voisins méfiants).
- 🛡️ **Anti-fragilité** : si les initiateurs disparaissent, n'importe qui peut reprendre le projet (anti-bus-factor structurel).
- 🌍 **Réplicabilité ouverte** : toute autre résidence peut forker et adapter — c'est la condition d'une diffusion sans friction commerciale.

**Co-modération volontaire** : 2-3 voisins co-pilotent dès le lancement, sans hiérarchie. La charge attendue est **~2 heures par mois en moyenne** (3-5 micro-décisions par semaine sur notification + une réunion trimestrielle de 30 min). Les outils de modération sont conçus pour qu'aucune décision ne demande plus d'une minute.

Recovery multi-canal en place (gestionnaire de mots de passe partagé, dépôt Git mirroré sur deux plateformes, runbook écrit, contact technique de secours désigné avec SLA 24 h). Une **transition vers une structure associative légère** est déclenchée à 100 villas inscrites ou 100 €/an de coûts cumulés — propriétaire du domaine, du compte Supabase, et porteur juridique.

---

## 🛡️ Risques connus & comment nous les traitons

Nous préférons les nommer plutôt que les masquer. Voici les quatre risques principaux que nous avons identifiés et la posture que nous adoptons pour chacun.

| Risque                                                                                                             | Posture & mesure concrète                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ⚖️ **Diffamation / e-réputation** d'un artisan suite à un avis négatif (le droit marocain est strict sur ce point) | Pseudonyme par défaut sur les avis · droit de réponse opérationnel pour l'artisan · consentement préalable avant publication de fiche · contact juridique de recours pré-identifié · runbook de retrait sous 24 h                                                                                        |
| 🔋 **Burnout des co-modérateurs** ou départ avant maturité                                                         | Charge plafonnée à ~2h/mois · clause de sortie sans condition · recrutement d'un 4ᵉ co-mod visé au 6ᵉ mois · ritual trimestriel léger pour maintenir l'engagement                                                                                                                                        |
| 🚫 **Pushback du syndic** percevant Darna comme un pouvoir parallèle                                               | Pureté horizontale revendiquée (Darna ne décide rien à la place du syndic) · cadrage explicite « offload de coordination, pas de prérogative » dès le premier contact · engagement formel à ne porter aucune zone politique ou conflictuelle                                                             |
| 🪙 **Déclin d'engagement après la nouveauté** (mois 6-12)                                                          | Boucles d'usage ancrées dans des moments à forte intention (recherche d'artisan, arrivée nouveau voisin) · pré-amorçage de l'annuaire pour éviter l'écueil "page vide" · suivi qualitatif d'un signal-clé : _un voisin répond-il à une question WhatsApp par un lien Darna ?_ (à observer dès le mois 4) |

Aucun de ces risques n'est éliminé — ils sont **rendus visibles et bornés**. C'est la condition pour que le projet reste défendable face à un voisin sceptique, un membre du syndic prudent, ou une CNDP attentive.

---

## 🌟 Vision

Si Darna réussit, le projet devient **deux choses à la fois** :

1. **Un service du quotidien sur notre résidence** — utile, invisible, devenu naturel. Les WhatsApp continuent d'exister pour la conversation ; Darna porte la mémoire.
2. **Un patron réplicable**, librement adoptable par d'autres résidences au Maroc puis ailleurs — sans franchise, sans modèle commercial, sans plateforme propriétaire. Chaque résidence forke son propre Darna et le fait vivre selon sa culture.

À 2-3 ans, l'horizon est une **fédération informelle de Darnas** indépendants, partageant éventuellement un socle technique commun et des bonnes pratiques de modération, mais sans pouvoir centralisé. Un **commun numérique de quartier**, à l'échelle régionale — la preuve qu'on peut faire tourner une infrastructure communautaire utile, durable, et conforme, **sans logique de plateforme, sans monétisation, sans dépendance institutionnelle**.

---

## 🗓️ Calendrier

| Phase                                                                                                                                           | Période                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📐 Cadrage produit (PRD + architecture)                                                                                                         | 6 → 15 mai 2026                                                                                                                                           |
| 🛠️ Construction du MVP                                                                                                                          | 18 mai → 14 juin 2026 _(buffer Eid al-Adha ~27 mai pris en compte)_                                                                                       |
| 🔒 Bêta privée (5 voisins représentatifs : 1 Aïcha, 1 nouvel arrivant, 1 utilisateur WhatsApp intensif, 1 voisin proche du syndic, 1 sceptique) | 15 → 28 juin 2026                                                                                                                                         |
| 🌱 Pré-amorçage de l'annuaire (10-15 artisans, par les co-mods)                                                                                 | 17 → 30 juin 2026                                                                                                                                         |
| 🚀 **Lancement résidence**                                                                                                                      | **début juillet 2026**, ancré sur un événement physique commun (fête de quartier, AG syndic, ou rentrée scolaire si glissement) pour une démo main-à-main |

**Engagement syndic (cible C)** : non sollicité avant le **palier de 50 villas inscrites** (vers le 6ᵉ mois). Demande à ce moment-là : **inclure un QR Darna dans le pack de bienvenue remis aux nouveaux acquéreurs**. Pas de demande financière, pas d'intégration, pas de gouvernance partagée.

**Critères de réplicabilité V3** (jalons à atteindre avant tout pitch sérieux à une résidence voisine) : 100 villas inscrites + 6 mois d'exploitation stable + zéro incident CNDP majeur + procédure de fork documentée + au moins une étude de cas écrite.

---

## 🤝 L'appel

**Pour les voisins co-modérateurs pressentis** : nous cherchons 2-3 personnes pour porter le projet avec nous. Engagement réaliste : **~2 heures par mois** (3-5 micro-décisions par semaine via notification + une réunion trimestrielle de 30 min). Pas d'astreinte, pas d'urgence, pas de charge technique. Une **clause de sortie sans condition** est garantie — si quelqu'un n'a plus envie ou plus de temps, le projet est conçu pour absorber le départ.

**Pour le syndic** : Darna offloade la coordination horizontale entre habitants — celle qui vous arrive par e-mail / WhatsApp et qui ne relève ni de votre mandat, ni de votre responsabilité juridique. Vous gagnez en sérénité opérationnelle ; vous ne perdez aucune prérogative ; vous n'avez rien à porter financièrement ni techniquement. Bonus : Darna constitue une **mémoire de la résidence qui survit aux rotations de mandat**.

**Pour les résidences voisines** : Darna est un bien commun. Le code est ouvert, la documentation de réplication est en cours d'écriture, et toute résidence ayant un porteur technique local pourra forker et adapter sans nous solliciter, sans rien acheter, sans dépendance.

---

_Brief porté collectivement par un groupe de voisins de la résidence — version du 5 mai 2026._
