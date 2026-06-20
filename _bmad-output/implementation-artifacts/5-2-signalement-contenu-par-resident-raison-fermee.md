# Story 5.2: Signalement contenu par résident (raison fermée)

Status: review

> ⚠️ **2 points structurants** : (1) Le bouton « Signaler » est un **composant générique** `ReportButton` (targetType/targetId) monté sur les **6 surfaces** existantes (artisan, avis/rating, alerte, bon plan, entrée guide, numéro utile). (2) L'idempotence + le rate-limit reposent sur le schéma 5.1 (index UNIQUE partiel → 23505 ⇒ `duplicate`) et `checkLimit('report:{uid}', 3, 3600)` ; l'audit `report_opened` est écrit par le **trigger** 5.1 (pas par la Server Action).

## Story

As a **resident**,
I want **to report any content I find inappropriate with a fixed reason from a closed list**,
so that **the co-mods can review and act within 24h.**

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 5.2 » (l. 1456-1486). FR31, FR42, AR31. Précisions techniques en Dev Notes.

1. **AC1 — Action visible.** « Signaler » visible sous tout contenu (artisan, avis, alerte, bon plan, entrée guide, numéro utile) pour un résident authentifié.
2. **AC2 — Dialog raison fermée.** Dropdown motif fermé (Diffamation, Info erronée, Harcèlement, Spam, Hors-charte, Autre) + champ note optionnel 200c.
3. **AC3 — submitReport().** Crée une ligne `reports` (user_id + target_type + target_id + reason + `state='open'`) ; tous les co_mod reçoivent un e-mail « Nouveau signalement » (FR42) ; `moderation_log` enregistre `report.opened` (payload redacted — via trigger 5.1).
4. **AC4 — Idempotence.** 2e signalement de la même cible → `errors.report.duplicate` (un open report par (reporter, cible)).
5. **AC5 — Rate-limit.** 4e signalement en 1h → 429 / `rate_limited` (AR31).
6. **AC6 — Confidentialité.** Le reporter ne voit jamais qui a signalé quoi — ses reports visibles seulement par lui et les co_mod (RLS 5.1).

### AC additionnel (régression)

7. **AC7 — Tests.** Schéma Zod `report.ts` (8 tests : enums fermés, uuid, sanitize note, troncature, whitelist erreurs).

## Tasks / Subtasks

- [x] **Task 1 — Validation** (`lib/validation/report.ts`) — `zSubmitReport` (enums fermés, `target_id` uuid, `note_text` sanitize+200), constants `REPORT_REASONS`/`REPORT_TARGET_TYPES`/`SIGNALABLE_TARGET_TYPES`, mapping erreurs whitelistées (AR17). + tests.
- [x] **Task 2 — Server Action** (`app/actions/report-submit.ts`) — `submitReport` : `auth.getUser` (uid + residence_id JWT), Zod, `checkLimit('report:{uid}',3,3600)`, INSERT client authentifié (RLS), 23505⇒`duplicate`, notif co_mods Brevo, logs structurés, Result union.
- [x] **Task 3 — E-mail** (`report-notify-comod.fr/.ar`) — « Nouveau signalement : [motif] sur [type] » + note + lien queue ; enregistré dans `send.ts`.
- [x] **Task 4 — UI générique** (`components/content/report-button.tsx`) — divulgation inline (Escape/focus), dropdown motif + note 200c, états submitting/success, i18n.
- [x] **Task 5 — Montage 6 surfaces** — artisan fiche (`artisan`), `comments-list` (`rating`), alerte detail (`alert`), bon plan detail (`tip`), entrée guide (`guide_entry`, + `id` ajouté au fetch), number-card (`useful_number`).
- [x] **Task 6 — i18n** — `community.report.*` (dialog, motifs) + `errors.report.*` (duplicate, rate_limited, unauthenticated, submit_failed, champs) dans `fr.json`.

## Dev Notes

### §Décisions

1. **D1 — Composant générique vs par-surface.** Un seul `ReportButton(targetType, targetId)` monté partout (vs N composants). Surfaces non-propriétaire uniquement (on cache « Signaler » à l'auteur de son propre contenu, qui voit déjà « Retirer »). [tranché]
2. **D2 — INSERT client authentifié (pas admin).** Le reporter insère via `createClient()` (RLS `reports_reporter_insert_own` + grant column-level, `reporter_id` default `auth.uid()`). Le trigger 5.1 écrit `moderation_log`. La Server Action n'utilise le service-role pour RIEN (pas besoin). [tranché]
3. **D3 — Rate-limit par reporter (pas IP).** Reporter authentifié → clé `report:{uid}` (3/h). Plus juste que l'IP (admission 1.7 = visiteur anonyme → IP). [tranché]
4. **D4 — Idempotence déléguée à la DB.** Pas de pré-check applicatif : on tente l'INSERT, 23505 (index partiel 5.1) ⇒ `duplicate` (anti-race, 1 round-trip). [tranché]
5. **D5 — Notif co_mods via `INITIAL_COMOD_EMAILS`.** Réutilise le CSV env (comme admission 1.7) — résolution par-résidence des co_mod différée (MVP mono-résidence Darna). [tranché]
6. **D6 — `alert_comment` non câblé.** Présent dans l'enum (forward-compat 6.4) mais absent de `SIGNALABLE_TARGET_TYPES` tant que les commentaires d'alerte n'existent pas. [tranché]

### §Sécurité

- AR17 : seules des clés i18n whitelistées renvoyées au client (jamais le message Zod). Note sanitisée (NFC + strip bidi/control) avant insert.
- Le `note_text` (PII potentielle) n'atterrit jamais dans `moderation_log` (trigger 5.1 ne copie que `{target_type, reason}`).
- Confidentialité reporter garantie par RLS 5.1 (`reports_reporter_select_own`).

### §Réutilisation directe

- `sanitizeUserText` (2.8), `checkLimit`/`tooManyRequests` (1.10b), `sendTransactionalEmail` boundary (1.7), pattern Server Action + `log()` (admission-submit 1.7), divulgation inline `retire-own-button` (4.3).

### Project Structure Notes

- **NEW** : `lib/validation/report.ts`(+test), `app/actions/report-submit.ts`, `components/content/report-button.tsx`, `lib/email/templates/report-notify-comod.fr/.ar.ts`.
- **UPDATE** : `lib/email/send.ts` (template), `messages/fr.json` (report ns), 6 surfaces (artisan page + comments-list + alerte/bon-plan detail + guide page&data + number-card).

### References

- [Source: epics.md#Story-5.2] — AC verbatim.
- [Source: app/actions/admission-submit.ts] — modèle Server Action + notif co_mod.
- [Source: supabase/migrations/20260701090100_moderation_reports_schema.sql] — RLS reports + trigger report_opened.

## Dev Agent Record

### Completion Notes

- 6 surfaces câblées (artisan/rating/alert/tip/guide_entry/useful_number).
- Idempotence + rate-limit vérifiés (schéma 5.1, tests RLS Epic 5).
- typecheck ✓, lint ✓ (0 err), 418 tests unitaires ✓ (+8 report.test).

### File List

- `lib/validation/report.ts` (NEW), `lib/validation/report.test.ts` (NEW)
- `app/actions/report-submit.ts` (NEW)
- `components/content/report-button.tsx` (NEW)
- `lib/email/templates/report-notify-comod.fr.ts` / `.ar.ts` (NEW)
- `lib/email/send.ts` (UPDATE)
- `messages/fr.json` (UPDATE)
- `app/[locale]/community/artisan/[slug]/page.tsx` + `_components/comments-list.tsx` (UPDATE)
- `app/[locale]/community/alertes/[slug]/page.tsx` (UPDATE)
- `app/[locale]/community/bons-plans/[slug]/page.tsx` (UPDATE)
- `app/[locale]/community/guide/[slug]/page.tsx` + `data.ts` (UPDATE)
- `app/[locale]/community/numeros-utiles/_components/number-card.tsx` (UPDATE)

### Change Log

- 2026-06-20 — Story 5.2 implémentée (signalement contenu résident, raison fermée, 6 surfaces).
