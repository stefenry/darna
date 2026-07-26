# Alertes et bons plans séparés — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** deux tuiles distinctes au hub, chacune menant à sa propre liste — alertes d'un côté, bons plans de l'autre.

**Architecture:** la carte de flux et son type remontent dans `community/_components/` (partagés par deux fonctionnalités sœurs) ; `fetchFeed` éclate en `fetchAlerts` et `fetchTips`, chaque page ne requêtant plus que sa table.

**Tech Stack:** Next 16 (RSC), Supabase, vitest + @testing-library/react, next-intl.

**Spec:** [`docs/superpowers/specs/2026-07-26-alertes-bons-plans-separes-design.md`](../specs/2026-07-26-alertes-bons-plans-separes-design.md)

## Global Constraints

- Branche `feat/alertes-bons-plans-separes` depuis `main`. Un commit par tâche, `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Portes de qualité par tâche : `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- Aucune migration, aucun changement de RLS.
- Les alertes n'affichent **jamais** d'auteur (choix produit existant : « il se passe X dans la résidence »).
- `user_id` ne franchit pas la frontière serveur → client ; seul le libellé auteur des bons plans est sérialisé.
- a11y : les cartes restent des liens uniques avec un libellé lisible ; cibles tactiles ≥ 44 px sur les CTA.
- AR : stubs vides pour les nouvelles clés (fallback FR).

---

### Task 1 : Carte de flux partagée, sans badge de type

**Files:**

- Create: `app/[locale]/community/_components/feed-card.tsx` (déplacement de `alertes/_components/feed-card.tsx`)
- Delete: `app/[locale]/community/alertes/_components/feed-card.tsx`
- Create: `tests/community/feed-card.test.tsx`

**Interfaces:**

- Produces: `type FeedItem` (déplacé depuis `alertes/data.ts`) et `<FeedCard item locale />`, sans le badge « Alerte »/« Bon plan ».

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/community/feed-card.test.tsx` avec un item alerte et un item bon plan ; vérifier : href `/fr/community/alertes/<slug>` vs `/fr/community/bons-plans/<slug>`, absence des textes « Alerte » et « Bon plan », présence du badge catégorie et du libellé auteur sur le bon plan, absence d'auteur sur l'alerte.

- [ ] **Step 2 : Lancer le test** → FAIL (module absent).

- [ ] **Step 3 : Déplacer le composant et retirer le badge**

`git mv` du fichier, déplacement du type `FeedItem` depuis `alertes/data.ts`, suppression du bloc `<span>` du badge de type et de la variable `isAlert` là où elle ne sert plus qu'à ça (elle reste utile pour le `href` et pour masquer l'auteur sur les alertes).

- [ ] **Step 4 : Lancer le test** → PASS.

- [ ] **Step 5 : Commit**

---

### Task 2 : Éclater le fetch en deux

**Files:**

- Modify: `app/[locale]/community/alertes/data.ts` — `fetchFeed` → `fetchAlerts`, requête `alerts` seule, plus d'import de `resolveTipAuthorLabels`.
- Modify: `app/[locale]/community/bons-plans/data.ts` — ajout de `fetchTips(locale)` : requête `tips` seule + `resolveTipAuthorLabels`.

**Interfaces:**

- Produces: `fetchAlerts(locale): Promise<FeedItem[]>`, `fetchTips(locale): Promise<FeedItem[]>` — tous deux `cache()`-és comme l'existant.

- [ ] **Step 1** : écrire les deux fonctions en repartant du corps de `_fetchFeed` (mêmes filtres `deleted_at is null` + `expires_at > now`, même tri `created_at desc`).
- [ ] **Step 2** : `pnpm typecheck` → les appels à `fetchFeed` cassent, ce qui guide la Task 3.
- [ ] **Step 3 : Commit** (avec la Task 3 si le typecheck doit rester vert à chaque commit).

---

### Task 3 : Les deux pages et les six tuiles

**Files:**

- Modify: `app/[locale]/community/alertes/page.tsx` — titre « Alertes », un seul CTA, `fetchAlerts`.
- Create: `app/[locale]/community/bons-plans/page.tsx` — même structure, `fetchTips`, CTA et état vide dédiés.
- Modify: `app/[locale]/community/page.tsx` — six tuiles (`Gift` pour les bons plans).
- Modify: `messages/fr.json`, `messages/ar.json`.

**Clés i18n à ajouter (FR)** : `community.home.tiles.bonsPlans` = « Bons plans » ; `community.home.tiles.alertes` passe à « Alertes » ; `community.alertes.title` passe à « Alertes » ; nouveau bloc `community.bonsPlans.list` = `{ title: "Bons plans", intro: "Les opportunités partagées par tes voisins.", empty: "Aucun bon plan en ce moment. Et si tu partageais le premier ?", emptyCta: "Publier un bon plan" }`. Stubs vides côté AR.

- [ ] **Step 1** : les deux pages + le hub.
- [ ] **Step 2** : `pnpm typecheck && pnpm lint && pnpm test` → vert.
- [ ] **Step 3 : Commit**

---

### Task 4 : Vérification bout en bout et PR

- [ ] **Step 1** : session réelle sur la stack locale (technique des chantiers précédents), puis `GET` de `/fr/community` (six tuiles, deux libellés distincts), `/fr/community/alertes` (aucun item de type bon plan, un seul CTA) et `/fr/community/bons-plans` (200, seulement des bons plans).
- [ ] **Step 2** : aucune erreur serveur.
- [ ] **Step 3** : push, PR vers `main`, sans merger.

---

## Notes de plan

- **Régression à surveiller** : `/community/bons-plans/[slug]` et `/nouveau` existent déjà ; créer `page.tsx` dans le même dossier ne doit pas les perturber (routes sœurs, pas de conflit).
- **Le tri global disparaît** : il n'y a plus de fusion de deux sources, donc plus de tri croisé — chaque liste est déjà triée par sa requête.
