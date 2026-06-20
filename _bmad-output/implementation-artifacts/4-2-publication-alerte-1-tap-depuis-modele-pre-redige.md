# Story 4.2: Publication alerte 1-tap depuis modèle pré-rédigé

Status: review

> ⚠️ **2 points structurants** : (1) flux 2 étapes dans un seul client component (grille modèles ≥56×56 → formulaire pré-rempli) ; (2) `expires_at = now() + duration` calculé **côté serveur** ; audit `alert_created` par trigger (4.1), pas dans l'action.

## Story

As a **resident**,
I want **to publish an alerte from a pre-written template in essentially one tap**,
so that **I share useful info (water cut, lost dog) without effort or text editing.**

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 4.2 » (l. 1312-1340). FR27, NFR36, NFR40, AR19.

1. **AC1 — Grille modèles.** `/(community)/alertes/nouveau` affiche les cartes modèles (icône + label localisé), tap area ≥ 56×56px.
2. **AC2 — Formulaire pré-rempli.** Tap modèle → corps + durée par défaut pré-remplis ; corps éditable (optionnel) ; durée radio (24h/72h/7j) ; un seul CTA « Publier ».
3. **AC3 — createAlert.** Crée `alerts` avec `expires_at = now() + duration_hours`, `created_by = auth.uid()`, `slug = slugify(title_fr)-shortId`.
4. **AC4 — Modèle « Autre ».** Titre + corps libres (FR + AR éditables), durée radio.
5. **AC5 — Perf.** Publication en ≤ 30s depuis chargement (NFR40).
6. **AC6 — Audit.** Publication auditable via `moderation_log` `alert_created`, sans PII au-delà de `user_id` (AR19).

## Tasks / Subtasks

- [x] **Task 1 — Page** `alertes/nouveau/page.tsx` — fetch `alert_templates` (RLS), passe au client form ; back + intro.
- [x] **Task 2 — Form client** `alert-publish-form.tsx` — étape grille (icônes lucide, `min-h-touch-lg`) → étape form (`useActionState`, durée radio défaut = template, version AR repliée `<details>`, CTA collant).
- [x] **Task 3 — Server Action** `createAlert` — `requireResident` + rate-limit (10/h), zod, résidence+rôle depuis `users`, `template_id` depuis clé, `expires_at` calculé, INSERT session, `revalidatePath`.
- [x] **Task 4 — Helpers** `lib/slug/short-id.ts` (`shortId`), `buildEphemeralSlug`, `zCreateAlert` + `mapAlertFieldError`.
- [x] **Task 5 — i18n + tile home** + erreurs `errors.alert.*`.
- [x] **Task 6 — Tests** `tests/community/ephemeral-actions.test.ts` (createAlert : OK, forbidden, durée KO, titre vide, rate-limit).

## Dev Notes

### §Décisions

1. **D1 — INSERT session + trigger audit** (pas de RPC create). L'action calcule `expires_at`/`slug`/`template_id`, l'INSERT passe la RLS, le trigger 4.1 écrit `alert_created`. Plus simple, audit garanti. [tranché]
2. **D2 — `shortId` aléatoire** (`randomBytes`, [a-z0-9]) plutôt que collision séquentielle DB : contenu éphémère à fort churn, pas de lookup. [tranché]
3. **D3 — Version AR repliée.** MVP FR-only : champs AR optionnels dans un `<details>` (structure bilingue prête, friction nulle). [tranché]
4. **D4 — Notification opt-in = plumbing Epic 7.** Aucune programmation ici (les dispatchers liront `notifications_prefs`). [tranché]

### §Sécurité

- `residence_id`/`role` relus depuis `users` (review 2.4 P7 — `requireResident` ne gate pas le rôle) ; un `demandeur` est refusé.
- Rate-limit `alert-create:{userId}` (anti-spam). `created_by` jamais posé client (default `auth.uid()`).

### §Réutilisation

- `requireResident`, `checkLimit`, `log`, pattern `useActionState` (artisan create 2.4), `pickLocalized`.

### Project Structure Notes

- **NEW** : `alertes/nouveau/{page.tsx,actions.ts,_components/alert-publish-form.tsx}`, `lib/slug/short-id.ts`, `lib/validation/ephemeral-content.ts`, `lib/content/ephemeral.ts`.
- **UPDATE** : `community/page.tsx` (tile), `messages/{fr,ar}.json`.

### References

- [Source: epics.md#Story-4.2] ; [Source: app/[locale]/community/annuaire/nouveau/actions.ts] (pattern create résident).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (2026-06-20).

### Completion Notes List

- Flux 1-tap : grille → form pré-rempli, un seul submit. `expires_at` calculé serveur (client ne contrôle pas).
- Build : route `/[locale]/community/alertes/nouveau` générée OK.

### File List

- **NEW** `app/[locale]/community/alertes/nouveau/page.tsx`
- **NEW** `app/[locale]/community/alertes/nouveau/actions.ts`
- **NEW** `app/[locale]/community/alertes/nouveau/_components/alert-publish-form.tsx`
- **NEW** `lib/slug/short-id.ts`, `lib/validation/ephemeral-content.ts`, `lib/content/ephemeral.ts`
- **NEW** `tests/community/ephemeral-actions.test.ts`, `tests/lib/ephemeral.test.ts`
- **UPDATE** `app/[locale]/community/page.tsx`, `messages/fr.json`, `messages/ar.json`

### Change Log

| Date       | Version | Description                                     |
| ---------- | ------- | ----------------------------------------------- |
| 2026-06-20 | 0.1     | Publication alerte depuis modèle (dev autonome) |
