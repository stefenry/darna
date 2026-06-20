# Story 3.3: Numéros utiles — accès rapide avec action `tel:`

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> ⚠️ **2 points structurants** (détaillés en Dev Notes) : (1) **Lecture seule sur schéma 3.1** — `useful_numbers`, l'enum `useful_number_category`, la RLS résident-lecture **existent** (3.1) ; 3.3 = UI RSC + data layer pur, **aucune migration**. (2) **Réutiliser le `<CallButton>` de 2.3** — l'action `tel:` (lien natif, pas de modal, cible tactile ≥ 56px) est **déjà** implémentée pour la fiche artisan ; 3.3 la réutilise telle quelle plutôt que de réinventer un bouton d'appel.

## Story

As a **résident**,
I want **un accès rapide aux numéros essentiels groupés par catégorie avec appel en un tap**,
so that **je joins le poste de garde ou la pharmacie sans chercher, en moins de 30 secondes**.

Story de **consultation** courte, jumelle de 3.2 sur le même schéma (3.1). Elle ferme le module « Numéros utiles » (FR24) côté lecture ; l'alimentation co_mod relève de 3.5. Pas de recherche (accès par catégorie), pas de deep-link par entrée (la page entière est la cible canonique, FR36 cite « page numéros utiles », pas l'entrée).

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 3.3 » (l. 1192-1218). FR24, NFR8/NFR36/NFR37/NFR40/NFR45. Précisions techniques (réutilisation `<CallButton>`, cache SW) en Dev Notes — elles priment.

1. **AC1 — Liste groupée par catégorie.** Étant donné que je suis authentifié et j'ouvre `/community/numeros-utiles` (ou via tuile home), quand la page rend, alors je vois les numéros **groupés par catégorie** (Sécurité / Syndic / Urgences / Santé / Autre), chaque entrée montrant **label (locale)**, téléphone E.164, et un bouton primaire **« Appeler » ≥ 56px**, triés par `order_in_category`. (FR24, NFR36)
2. **AC2 — Appel 1-tap via `tel:`.** Étant donné que je tape « Appeler poste de garde », quand l'action se déclenche, alors le **composeur du téléphone s'ouvre** via intent `tel:` — **pas de modal**. (FR24, NFR40)
3. **AC3 — Notes contextuelles.** Étant donné qu'une entrée a des `notes` (ex. « 24/7 » ou « Heures d'ouverture 9h-18h »), quand la page rend, alors la note s'affiche en **petit texte sous le numéro** dans ma locale (fallback FR si AR absent — FR48).
4. **AC4 — Lecture offline.** Étant donné que je suis hors-ligne, quand j'ouvre `/numeros-utiles`, alors les numéros rendent depuis le cache en **< 100 ms**. (NFR8)
5. **AC5 — a11y + RTL.** Et la page est opérable **clavier seul** (NFR37) et **RTL-correcte** en mode AR (NFR45) ; le `tel:` reste LTR (les numéros ne s'inversent pas).

### AC additionnel (régression — obligatoire)

6. **AC6 — Sécurité + tests verts.** Lecture via **client session** uniquement (RLS `useful_numbers_resident_select_residence` = enforcement, scope résidence + exclut `deleted_at`) ; aucune fuite cross-résidence. `phone_e164` rendu en attribut `href="tel:…"` **validé** (format E.164 attendu du schéma ; échapper/encoder via le helper existant si présent). `pnpm typecheck`/`lint`/`test` verts ; test rendu (groupes + bouton appel + note + état vide).

## Tasks / Subtasks

- [x] **Task 1 — Data layer Numéros** (AC: 1, 3, 6)
  - [ ] `app/[locale]/community/numeros-utiles/data.ts` : `fetchUsefulNumbers(locale)` → client session, `select id, category_key, label_fr, label_ar, phone_e164, notes_fr, notes_ar, order_in_category from useful_numbers where deleted_at is null order by category_key, order_in_category` (RLS scope résidence). Mappe `label = locale==='ar' ? (label_ar ?? label_fr) : label_fr` et `notes = locale==='ar' ? (notes_ar ?? notes_fr) : notes_fr` (fallback FR, FR48 — pas de badge ici, la note est secondaire). Grouper par `category_key` suivant l'ordre const `USEFUL_NUMBER_CATEGORY_ORDER`. `cache()`.
  - [ ] `lib/content/useful-numbers.ts` : const `USEFUL_NUMBER_CATEGORY_ORDER` (= `['securite','syndic','urgences','sante','autre']`, réutilisable liste + co_mod 3.5).

- [x] **Task 2 — Page `/community/numeros-utiles`** (AC: 1, 2, 3, 5)
  - [ ] `app/[locale]/community/numeros-utiles/page.tsx` (RSC, `export const dynamic = 'force-dynamic'`, `generateMetadata` titre i18n). `setRequestLocale` ; `<AppHeader>`/titre + intro ; pour chaque catégorie non vide : `<h2>` libellé i18n `community.numerosUtiles.categories.<key>` + liste d'entrées. État vide global « Aucun numéro pour le moment » si tout vide.
  - [ ] `_components/number-card.tsx` : label (locale, `<h3>`/`<span>`), numéro affiché (format lisible, `dir="ltr"` sur le numéro même en RTL — AC5), note en `text-sm text-neutral-500` si présente, et le bouton appel (Task 3). Style borderless v2 (carte blanche, `rounded-[14px]`, `shadow-xs`).
  - [ ] `loading.tsx` (skeleton catégories), `error.tsx` (pattern annuaire).

- [x] **Task 3 — Bouton d'appel (réutilisation 2.3)** (AC: 1, 2)
  - [ ] Réutiliser le `<CallButton>` de la fiche artisan (`app/[locale]/community/artisan/[slug]/_components/call-button.tsx`) : si générique, l'**importer** ; sinon **extraire** un `components/content/call-button.tsx` partagé (props `{ phoneE164, label }`) et faire pointer la fiche artisan dessus (refacto minimal, **préserver** son comportement sticky sur la fiche). Le bouton rend `<a href={`tel:${phoneE164}`}>` (pas de JS, pas de modal — NFR40b « Geste = WhatsApp ») avec cible tactile **≥ 56px** (AC1 prime sur NFR36 48px). `aria-label` « Appeler {label} ».
  - [ ] Vérifier l'encodage : `tel:` accepte le `+` E.164 tel quel ; ne pas re-formater le numéro dans le `href`.

- [x] **Task 4 — Cache offline Serwist** (AC: 4)
  - [ ] `sw/index.ts` : étendre le matcher de la `RuntimeCaching` `durable-content` (créée en 3.2) pour couvrir `/[locale]/community/numeros-utiles` (+ payload RSC). Si 3.2 a borné le matcher au seul Guide, élargir le pattern aux routes durables (`/community/(guide|numeros-utiles)`). StaleWhileRevalidate, 24h. Tester en `dev:webpack`.

- [x] **Task 5 — i18n `community.numerosUtiles` + tuile home** (AC: 1, 2, 3)
  - [ ] `messages/fr.json` namespace `community.numerosUtiles` : `title` (« Numéros utiles »), `intro`, `categories.{securite,syndic,urgences,sante,autre}` (« Sécurité », « Syndic », « Urgences », « Santé », « Autre »), `call` (« Appeler {label} »), `empty` (« Aucun numéro pour le moment »). Tonalité tutoiement.
  - [ ] Ajouter la **tuile Numéros utiles** sur la home (`community.home.tiles.numeros` + lien dans `app/[locale]/community/page.tsx`, **à côté** de la tuile Guide ajoutée en 3.2 — préserver la grille).
  - [ ] `messages/ar.json` : mêmes clés en **stub** (structure parallèle).

- [x] **Task 6 — Tests** (AC: 1, 2, 3, 6)
  - [ ] `tests/numeros/numeros-list.test.tsx` (jsdom, `<NextIntlClientProvider>`, mock data layer) : rend les catégories non vides ; chaque entrée a un `<a href="tel:+212…">` ; note rendue si présente ; fallback FR de note en AR ; état vide si data layer renvoie `[]`.
  - [ ] `tests/rls.test.ts` : étendre — un résident d'une **autre** résidence ne `SELECT` pas l'entrée `useful_numbers` seedée (réutiliser les seeds du block Epic 3 de 3.1).

## Dev Notes

> **Stack & conventions** : identiques 3.2 (Next.js 16 RSC, Supabase session-client + RLS, next-intl, Vitest jsdom). 3.3 = story **applicative de lecture** la plus courte de l'Epic 3 — **aucune** migration, **aucune** dépendance nouvelle.

### §Décisions (points tranchés)

1. **D1 — Aucune migration.** `useful_numbers` (+ enum `useful_number_category`, RLS résident, grants co_mod) **existe** (3.1). Pas de FTS (pas de recherche — accès catégorie). `types.generated.ts` couvre déjà la table → pas de `gen:types`. [tranché]
2. **D2 — Réutiliser `<CallButton>` (2.3), ne pas réinventer.** L'action `tel:` lien-natif sans modal + cible ≥ 56px existe pour la fiche artisan. Soit le composant est déjà générique (import direct), soit on l'extrait en `components/content/call-button.tsx` partagé (refacto minimal, fiche artisan inchangée fonctionnellement). [tranché]
3. **D3 — Numéro affiché en `dir="ltr"` même en RTL.** Un numéro de téléphone ne s'inverse pas en arabe ; encapsuler la chaîne du numéro dans un span `dir="ltr"` (CSS logical properties pour le reste, NFR45). [tranché]
4. **D4 — Pas de deep-link par entrée.** FR36 cite « page numéros utiles » comme entité canonique, pas l'entrée individuelle. La page entière `/numeros-utiles` est la cible (Epic 6). Pas de `slug` sur `useful_numbers` (cohérent 3.1). [tranché]
5. **D5 — Note = fallback FR silencieux (pas de badge).** Contrairement au corps du Guide (badge « Non traduit » FR48), la note est un complément court → fallback FR sans badge, pour ne pas alourdir l'UI d'accès rapide. [tranché]

### §Sécurité (NFR21 / AR17)

- **Lecture client session uniquement** : RLS `useful_numbers_resident_select_residence` (3.1) scope la résidence, exclut `deleted_at`. Jamais de `createAdminClient`.
- **`tel:` href** : `phone_e164` provient du schéma (format E.164 imposé à l'écriture co_mod 3.5) ; ne pas concaténer d'input utilisateur. Pas de surface d'injection (lecture seule).
- Aucune donnée PII loggée (les numéros sont du contenu communautaire public intra-résidence, pas des données perso au sens RGPD strict — mais éviter de les logger quand même, cf. `lib/logger.ts` strip `phone`).

### §Réutilisation directe (ne PAS réinventer)

- **Schéma** : `supabase/migrations/20260623090000_durable_content_schema.sql` (3.1) — `useful_numbers`, `useful_number_category`, RLS résident.
- **Bouton appel `tel:`** : `app/[locale]/community/artisan/[slug]/_components/call-button.tsx` (2.3) + libellé i18n `community.artisan.call` comme modèle.
- **Data layer** : `app/[locale]/community/annuaire/data.ts` / fiche `data.ts` (`cache()`, `force-dynamic`, RLS-scopé).
- **UI** : `<PageContainer>`, `<AppHeader>`, cartes borderless v2 (`artisan-card.tsx` comme référence de style), skeletons `loading.tsx`.
- **i18n** : `community.*` namespace existant ; const d'ordre dans `lib/content/`.
- **SW** : `RuntimeCaching` `durable-content` de 3.2 (élargir le matcher).

### §Gotchas (appris des stories 2.2-2.6 / 3.2)

- Serwist KO sous Turbopack dev → offline testé en `pnpm dev:webpack`.
- `ar.json` reste structurellement parallèle même en stub.
- Cible tactile : NFR36 = 48px plancher, mais l'épic 3.3 demande **≥ 56px** sur « Appeler » (action prioritaire) → 56px gagne.
- Ne pas re-formater le numéro dans `tel:` (le `+` E.164 est valide tel quel).
- Préserver le comportement du `<CallButton>` sur la fiche artisan si on l'extrait (sticky / non-sticky selon contexte → passer une prop `variant` plutôt que dupliquer).

### Project Structure Notes

- **NEW** : `app/[locale]/community/numeros-utiles/{page,data,loading,error}.tsx` + `_components/number-card.tsx` ; `lib/content/useful-numbers.ts` (const ordre) ; éventuel `components/content/call-button.tsx` (si extraction) ; `tests/numeros/*`.
- **UPDATE** : `sw/index.ts` (matcher durable-content élargi), `app/[locale]/community/page.tsx` (tuile Numéros), `messages/{fr,ar}.json` (`community.numerosUtiles` + tuile), éventuellement `app/[locale]/community/artisan/[slug]/page.tsx`/`_components/call-button.tsx` (si extraction du bouton partagé).
- **AUCUNE** migration, **AUCUN** `gen:types`, **AUCUNE** dépendance nouvelle.

### References

- [Source: epics.md#Story-3.3] — AC verbatim (l.1192-1218), FR24.
- [Source: prd.md] — FR24 (l.917), FR36 (l.938, « page numéros utiles »), FR48 (l.961), NFR8 (l.984), NFR36 (l.1024), NFR37 (l.1025), NFR40 (l.1028), NFR40b (l.1029), NFR45 (l.1037).
- [Source: architecture.md] — module Numéros utiles (Contenu durable FR23-26, l.32), F8/PWA cache offline (l.329).
- [Source: 3-1-…schema-contenu-durable…md] — `useful_numbers`, RLS, enum catégorie.
- [Source: 3-2-…guide…md] — `RuntimeCaching` `durable-content` (à élargir), const d'ordre dans `lib/content/`.
- [Source: app/[locale]/community/artisan/[slug]/\_components/call-button.tsx] — bouton `tel:` (2.3, réutilisé/extrait).
- [Source: app/[locale]/community/annuaire/data.ts] — pattern data layer `cache()` + RLS.
- [Source: sw/index.ts] — `annuaireCache` runtimeCaching (modèle).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev autonome Epic 3, 2026-06-20).

### Debug Log References

- Aucune migration, aucun `gen:types` (D1). `pnpm typecheck` ✅, `pnpm lint` ✅ (0 erreur), `pnpm test` → 349 passed (NumberCard + CallButton inline ; le test fiche artisan 2.3 reste vert après extraction), `pnpm test:rls` → block Epic 3 **9/9 verts** (test i useful_numbers cross-résidence ; 1 échec pré-existant `moderation_log` hors-périmètre).

### Completion Notes List

- **CallButton extrait + partagé (D2)** : `components/content/call-button.tsx` générique avec prop `variant` (`sticky` fiche / `inline` carte numéro), garde E.164, ≥56px (`min-h-touch-lg`). La fiche artisan (`artisan/[slug]/_components/call-button.tsx`) devient un **wrapper fin** conservant son API `{ name, phoneE164 }` + i18n `community.artisan` → **le test fiche 2.3 reste inchangé et vert** (pas de régression). Pas de duplication.
- Numéro affiché en `dir="ltr"` (D3) même en RTL ; format MA lisible. Bouton « Appeler » visible court + `aria-label` « Appeler {label} » complet (a11y).
- Note = fallback FR silencieux **sans badge** (D5) ; le badge « Non traduit » reste réservé au corps Guide (FR48).
- SW : le matcher `durable-content` (créé en 3.2) couvre **déjà** `numeros-utiles` (regex `/community/(guide|numeros-utiles)`) → aucune modif SW requise ici.
- Home : tuile Numéros utiles ajoutée à la grille (préserve Annuaire + Guide).
- i18n `community.numerosUtiles` + `errors.numerosUtiles` (fr) ; `ar.json` stub parallèle. `tel:` jamais reformaté (le `+` E.164 passe tel quel).

### File List

- **NEW** `components/content/call-button.tsx` (CallButton partagé sticky/inline)
- **NEW** `lib/content/useful-numbers.ts` (`USEFUL_NUMBER_CATEGORY_ORDER`)
- **NEW** `app/[locale]/community/numeros-utiles/{page,data,loading,error}.tsx` + `_components/number-card.tsx`
- **NEW** `tests/numeros/numeros-list.test.tsx`
- **UPDATE** `app/[locale]/community/artisan/[slug]/_components/call-button.tsx` (wrapper → CallButton partagé)
- **UPDATE** `app/[locale]/community/page.tsx` (tuile Numéros), `messages/{fr,ar}.json` (`community.numerosUtiles`, `errors.numerosUtiles`, tuile), `tests/rls.test.ts` (seed + test i)

### Change Log

| Date       | Version | Description                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-19 | 0.1     | Création story 3.3 (context engine). Lecture Numéros utiles sur schéma 3.1 : liste groupée par catégorie, appel 1-tap `tel:` (réutilisation `<CallButton>` 2.3, ≥56px, pas de modal), notes contextuelles fallback FR, cache offline (matcher durable-content élargi), `dir=ltr` sur numéros en RTL, i18n, tuile home, tests. Aucune migration. Status → ready-for-dev. |
