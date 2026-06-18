# 0006 — Suppression compte : soft-delete + anonymisation en cascade + purge J+7

## Context

FR11 / NFR18 : droit à l'effacement RGPD sous 7 jours, avec anonymisation des contributions
(l'audit de modération doit rester traçable mais sans PII). Tension dans la spec : l'epic décrit
une suppression « immédiate » mais la copie utilisateur et NFR18 disent « purgées sous 7 jours »

- un cron `purge-expired` dédié.

## Decision

Modèle **soft-delete immédiat + purge dure à J+7** :

1. **Sur demande** (`deleteAccount` → RPC `request_account_deletion`, `SECURITY DEFINER`,
   `auth.uid()`) : `users`/`profiles` soft-deleted (`deleted_at`), `display_name` anonymisé
   (« Voisin supprimé »), trace `moderation_log` `user_deleted`, puis `signOut({scope:'global'})`.
   Le compte devient inaccessible immédiatement (+ guard re-login `isAccountDeleted`).
2. **À J+7** (cron `purge-expired`, daily 03:00 UTC) : `auth.admin.deleteUser()` → **cascade FK**
   hard-delete `users`/`profiles`/`admission_requests`/`notifications_prefs` + `SET NULL` sur
   `moderation_log.actor_id` (la trace devient anonyme). Log `purge_completed`.

L'anonymisation des contributions epic 2-4 (`ratings`, `alert_comments`, `guide_entries`) via
`user_id = NULL` rejoindra ce flux quand ces tables existeront (aujourd'hui : seul
`moderation_log` est concerné, auto-nullé par FK).

## Consequences

- ✅ Fenêtre de grâce 7j (récupération possible) + audit préservé anonymisé (transparence FR33).
- ✅ La cascade FK fait l'essentiel du hard-delete (un seul `deleteUser`).
- ⚠️ Un compte soft-deleted ne doit pas se reconnecter pendant la grâce → guard dans
  `/auth/confirm` (story 1.9). RPO de la purge = quotidien.

## Status

Accepted — Gap #5. Implémenté story 1.9 (D1 validé).
