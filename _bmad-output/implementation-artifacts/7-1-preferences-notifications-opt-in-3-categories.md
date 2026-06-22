# Story 7.1: Préférences notifications opt-in 3 catégories

Status: done

## Story

As a **resident**, I want **to enable or disable each of the 3 notification categories independently**, so that **I master what reaches my inbox.**

## Acceptance Criteria

1. **AC1 — Table déjà provisionnée (1.3).** `notifications_prefs` existe (PK `user_id`, `alerts_urgentes_enabled` def true, `nouvelles_entrees_annuaire_enabled` def false, `activite_contributions_enabled` def true, `updated_at`) ; RLS self SELECT/UPDATE. Cette story n'ajoute que l'UI.
2. **AC2 — 3 toggles libellés.** `/community/profil/parametres` affiche 3 cases à cocher avec label + description localisés : (a) Alertes urgentes, (b) Nouvelles entrées annuaire (7 j), (c) Activité sur mes contributions (FR40).
3. **AC3 — Persistance optimiste.** Toggle off → UI immédiate, `notifications_prefs.<cat>_enabled=false`, rollback + message d'erreur si l'action serveur échoue.
4. **AC4 — Défauts.** Sans visite paramètres : alertes ON, annuaire OFF (anti-spam), activité ON (lus depuis la row, fallback aux défauts FR40 si absente).
5. **AC5 — A11y.** Toggles au clavier (`Tab`/`Space` via Radix Checkbox), RTL correct (flex logique), `prefers-reduced-motion` respecté (aucune animation) (NFR37/39/45).

## Dev Notes

- **D1 — Composant dédié `NotificationPrefsForm`** plutôt que d'élargir `SettingsForm` (séparation claire prefs profil vs notifs). UI optimiste + `useTransition`, rollback sur échec.
- **D2 — Server Action `updateNotificationPrefs`** (`profil/actions.ts`) : `requireResident` → `zNotificationPrefs` (3 booléens) → update via client SSR session (RLS self `notifications_prefs_resident_update_self`) → log `profil.notifications_updated`. Pas d'admin client.
- **D3 — Row manquante = warn, pas d'erreur UX.** La row est garantie par le trigger `trg_auth_users_after_insert` (1.3) ; 0 ligne updatée → `profil.notifications_no_row` warn. La page applique les défauts FR40 côté lecture.
- **D4 — Fallback FR des labels AR** via `deepMerge` (clés AR vides → FR). Clés `profil.notifications.*` ajoutées en parité fr/ar.

## File List

- **NEW** `app/[locale]/community/profil/_components/notification-prefs-form.tsx`
- **NEW** `tests/profil/notification-prefs-actions.test.ts`
- **UPDATE** `app/[locale]/community/profil/actions.ts` (`updateNotificationPrefs`)
- **UPDATE** `app/[locale]/community/profil/parametres/page.tsx` (fetch prefs + render form)
- **UPDATE** `lib/validation/profile.ts` (`zNotificationPrefs` + `notifications_failed` error key)
- **UPDATE** `messages/{fr,ar}.json` (`profil.notifications.*`, `errors.profil.notifications_failed`)

## Change Log

| Date       | Version | Description                                |
| ---------- | ------- | ------------------------------------------ |
| 2026-06-22 | 0.1     | UI 3 toggles opt-in notifications + action |
