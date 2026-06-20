# Story 4.4: Feed alertes & bons plans — tri fraîcheur

Status: done

> ⚠️ **2 points structurants** : (1) feed = fusion `alerts`+`tips` actifs, filtre `deleted_at IS NULL AND expires_at > now()` **explicite** côté serveur (la policy `author_select_own` laisserait sinon fuiter les items expirés de l'auteur) ; (2) détails sur routes distinctes (`/alertes/[slug]`, `/bons-plans/[slug]`), retrait auteur intégré.

## Story

As a **resident**,
I want **a unified feed of active alertes and non-expired tips sorted by recency**,
so that **I see what's happening in the residence at a glance.**

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 4.4 » (l. 1368-1392). FR30, NFR37, NFR39, NFR45.

1. **AC1 — Feed.** `/(community)/alertes` : items actifs (alerts + tips où `expires_at > now() AND deleted_at IS NULL`) triés `created_at DESC`, cartes localisées avec badge type (alerte 🚨 / bon plan 🎁), temps restant (« expire dans 18h »), tap-to-detail.
2. **AC2 — Détail.** Tap carte → page détail (`/alertes/[slug]` ou `/bons-plans/[slug]`) : corps complet, expiration, (👍 = Epic 6).
3. **AC3 — Expirés filtrés.** `expires_at < now()` → exclu automatiquement (requête serveur).
4. **AC4 — Empty-state.** Aucun item → « Aucune alerte active. Publier la première ? » + CTA.
5. **AC5 — A11y.** RTL-correct, navigable clavier, `prefers-reduced-motion` respecté sur transitions.

## Tasks / Subtasks

- [x] **Task 1 — Data** `alertes/data.ts` (`fetchFeed` fusion+tri, `fetchAlertBySlug`), `bons-plans/data.ts` (`fetchTipBySlug`) — filtre expiré/supprimé explicite, `cache()`.
- [x] **Task 2 — Feed page** `alertes/page.tsx` — header, CTAs publier alerte/bon plan, liste `FeedCard` ou empty-state + CTA, gestion erreur.
- [x] **Task 3 — FeedCard** (server) — badge type, chip catégorie (tips), temps restant (`timeRemaining` + i18n), badge non-traduit, `ChevronRight` RTL.
- [x] **Task 4 — Détails** `alertes/[slug]/page.tsx`, `bons-plans/[slug]/page.tsx` — slug regex guard, `notFound()`, corps `whitespace-pre-wrap`, `RetireOwnButton` si auteur.
- [x] **Task 5 — i18n** `community.alertes.*` (remaining, badge, detail, retire), `errors.alertes.fetch_failed`.

## Dev Notes

### §Décisions

1. **D1 — Filtre expiré explicite.** Malgré la policy `resident_select_active`, la policy `author_select_own` rend les items expirés de l'auteur visibles → `fetchFeed` ajoute `.is('deleted_at', null).gt('expires_at', now)` (AC3 strict). [tranché]
2. **D2 — Temps restant serveur.** `timeRemaining()` pur + `getTranslations` au render (page `force-dynamic`) → pas de client component ni hydration mismatch ; léger staleness négligeable. [tranché]
3. **D3 — Auteur générique.** « Publié par un voisin » ; la résolution pseudonyme/nommé (sous-système 2.6) et le 👍 (Epic 6) ne sont pas dupliqués ici. [tranché — voir Limitations]

### §Sécurité / A11y

- Slug guard regex `^[a-z0-9][a-z0-9-]{0,79}$` avant requête (anti round-trip + path traversal). `notFound()` si RLS filtre (expiré non-auteur).
- `rtl:rotate-180` sur chevrons/flèches, `motion-safe:transition-colors`, focus-visible, tap targets ≥ `min-h-touch`.

### Project Structure Notes

- **NEW** : `alertes/{page.tsx,data.ts,[slug]/page.tsx,_components/feed-card.tsx}`, `bons-plans/{data.ts,[slug]/page.tsx}`.

### References

- [Source: epics.md#Story-4.4] ; [Source: app/[locale]/community/guide/[slug]/page.tsx] (pattern détail/slug guard).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (2026-06-20).

### Completion Notes List

- **Limitation assumée** : auteur affiché générique ; 👍 différé Epic 6 (conforme AC). Pseudonyme nominatif = follow-up si requis.
- Build : routes feed + 2 détails générées OK.

### File List

- **NEW** `app/[locale]/community/alertes/page.tsx`, `app/[locale]/community/alertes/data.ts`
- **NEW** `app/[locale]/community/alertes/[slug]/page.tsx`
- **NEW** `app/[locale]/community/alertes/_components/feed-card.tsx`
- **NEW** `app/[locale]/community/bons-plans/data.ts`, `app/[locale]/community/bons-plans/[slug]/page.tsx`
- **UPDATE** `lib/content/ephemeral.ts` (`timeRemaining`), `messages/fr.json`, `messages/ar.json`

### Change Log

| Date       | Version | Description                          |
| ---------- | ------- | ------------------------------------ |
| 2026-06-20 | 0.1     | Feed unifié + détails (dev autonome) |
