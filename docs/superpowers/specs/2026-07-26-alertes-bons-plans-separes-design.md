# Alertes et bons plans séparés — design

> Date : 2026-07-26 · Statut : validé · Demande : « séparer en deux tuiles distinctes
> les alertes et les bons plans ».

## Contexte

Le hub communautaire a cinq tuiles, dont une seule « Alertes & bons plans » pointant
sur `/community/alertes`. Cette page unique affiche un **flux mélangé** : `fetchFeed`
interroge `alerts` ET `tips`, fusionne les deux et trie par fraîcheur, chaque carte
portant un badge « Alerte » ou « Bon plan ». Elle porte aussi les deux boutons de
publication.

Le dossier `bons-plans/` n'a que le détail (`[slug]`) et le formulaire (`nouveau`) :
**il n'existe aucune page liste de bons plans**. Séparer les tuiles suppose donc de
créer cette page.

## Décisions

| Question                      | Décision                                                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Séparation                    | **Complète** : `/alertes` n'affiche plus que les alertes, `/bons-plans` (nouvelle page) que les bons plans                                                                               |
| Requêtes                      | `fetchFeed` éclate en `fetchAlerts` (dans `alertes/data.ts`) et `fetchTips` (dans `bons-plans/data.ts`) — chaque page ne requête plus que sa propre table                                |
| Effet de bord positif         | La page alertes ne fait plus la requête `tips` **ni** la résolution admin des auteurs : une requête et un appel admin de moins                                                           |
| Boutons de publication        | Chaque page ne garde que le sien                                                                                                                                                         |
| Badge « Alerte »/« Bon plan » | **Retiré** de la carte : dans une liste homogène il ne distingue plus rien. Les badges catégorie et « non traduit » restent                                                              |
| Composant partagé             | `FeedItem` + `FeedCard` remontent de `alertes/_components/` vers `community/_components/` — ils servent désormais deux fonctionnalités sœurs (précédent : `_components/pack-banner.tsx`) |
| Tuiles                        | Six au lieu de cinq : « Alertes » (icône cloche) et « Bons plans » (icône cadeau, cohérente avec le 🎁 du badge retiré). La grille 2 colonnes tombe juste à 3 rangées                    |
| AR                            | Stubs vides pour les nouvelles clés (fallback FR), conforme au reste du namespace `community`                                                                                            |

## Composants

1. **`community/_components/feed-card.tsx`** (déplacé) — type `FeedItem` + carte, sans
   le badge de type.
2. **`alertes/data.ts`** — `fetchAlerts(locale)` : requête `alerts` seule, mêmes
   filtres (`deleted_at is null`, `expires_at > now`), même tri.
3. **`bons-plans/data.ts`** — `fetchTips(locale)` : requête `tips` seule + résolution
   des libellés auteur (inchangée).
4. **`alertes/page.tsx`** — titre « Alertes », un seul CTA, liste via `fetchAlerts`.
5. **`bons-plans/page.tsx`** (nouvelle) — même structure, titre « Bons plans », CTA
   « Publier un bon plan », liste via `fetchTips`, état vide dédié.
6. **`community/page.tsx`** — six tuiles.
7. **i18n** — `community.home.tiles.bonsPlans`, `community.bonsPlans.list.*` ;
   `community.alertes.title` devient « Alertes ».

## Sécurité / invariants

- Aucune migration, aucun changement de RLS : les deux tables étaient déjà lues avec
  les mêmes filtres, on ne fait que cesser de les mélanger.
- La résolution d'auteur des bons plans reste server-only et ne sérialise aucun
  `user_id` (FR16).
- Les alertes restent volontairement **sans auteur** affiché.

## Tests

- Rendu de `FeedCard` : href correct pour une alerte et pour un bon plan, absence du
  badge de type, présence du badge catégorie sur un bon plan, libellé d'auteur
  (nom / pseudonyme / supprimé) sur un bon plan et absent sur une alerte.
- Les deux `data.ts` ne sont pas testés unitairement (requêtes Supabase) : vérifiés à
  la main sur la stack locale, comme les chantiers précédents.

## Hors scope

Vue combinée conservée quelque part, onglets, filtres par catégorie sur la liste des
bons plans, notifications distinctes par type.
