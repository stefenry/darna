# Story 4.5: Cron auto-expiration alertes & bons plans

Status: done

> ⚠️ **2 points structurants** : (1) **étend** le cron existant `purge-expired` (1.9) déjà déclaré dans `vercel.json` (`0 3 * * *`) + protégé Bearer ; (2) soft-delete atomique `UPDATE … WHERE deleted_at IS NULL … RETURNING` → `deleted_by` reste NULL (acteur système, pas de JWT) + `moderation_log content_expired` par item.

## Story

As a **solo dev**,
I want **a cron that soft-deletes expired alertes and tips**,
so that **the feed and storage stay clean without manual intervention.**

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 4.5 » (l. 1396-1416). FR28, AR19, AR39, NFR55.

1. **AC1 — Soft-delete.** Cron `purge-expired` (daily 03:00 UTC) : `alerts`+`tips` où `expires_at < now() AND deleted_at IS NULL` → `deleted_at=now()`, `deleted_by=NULL` (système), `deletion_reason='auto_expiration'`.
2. **AC2 — Logs.** Entrées structurées `alerts.auto_expired` / `tips.auto_expired` avec compteurs (`lib/logger.ts`).
3. **AC3 — Auth.** Sans Bearer token → HTTP 401 (AR39).
4. **AC4 — Audit.** Items soft-deleted visibles en requête `moderation_log` (audit) mais PAS dans le feed.

## Tasks / Subtasks

- [x] **Task 1 — Helper** `expireEphemeral(admin, table, targetKind, logEvent)` — UPDATE atomique `.is('deleted_at', null).lt('expires_at', now).select()` → lignes transitionnées.
- [x] **Task 2 — Audit** — `moderation_log content_expired` par item retourné (`actor_id=null`, `reason='auto_expiration'`) ; log d'erreur si insert échoue.
- [x] **Task 3 — Intégration** — appel pour `alerts` puis `tips` après la purge users/tokens ; compteurs ajoutés au log `cron.purge_completed` + à la réponse JSON.
- [x] **Task 4 — Tests** — `tests/cron/purge-expired.test.ts` : soft-delete + compteurs + `content_expired` + events ; rien d'expiré → 0 + pas de moderation_log ; 401 déjà couvert.

## Dev Notes

### §Décisions

1. **D1 — Extension du cron existant** plutôt qu'une nouvelle route : `purge-expired` est déjà déclaré + sécurisé (1.9). Une seule passe quotidienne. [tranché]
2. **D2 — `deleted_by` NULL via trigger.** Le client admin (service_role, sans JWT) → `auth.uid()` NULL dans `enforce_deleted_by_actor` → `deleted_by` reste NULL (acteur système, AC1). [tranché]
3. **D3 — UPDATE … RETURNING** (vs SELECT puis UPDATE) : atomique, évite la race, ne loggue QUE les lignes réellement transitionnées (pas d'orphelins). [tranché]
4. **D4 — `content_expired` par item** (acteur système) : satisfait « visible en moderation_log » (AC4). Volume faible (résidence 150 villas). [tranché]

### §Sécurité

- Bearer `CRON_SECRET` (AR39) — inchangé. Items soft-deleted invisibles au feed (filtre `expires_at > now()` + `deleted_at IS NULL`).

### §Réutilisation

- `createAdminClient`, `log`, pattern auth Bearer + structure du cron (`weekly-backup`, user purge 1.9).

### Project Structure Notes

- **UPDATE** : `app/api/cron/purge-expired/route.ts` (helper + 2 appels + compteurs). `vercel.json` inchangé (schedule déjà présent).

### References

- [Source: epics.md#Story-4.5] ; [Source: app/api/cron/purge-expired/route.ts] (pattern existant).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (2026-06-20).

### Completion Notes List

- Le `CHECK expires_at > created_at` empêche de SEEDER un item déjà expiré sans antidater `created_at` — pris en compte dans le test RLS (created_at J-2, expires_at J-1).
- Réponse cron enrichie : `{ purged, tokensPurged, alertsExpired, tipsExpired }`.

### File List

- **UPDATE** `app/api/cron/purge-expired/route.ts`
- **UPDATE** `tests/cron/purge-expired.test.ts`

### Change Log

| Date       | Version | Description                                |
| ---------- | ------- | ------------------------------------------ |
| 2026-06-20 | 0.1     | Auto-expiration alerts/tips (dev autonome) |
