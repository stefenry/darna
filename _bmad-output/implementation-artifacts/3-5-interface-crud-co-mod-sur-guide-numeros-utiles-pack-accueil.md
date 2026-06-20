# Story 3.5: Interface CRUD co-mod sur Guide, Numéros utiles, Pack accueil

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> ⚠️ **3 points structurants** (détaillés en Dev Notes) : (1) **Create/Edit ≠ Retire.** Création et édition passent par le **client session co_mod** (RLS + grants colonne posés en **3.1**, pas d'admin client) ; le **retrait** passe par un **RPC SECURITY DEFINER** `retire_durable_entry` (soft-delete + `moderation_log` atomiques, sur le modèle exact de `accept_admission`/`process_artisan_consent`) car `moderation_log` est écriture-système. (2) **Une seule action enum réutilisée** — `moderation_action.content_removed` (existe déjà) + `target_kind in ('guide_entry','useful_number','pack_entry')` ; **aucune** valeur d'enum à ajouter (l'épic écrit « `guide_entry.retired` » mais c'est `content_removed`/`guide_entry`, voir D3). (3) **Garde 403 gratuite** — les routes vivent sous `app/[locale]/comod/admin/…`, héritant du `requireComod()` du `comod/layout.tsx` qui rend déjà la page `comod.forbidden` (NFR21) ; pas de garde à réécrire, juste à **ne pas contourner** (Server Actions exclusives, AR16).

## Story

As a **co-mod**,
I want **une interface CRUD unifiée pour les entrées Guide, Numéros utiles et Pack accueil avec éditeur bilingue**,
so that **je garde le contenu durable frais et fiable dans les deux langues**.

Story de **curation** : elle ajoute la couche d'écriture co_mod par-dessus le schéma (3.1) et les vues de lecture (3.2/3.3/3.4). Elle ferme l'Epic 3. Les 3 modules partagent **un même éditeur générique** paramétré par type d'entité (Guide = thème + markdown bilingue ; Numéros = catégorie + téléphone ; Pack = section + markdown bilingue).

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 3.5 » (l. 1248-1282). FR26/FR48/FR33-setup, NFR17/NFR21/NFR37/NFR45, AR16. Précisions techniques (RPC retrait, mapping `moderation_log`, client session vs RPC) en Dev Notes — elles priment.

1. **AC1 — Liste d'admin par module.** Étant donné que je suis `co_mod` et j'ouvre `/comod/admin/guide` (idem `/numeros-utiles` et `/pack-accueil`), quand la page rend, alors je vois la **liste de toutes les entrées de ma résidence** (y compris masquées en lecture résident si pertinent) avec actions **éditer / retirer**, plus un CTA **« + Nouvelle entrée »**. (FR26)
2. **AC2 — Éditeur bilingue.** Étant donné que je crée une entrée Guide, quand le formulaire s'ouvre, alors il présente des **éditeurs Markdown FR + AR côte à côte avec preview live**, un sélecteur de thème, un champ ordre — et **valide qu'au moins le champ FR est rempli** avant soumission.
3. **AC3 — Sauvegarde FR-only avec avertissement.** Étant donné que je sauvegarde une entrée avec seulement le FR rempli (AR vide), quand je soumets, alors l'entrée persiste avec `body_ar_markdown = NULL`, et un **avertissement** me notifie « Cette entrée affichera la version FR en mode AR jusqu'à traduction ». (FR48)
4. **AC4 — Édition immédiate + invalidation cache.** Étant donné que j'édite une entrée existante, quand je sauvegarde, alors les changements s'appliquent **immédiatement** (pas d'état brouillon au MVP), `updated_at` est bumpé, et le cache SW est **invalidé** via `revalidatePath('/[locale]/community/guide')` (et la route entrée concernée).
5. **AC5 — Retrait = soft-delete + log.** Étant donné que je retire une entrée, quand je confirme, alors l'entrée est **soft-deletée** (`deleted_at`/`deleted_by` posés) et `moderation_log` enregistre l'événement (`action='content_removed'`, `target_kind='guide_entry'|'useful_number'|'pack_entry'`, `target_id`, `actor_id`=mon id co_mod). (NFR17, FR33-setup)
6. **AC6 — Garde 403 serveur.** Étant donné que je suis `resident` et tente d'ouvrir `/comod/admin/guide`, quand la requête atteint le middleware/layout, alors je reçois un **403** avec page d'erreur localisée. (NFR21)
7. **AC7 — RTL + clavier + Server Actions exclusives.** Et l'interface CRUD est **RTL-correcte**, **navigable au clavier**, et utilise **exclusivement des Server Actions** (aucun appel DB direct côté client). (AR16, NFR37, NFR45)

### AC additionnel (régression — obligatoire)

8. **AC8 — Sécurité + intégrité + tests verts.** Create/Edit via **client session co_mod** (RLS `<table>_co_mod_*` + grants colonne 3.1 = enforcement réel — NFR21) ; retrait via **RPC SECURITY DEFINER** qui **re-vérifie** rôle co*mod + résidence en interne (jamais de confiance au paramètre client). Validation Zod **client ET serveur** (≥ FR rempli, `phone_e164` valide pour Numéros, `theme_key`/`category_key` dans l'enum, ordre entier ≥ 0). Jamais d'écriture sur `residence_id` (UPDATE), `created_at`, `search*\*\_tsv`. `revalidatePath`après chaque mutation.`pnpm typecheck`/`lint`/`test`verts ;`tests/rls.test.ts` étendu (co_mod CRUD OK, cross-résidence KO, retrait masque la lecture résident) + tests Server Actions node + test rendu éditeur.

## Tasks / Subtasks

- [x] **Task 1 — Migration : RPC retrait `retire_durable_entry`** (AC: 5, 8)
  - [ ] `supabase/migrations/20260623110000_durable_content_retire_rpc.sql` (timestamp > 3.1/3.2). `create function public.retire_durable_entry(p_kind text, p_id uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$ … $$;` — sur le **modèle exact** de `accept_admission`/`process_artisan_consent`.
  - [ ] Corps : valider `p_kind in ('guide_entry','useful_number','pack_entry')` (sinon `raise exception 'invalid_kind'`) ; résoudre la table cible ; `raise exception 'not_co_mod'` si `auth_role() <> 'co_mod'` ; charger l'entrée, `raise exception 'not_found'` si absente ou déjà `deleted_at is not null` ; `raise exception 'wrong_residence'` si `residence_id <> auth_residence_id()` ; `update <table> set deleted_at = now(), deleted_by = auth.uid(), deletion_reason = p_reason where id = p_id` ; `insert into moderation_log (residence_id, actor_id, action, target_kind, target_id, reason_text_anonymized) values (auth_residence_id(), auth.uid(), 'content_removed', p_kind, p_id, p_reason)`. Atomique (une transaction de fonction).
  - [ ] **Pas** de nouvelle valeur d'enum `moderation_action` (réutilise `content_removed`).

- [x] **Task 2 — Config d'entité générique** (AC: 1, 2)
  - [ ] `lib/content/admin-config.ts` : une const décrivant les 3 entités (`guide` | `numeros` | `pack`) : `{ table, kind, route, fields, i18nNs, listSelect, orderField }`. Permet à l'éditeur/liste/actions de rester génériques. Réutiliser `GUIDE_THEME_ORDER` (3.2), `USEFUL_NUMBER_CATEGORY_ORDER` (3.3).
  - [ ] Types dérivés de `Database['public']['Tables']` (jamais de typage manuel).

- [x] **Task 3 — Schémas Zod + mapping erreurs** (AC: 2, 3, 8)
  - [ ] `lib/validation/durable-content.ts` : `zGuideEntry` (`slug` slugifié, `theme_key z.enum([...])`, `title_fr` requis non vide, `title_ar` optionnel, `body_fr_markdown` requis, `body_ar_markdown` optionnel, `order_in_theme z.coerce.number().int().min(0)`), `zUsefulNumber` (`category_key` enum, `label_fr` requis, `phone_e164` via regex E.164 `^\+[1-9]\d{6,14}$`, `notes_*` optionnels, ordre), `zPackEntry` (`section_key` requis texte, `title_fr`/`body_fr_markdown` requis, AR optionnels, ordre). `slug` auto-généré depuis `title_fr` si non fourni (helper `slugify`, réutiliser si existant — sinon créer `lib/content/slugify.ts`).
  - [ ] `mapDurableFieldError(path)` → clé i18n `errors.comod.content.*` (lire le `path` Zod uniquement, jamais le message natif — AR17).
  - [ ] `lib/validation/durable-content.test.ts` : FR requis, AR optionnel, phone E.164, enum thème/catégorie, ordre ≥ 0.

- [x] **Task 4 — Server Actions create/edit/retire** (AC: 3, 4, 5, 8)
  - [ ] `app/[locale]/comod/admin/_actions/durable-content.ts` (`'use server'`). 3 fonctions génériques paramétrées par `kind` (ou 1 par opération × entité — privilégier génériques avec `kind` validé) : `createDurableEntry(kind, formData)`, `updateDurableEntry(kind, id, formData)`, `retireDurableEntry(kind, id, reason)`. Signature compatible `useActionState` (union `{ ok:true } | { ok:false; code; field?; message_key }`).
  - [ ] **Garde** : `requireComod()` en tête (renvoie `forbidden`/`errors.comod.forbidden` sinon).
  - [ ] **Create/Edit** : `z…safeParse` → mapping field error ; **client session** (`createClient`, pas admin) → `insert`/`update` (RLS `<table>_co_mod_insert`/`_update` + grants colonne 3.1 = enforcement). `created_by = guard.user.id` à l'insert ; `residence_id` **jamais** lu du form (déduit par RLS / `auth_residence_id`). `revalidatePath('/[locale]/community/<module>')` + la route entrée si Guide. Sur erreur DB → `log` + `submit_failed`.
  - [ ] **Retire** : `supabase.rpc('retire_durable_entry', { p_kind: kind, p_id: id, p_reason })` (client **session** — le RPC est SECURITY DEFINER mais callable par authenticated, re-vérifie tout en interne). Mapper les `raise exception` (`not_co_mod`/`wrong_residence`/`not_found`/`invalid_kind`) sur des codes (calquer `mapRpcError` de `comod/admission/actions.ts`). `revalidatePath`.
  - [ ] **Avertissement AR vide (AC3)** : non bloquant — l'action **réussit** avec `body_ar_markdown=NULL` et renvoie un flag `{ ok:true, warning:'untranslated' }` que le form affiche.
  - [ ] Tests node (`// @vitest-environment node`, mocks `requireComod` + `createClient` chaîné + `logger`, calquer `tests/profil/profile-actions.test.ts` et `tests/comod/*`) : create OK, edit OK, validation KO, retire via rpc, forbidden si pas co_mod.

- [x] **Task 5 — Liste d'admin par module** (AC: 1, 6, 7)
  - [ ] `app/[locale]/comod/admin/guide/page.tsx`, `…/numeros-utiles/page.tsx`, `…/pack-accueil/page.tsx` (RSC, `force-dynamic`, `generateMetadata`). Chacune lit ses entrées via **client session** (RLS co_mod voit aussi les soft-deleted de sa résidence — afficher état « retiré » + possibilité future de restaurer). Pattern de lecture identique à `comod/admission/page.tsx` (l.40-60).
  - [ ] `_components/admin-list.tsx` (générique, paramétré `kind`) : table/cartes (titre/label, thème/catégorie/section, ordre, badge « retiré » si `deleted_at`), boutons « Éditer » (`<Link>` vers `[id]`) et « Retirer » (ouvre `<RetireConfirm>`). CTA « + Nouvelle entrée » → `nouveau`.
  - [ ] `_components/retire-confirm.tsx` (`'use client'`) : confirmation (pas modal plein écran — inline/dialog Radix accessible, focus-trap, Escape) appelant `retireDurableEntry`. Champ `reason` optionnel.
  - [ ] `loading.tsx`/`error.tsx` par module (ou partagés sous `admin/`).

- [x] **Task 6 — Éditeur bilingue générique (nouveau + édition)** (AC: 2, 3, 7)
  - [ ] Routes `…/<module>/nouveau/page.tsx` et `…/<module>/[id]/page.tsx` (RSC : la 2ᵉ charge l'entrée via session client, `notFound()` si absente/autre résidence). Toutes deux montent `<DurableEntryForm kind=… mode='create'|'edit' existing? />`.
  - [ ] `_components/durable-entry-form.tsx` (`'use client'`, `useActionState`) : champs selon `kind` (config Task 2). Pour Guide/Pack : **deux `<textarea>` Markdown FR/AR côte à côte** (grid 2 colonnes desktop, empilé mobile) chacun avec **preview live** via `<MarkdownRender>` (3.2, fonctionne en client) ; sélecteur thème/section ; input ordre. Pour Numéros : `label_fr`/`label_ar`, `phone_e164` (input `inputMode="tel"`), `notes_*`, sélecteur catégorie, ordre. CTA sticky « Enregistrer » (`<StickyBottomBar>`).
  - [ ] **Validation client** : ≥ FR rempli (CTA disabled sinon) **+** miroir serveur. Sur `ok && warning==='untranslated'` → toast/encart « Cette entrée affichera la version FR en mode AR jusqu'à traduction » (AC3). Sur succès → toast + `router.push` vers la liste.
  - [ ] a11y : `<fieldset>`/`<legend>`, labels liés (`useId`), erreurs `role="alert"`, RTL via logical properties (NFR45), clavier complet (NFR37). `noValidate aria-busy`.
  - [ ] Test rendu (jsdom, `<NextIntlClientProvider>`, mock action) : champs FR/AR présents, preview rend le markdown, CTA disabled si FR vide.

- [x] **Task 7 — Entrées de navigation co_mod** (AC: 1, 6)
  - [ ] Ajouter des liens vers `/comod/admin/{guide,numeros-utiles,pack-accueil}` depuis un hub co_mod (étendre `comod/layout.tsx` ou une home `comod/page.tsx` si elle existe ; sinon ajouter une nav légère). **Préserver** la garde `requireComod` du layout (AC6 vient de là — ne rien affaiblir).

- [x] **Task 8 — i18n `comod.admin` + `errors.comod.content`** (AC: 1, 2, 3, 5)
  - [ ] `messages/fr.json` namespace `comod.admin` : sous-clés partagées (`newEntry`, `edit`, `retire`, `confirmRetire`, `retireReasonLabel`, `save`, `saving`, `cancel`, `frEditor`, `arEditor`, `preview`, `orderLabel`, `untranslatedWarning` = « Cette entrée affichera la version FR en mode AR jusqu'à traduction », `retiredBadge`, `backToList`) + par module (`guide.{pageTitle,intro,themeLabel}`, `numeros.{pageTitle,intro,categoryLabel,phoneLabel,notesLabel}`, `pack.{pageTitle,intro,sectionLabel}`). Réutiliser `community.guide.themes.*` (libellés thèmes) et `community.numerosUtiles.categories.*` (libellés catégories) pour les sélecteurs.
  - [ ] `errors.comod.content.*` (FR requis, phone invalide, thème invalide, ordre invalide, `submit_failed`, `not_found`, `wrong_residence`). Réutiliser `errors.comod.forbidden` existant.
  - [ ] `messages/ar.json` : stub parallèle.

- [x] **Task 9 — Tests RLS + intégration** (AC: 5, 8)
  - [ ] `tests/rls.test.ts` — étendre le block Epic 3 : (a) co_mod `INSERT`/`UPDATE` OK sa résidence ; (b) co_mod autre résidence `UPDATE` → `42501`/0 ligne ; (c) RPC `retire_durable_entry` par co_mod → entrée `deleted_at` non null **et** ligne `moderation_log` `content_removed` créée ; (d) après retrait, `SELECT` résident → 0 ligne ; (e) RPC appelé par un `resident` → exception `not_co_mod` (re-check interne, pas seulement RLS).

## Dev Notes

> **Stack & conventions** : identiques co_mod 1.8 (Server Actions `requireComod` → validation Zod → mutation/RPC → Result ; pattern `comod/admission/actions.ts`). 3.5 ajoute la couche **écriture co_mod** sur le schéma 3.1, avec **1 RPC** de retrait. Toutes les routes sous `comod/admin/` héritent la garde du layout.

### §Décisions (points tranchés)

1. **D1 — Create/Edit = client session ; Retire = RPC SECURITY DEFINER.** Création/édition utilisent les **grants colonne co_mod** (3.1) via le client session (pas d'admin client) — l'écriture est bornée par RLS + grants, défense en profondeur. Le **retrait** doit écrire `moderation_log` (écriture-système, architecture l.1060) → seul un RPC SECURITY DEFINER peut le faire, sur le modèle `process_artisan_consent`/`accept_admission`. Le RPC re-vérifie rôle + résidence en interne (ne fait jamais confiance au `p_kind`/`p_id` seuls). [tranché]
2. **D2 — Un éditeur générique, pas 3 forms dupliqués.** Les 3 entités partagent un `<DurableEntryForm kind=…>` paramétré par `lib/content/admin-config.ts`. Guide/Pack = markdown bilingue + preview ; Numéros = champs téléphone. Évite la triple duplication tout en gardant un seul chemin de validation. [tranché]
3. **D3 — `moderation_log` : `content_removed`/`<kind>`, pas de nouvel enum.** L'épic écrit « `moderation_log` records `guide_entry.retired` event ». On **mappe** : `action='content_removed'` (valeur enum existante, `init_enums` l.33-40) + `target_kind='guide_entry'|'useful_number'|'pack_entry'` + `target_id`. Aucune migration d'enum. Cohérent avec l'usage `target_kind='artisan'` du consent RPC. [tranché]
4. **D4 — Pas d'état brouillon (MVP).** L'épic le dit (« no draft state at MVP ») : `update` applique immédiatement. L'invalidation cache se fait par `revalidatePath` des routes de lecture concernées ; le SW (StaleWhileRevalidate, 3.2) se rafraîchit à la prochaine navigation online. [tranché]
5. **D5 — `slug` Guide auto-généré, éditable.** À la création Guide, `slug` dérivé de `title_fr` (slugify) si non fourni, ré-éditable (le slug est la cible deep-link 3.2, stable par résidence — `unique(residence_id, slug)` 3.1 D2). En édition, prévenir si le slug change (casse les deep-links existants) — avertissement non bloquant. [tranché]
6. **D6 — Garde 403 par le layout, pas re-codée.** `comod/layout.tsx` rend déjà `comod.forbidden` via `requireComod()`. Les routes `comod/admin/*` en héritent (AC6 gratuit). Les Server Actions re-gardent quand même (`requireComod` en tête) — défense en profondeur, jamais de confiance au seul layout. [tranché]
7. **D7 — Confirmation de retrait inline, pas modal plein écran.** Dialog Radix accessible (focus-trap, Escape) ou confirmation inline ; cohérent avec le bannissement des overlays plein écran MVP. [tranché]

### §Sécurité (NFR21 / AR16 / AR17)

- **Server Actions exclusives** (AR16) : aucun appel Supabase direct depuis un composant client. Le form poste vers l'action ; la lecture est RSC.
- **Create/Edit** : RLS `<table>_co_mod_insert`/`_update` (`auth_role()='co_mod' and residence_id=auth_residence_id()`) + grants colonne (3.1) → un INSERT/UPDATE forgé, cross-résidence, ou touchant `residence_id`/`created_at`/`search_*_tsv` est rejeté `42501`. `residence_id` jamais lu du form.
- **Retire RPC** : SECURITY DEFINER mais **re-checke** `auth_role()='co_mod'` + `residence_id=auth_residence_id()` → un résident appelant le RPC reçoit `not_co_mod` (prouvé en test 9e). `search_path=public` (anti-injection).
- **Validation** : ne lire que le `path` Zod pour la clé d'erreur (AR17). ≥ FR rempli, `phone_e164` E.164, enums validés, ordre entier — client **et** serveur.
- **Garde route** : `requireComod` (layout + action). Resident → 403 localisé (`comod.forbidden`).

### §Réutilisation directe (ne PAS réinventer)

- **Schéma + RLS co_mod + grants** : `supabase/migrations/20260623090000_durable_content_schema.sql` (3.1) — l'écriture co_mod est **déjà autorisée** par le schéma ; 3.5 ne fait que l'appeler.
- **Template Server Action co_mod** : `app/[locale]/comod/admission/actions.ts` (1.8) — `requireComod`, union `Result`, `mapRpcError`, `log`, RPC pattern. **Le** modèle à imiter.
- **Template RPC SECURITY DEFINER** : `supabase/migrations/20260622120000_artisan_consent_rpc.sql` (`process_artisan_consent` : checks internes + `moderation_log` + `raise exception` stables) et les RPC `accept_admission`/`reject_admission` (1.8).
- **Lecture liste RSC** : `app/[locale]/comod/admission/page.tsx` (l.40-60, client session + RLS co_mod + log).
- **Renderer Markdown** (preview) : `components/content/markdown-render.tsx` (3.2).
- **Form template** : `app/[locale]/community/annuaire/nouveau/_components/create-artisan-form.tsx` (`useActionState`, `useId`, erreurs `role="alert"`, pending) ; `<StickyBottomBar>`, toast sonner.
- **Validation** : `lib/validation/artisan.ts` (helpers `zOptionalText`, slugify si présent), pattern `mapRatingFieldError` (2.6).
- **Garde** : `lib/auth/require-comod.ts` ; layout `app/[locale]/comod/layout.tsx` (403).
- **i18n** : `comod.admission`/`comod.forbidden`, `community.guide.themes.*`, `community.numerosUtiles.categories.*`, `errors.comod.*` existants.
- **Tests** : `tests/comod/*` (actions co_mod node), `tests/rls.test.ts` block Epic 3 (3.1).

### §Gotchas (appris des stories 1.8 / 2.4-2.6 / 3.1-3.4)

- `moderation_log` n'a **aucune** policy d'écriture client → toute insertion passe par un RPC SECURITY DEFINER (jamais `createClient().from('moderation_log').insert`).
- Le RPC est SECURITY DEFINER : il **doit** re-checker rôle + résidence en interne (sinon n'importe quel authenticated retirerait du contenu). Tester le cas resident (9e).
- `revalidatePath` ne purge pas le cache **SW** instantanément (StaleWhileRevalidate) — c'est attendu (D4) : le contenu se rafraîchit à la prochaine navigation online.
- `useActionState` post-submit ne s'exécute pas proprement en jsdom → flux complet en E2E (1.10c) ; tests de rendu seulement.
- `ar.json` parallèle même en stub ; **ne pas** traduire les valeurs d'enum (i18n au render).
- Changer le `slug` d'une entrée Guide casse les deep-links partagés (Epic 6) → avertir (D5).
- `phone_e164` : valider `^\+[1-9]\d{6,14}$` (même règle qu'artisans 2.4) côté client + serveur.

### Project Structure Notes

- **NEW** : `supabase/migrations/20260623110000_durable_content_retire_rpc.sql` ; `lib/content/admin-config.ts` ; `lib/validation/durable-content.ts` (+ `.test.ts`) ; `lib/content/slugify.ts` (si absent) ; `app/[locale]/comod/admin/_actions/durable-content.ts` ; `app/[locale]/comod/admin/_components/{admin-list,retire-confirm,durable-entry-form}.tsx` ; `app/[locale]/comod/admin/{guide,numeros-utiles,pack-accueil}/{page.tsx, nouveau/page.tsx, [id]/page.tsx}` ; `loading.tsx`/`error.tsx` sous `admin/` ; tests `tests/comod/durable-*` + extensions `tests/rls.test.ts`.
- **UPDATE** : `messages/{fr,ar}.json` (`comod.admin` + `errors.comod.content`), `app/[locale]/comod/layout.tsx` ou `comod/page.tsx` (nav vers admin).
- **AUCUNE** modif de table (3.1) ; seul ajout DB = le RPC de retrait. **AUCUN** `gen:types` (pas de changement de colonnes ; le RPC apparaît dans `Functions` après `gen:types` — régénérer **si** on type l'appel `.rpc('retire_durable_entry')`).

### References

- [Source: epics.md#Story-3.5] — AC verbatim (l.1248-1282), FR26/FR48/FR33-setup, NFR17/NFR21, AR16.
- [Source: prd.md] — FR26 (l.919), FR48 (l.961), NFR17 (l.996), NFR21 (l.1000), NFR37 (l.1025), NFR45 (l.1037), AR16 (Server Actions, architecture).
- [Source: architecture.md] — `moderation_log` écriture-système (l.1060), F4 Guide co_mod `app/(comod)/moderation/guide/` (l.721), Server Actions mutations (l.309).
- [Source: 3-1-…schema-contenu-durable…md] — RLS co_mod + grants colonne (écriture autorisée ici), pas de nouvel enum.
- [Source: 3-2-…guide…md] — renderer markdown (preview), `revalidatePath` des routes lecture.
- [Source: app/[locale]/comod/admission/actions.ts] — **template** Server Action co_mod (requireComod, mapRpcError, log, RPC).
- [Source: app/[locale]/comod/admission/page.tsx] — lecture liste RSC client session + RLS co_mod (l.40-60).
- [Source: app/[locale]/comod/layout.tsx] — garde `requireComod` + 403 `comod.forbidden` (héritée par admin/\*).
- [Source: supabase/migrations/20260622120000_artisan_consent_rpc.sql] — template RPC SECURITY DEFINER (checks + moderation_log + raise exception).
- [Source: supabase/migrations/20260524005527_init_enums.sql] — `moderation_action` (`content_removed`, l.33-40).
- [Source: app/[locale]/community/annuaire/nouveau/\_components/create-artisan-form.tsx] — template form `useActionState`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev autonome Epic 3, 2026-06-20).

### Debug Log References

- Migration RPC `20260627110000_durable_content_retire_rpc.sql` appliquée ; `pnpm gen:types` → `retire_durable_entry` dans `Functions`.
- `pnpm typecheck` ✅, `pnpm lint` ✅ (0 erreur), `pnpm test` → 382 passed (validation Zod + actions node + éditeur render), `pnpm test:rls` → **59 passed, 0 failed** (incl. mes tests retrait RPC r/s + les tests review 3.1 k-q).

### Completion Notes List

- **Coordination avec la code-review 3.1 concurrente** : pendant ce dev, une revue parallèle a durci le schéma 3.1 via `20260628090000_review_3_1_hardening.sql` (CHECK E.164/longueurs/format slug, UNIQUE ordre + phone, trigger `enforce_deleted_by_actor`, **P10 : `created_by default auth.uid()` retiré du grant insert**, policies résident sur `auth_role()/auth_residence_id()`). J'ai aligné 3.5 dessus : (1) **`created_by` retiré des inserts** de `saveDurableEntry` (sinon `42501`) — posé par défaut DB ; (2) regex Zod phone alignée `^\+[1-9]\d{7,14}$` ; (3) `section_key` **slugifié** en validation (CHECK `^[a-z0-9_-]{1,64}$`, anti path-traversal P4). Le trigger P1 et mon RPC posent tous deux `deleted_by = auth.uid()` (cohérent).
- **Create/Edit = client session co_mod** (RLS `<table>_co_mod_*` + grants colonne 3.1) ; `residence_id` déduit du JWT (insert), jamais lu du form ; tenant figé en UPDATE. **Retire = RPC SECURITY DEFINER** `retire_durable_entry` (soft-delete + `moderation_log content_removed` atomiques) qui **re-vérifie `auth_role()='co_mod'` + résidence** en interne → un résident reçoit `not_co_mod` (prouvé test RLS s). Whitelist `p_kind` → table (%I sûr).
- **Action enum réutilisée** : `content_removed` + `target_kind in (guide_entry|useful_number|pack_entry)` (D3) — aucune valeur d'enum ajoutée.
- **Éditeur générique unique** (`durable-entry-form.tsx`) paramétré `kind` : Guide/Pack = 2 textareas Markdown FR/AR côte à côte + **preview live** (`<MarkdownRender>` 3.2) ; Numéros = champs téléphone. Validation client (≥ FR rempli → CTA disabled) miroir serveur (Zod). Avertissement « Non traduit » non bloquant (AC3). a11y fieldset/labels useId/role=alert, RTL `dir`.
- **Garde 403** héritée du `comod/layout` (`requireComod` → `comod.forbidden`) ; Server Actions re-gardent (`requireComod` en tête) — défense en profondeur (AC6/D6). Hub co_mod `comod/page.tsx` (tuiles admission + 3 modules).
- 9 routes minces (`{guide,numeros-utiles,pack-accueil}/{page,nouveau,[id]}`) délèguent à 2 vues RSC partagées (`admin-page-views.tsx`). `notFound()` si id absent/autre résidence (RLS).
- **Pas de toast/StickyBottomBar** dans le repo (vérifié) → encarts inline `role=status/alert` + barre sticky native (déviation mineure vs « toast sonner » cité, même intention UX).
- i18n `comod.home` + `comod.admin` + `errors.comod.content` (fr) ; `ar.json` stub parallèle. Réutilise `community.guide.themes.*` / `community.numerosUtiles.categories.*` pour les sélecteurs.

### File List

- **NEW** `supabase/migrations/20260627110000_durable_content_retire_rpc.sql`
- **NEW** `lib/content/admin-config.ts` ; `lib/validation/durable-content.ts` (+ `.test.ts`)
- **NEW** `app/[locale]/comod/admin/_actions/durable-content.ts`
- **NEW** `app/[locale]/comod/admin/_data/durable.ts`
- **NEW** `app/[locale]/comod/admin/_components/{admin-list,retire-confirm,durable-entry-form,admin-page-views}.tsx`
- **NEW** `app/[locale]/comod/admin/{guide,numeros-utiles,pack-accueil}/{page,nouveau/page,[id]/page}.tsx` (9)
- **NEW** `app/[locale]/comod/page.tsx` (hub co_mod)
- **NEW** `tests/comod/{durable-content-actions.test.ts,durable-entry-form.test.tsx}`
- **UPDATE** `messages/{fr,ar}.json` (`comod.home`, `comod.admin`, `errors.comod.content`), `lib/supabase/types.generated.ts` (RPC), `tests/rls.test.ts` (tests r/s retrait RPC)

### Change Log

| Date       | Version | Description                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-06-19 | 0.1     | Création story 3.5 (context engine). CRUD co_mod unifié sur Guide/Numéros/Pack : éditeur bilingue générique (markdown FR/AR côte à côte + preview), create/edit via client session co_mod (RLS+grants 3.1), retrait via RPC SECURITY DEFINER (soft-delete + moderation_log `content_removed` atomiques), validation Zod client+serveur, garde 403 héritée du layout, Server Actions exclusives, i18n, tests RLS+actions+rendu. Status → ready-for-dev. |
