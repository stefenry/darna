# Story 5.4: Journal public sur `/transparence`

Status: done

> ⚠️ **2 points structurants** : (1) Le journal lit la vue **`moderation_log_public`** (5.1, lecture anon) — la redaction PII (display_name co_mod only, cibles `user_deleted` masquées) est garantie en base, pas dans l'UI. (2) On restreint en plus aux **actions de gouvernance** (`JOURNAL_ACTIONS`) : le cycle de vie du contenu (publication/expiration/retrait-auteur) n'est pas une décision de modération.

## Story

As a **visitor (resident or public)**,
I want **to view every moderation action ever taken in chronological order**,
so that **I can audit the platform's governance and trust its impartiality.**

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 5.4 » (l. 1524-1554). FR33, CC #19, NFR35/40/45.

1. **AC1 — Liste chrono publique.** `/transparence` (RSC, route publique) : events plus récents d'abord, date+heure, event en langage clair localisé, display_name co_mod visible.
2. **AC2 — Redaction PII.** `user_deleted` → « Suppression d'un compte utilisateur » sans nom/e-mail (via vue `moderation_log_public`, CC #19).
3. **AC3 — Filtres server-side.** Filtre type d'événement + plage de dates → la requête se met à jour côté serveur (GET searchParams).
4. **AC4 — Pagination incrémentale.** Infinite-scroll (IntersectionObserver + bouton « Charger plus ») via Server Action keyset (created_at).
5. **AC5 — A11y.** Lisible (events ≥ 16px, contraste élevé, hiérarchie claire) (NFR35/40).
6. **AC6 — RTL + placeholder 8.2.** RTL hérité du shell ; section « Comment vos données sont protégées » (placeholder Story 8.2).

### AC additionnel (régression)

7. **AC7 — Tests.** `events.test.ts` (whitelist gouvernance, exclusion report_opened/consent/lifecycle, catégories filtre).

## Tasks / Subtasks

- [x] **Task 1 — Events** (`lib/transparency/events.ts`) — `JOURNAL_ACTIONS` (whitelist gouvernance), `JOURNAL_FILTERS` (catégories), `isJournalAction`, `actionsForFilter`. + tests.
- [x] **Task 2 — Data** (`lib/transparency/journal.ts`) — `fetchJournalPage(filters, cursor)` : vue `moderation_log_public`, `.in(action)` whitelist, filtres date, pagination keyset desc (PAGE+1 sonde nextCursor).
- [x] **Task 3 — Server Action** (`transparence/actions.ts`) — `loadMoreJournal(filters, cursor)` (lecture publique).
- [x] **Task 4 — Page** — RSC `transparence/page.tsx` : header + form filtres GET + `JournalFeed` + section placeholder 8.2.
- [x] **Task 5 — Feed client** (`_components/journal-feed.tsx`) — rendu `<ol>` (date localisée, label langage clair, actor), IntersectionObserver + « Charger plus ».
- [x] **Task 6 — i18n** — `transparency.journal.*` (intro, filtres, events, targets) + `transparency.dataProtection.*`.

## Dev Notes

### §Décisions

1. **D1 — Whitelist gouvernance.** La vue 5.1 expose déjà toutes les actions sauf consent + report_opened ; on restreint encore aux décisions de modération (retraits, conservations, escalades, admissions, suppressions compte, purge). Le bruit lifecycle (alert_created…) est exclu. [tranché]
2. **D2 — Pagination keyset (vs offset).** Curseur = created_at du dernier item → stable si de nouveaux events s'insèrent pendant le scroll. PAGE+1 lignes pour détecter la suite sans COUNT. [tranché]
3. **D3 — Incrémental client (Server Action) vs Suspense streaming.** Infinite-scroll via IntersectionObserver + Server Action `loadMoreJournal` (append client). Équivalent fonctionnel au streaming Suspense, plus simple/testable. [tranché]
4. **D4 — Redaction en base, pas en UI.** Aucune logique de masquage PII côté page : la vue `moderation_log_public` est l'unique source (defense-in-depth — impossible de fuiter en oubliant un champ côté rendu). [tranché]
5. **D5 — Section données = placeholder.** « Comment vos données sont protégées » = texte court placeholder (contenu complet Story 8.2). [tranché]

### §Sécurité / Confidentialité

- Lecture publique : la vue ne renvoie aucune colonne PII (pas d'`actor_id`/email ; display_name co_mod only). `user_deleted` : target masquée par la vue.
- Filtres : `filter` validé contre `JOURNAL_FILTERS`, dates validées `^\d{4}-\d{2}-\d{2}$` avant injection dans la requête (anti-injection paramétrée Supabase de toute façon).

### §Réutilisation directe

- Vue `moderation_log_public` (5.1), `PageContainer`, pattern RSC public (manifesto/legal), `createClient()` SSR (anon-compatible).

### Project Structure Notes

- **NEW** : `lib/transparency/{events,journal}.ts` (+events.test), `transparence/actions.ts`, `transparence/_components/journal-feed.tsx`.
- **UPDATE** : `transparence/page.tsx` (stub → journal), `messages/fr.json`.

### References

- [Source: epics.md#Story-5.4] — AC verbatim.
- [Source: supabase/migrations/20260701090100_moderation_reports_schema.sql] — vue moderation_log_public.

## Dev Agent Record

### Completion Notes

- Journal public + filtres + infinite-scroll + placeholder 8.2. typecheck ✓, lint ✓, 429 unit ✓ (+4 events).
- Redaction PII déléguée à la vue (5.1) — testée côté RLS (5.1 test j).

### File List

- `lib/transparency/events.ts` (+test), `lib/transparency/journal.ts` (NEW)
- `app/[locale]/(public)/transparence/actions.ts`, `_components/journal-feed.tsx` (NEW)
- `app/[locale]/(public)/transparence/page.tsx` (UPDATE — stub → journal)
- `messages/fr.json` (UPDATE)

### Change Log

- 2026-06-20 — Story 5.4 implémentée (journal public de modération sur /transparence).
