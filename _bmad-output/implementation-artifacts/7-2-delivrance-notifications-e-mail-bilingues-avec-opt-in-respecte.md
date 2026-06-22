# Story 7.2: Délivrance notifications e-mail bilingues avec opt-in respecté

Status: done

## Story

As **the system**, I want **to deliver e-mail notifications respecting opt-in preferences and locale**, so that **residents receive only what they want, in their language, and no marketing ever.**

## Acceptance Criteria

1. **AC1 — Dispatcher opt-in + locale.** Un événement (retrait de mon contenu, conservation d'un signalement, alerte abonnés, digest annuaire…) passe par `notifyResident`/`notifyResidentsByCategory` qui lisent `notifications_prefs` + `profiles.language` puis invoquent `lib/email/send.ts` avec le template bilingue (FR41/FR42/NFR44).
2. **AC2 — Opt-out respecté.** Destinataire opté-out de la catégorie → envoi sauté + `event: 'notification.skipped_opt_out'` (info, sans PII).
3. **AC3 — Échec d'envoi.** Erreur Brevo → `email.failed` loggé (error → GlitchTip via `lib/logger`) ; aucun retry MVP (la file Brevo gère). Le dispatcher renvoie `{ status: 'failed' }` non bloquant.
4. **AC4 — Zéro marketing.** Tous les templates de `lib/email/templates/` sont transactionnels/opt-in (FR43) — vérifié par un test qui borne l'ensemble des templates expédiés.
5. **AC5 — Web Push V1.5.** Aucun code Web Push embarqué ; `lib/notifications/web-push.ts` est un stub documenté (TODO V1.5). L'e-mail est l'unique canal actif au MVP.
6. **AC6 — Bilingue testé.** Tous les templates ont une variante `.fr.ts` + `.ar.ts` et un test Vitest vérifie que chacun rend (subject/html/text non vides + parité de clés) dans les deux locales.

## Dev Notes

- **D1 — `lib/notifications/dispatch.ts` = boundary de DÉLIVRANCE** (distincte de `send.ts`, boundary d'ENVOI). `send.ts` reste pour les e-mails essentiels non opt-in-able (magic-link, décision admission, notif co_mod, escalade juridique). Le dispatcher gate sur la catégorie + résout la locale avant de déléguer à `send.ts`.
- **D2 — Catégories → colonnes** : `alerts_urgentes`→`alerts_urgentes_enabled`, `nouvelles_entrees_annuaire`→`…_enabled`, `activite_contributions`→`…_enabled`. Défauts FR40 appliqués si la row manque.
- **D3 — Câblage modération (Story 5.3).** `removeReportedContent` (auteur) et `keepReportedContent` (reporter) routés via `notifyResident` cat. `activite_contributions` → respectent désormais l'opt-in ET la locale par profil. Cela **résout** le différé Epic 5 « Notif modération auteur/reporter en AR / locale par profil V1.5 ». L'escalade juridique garde l'envoi direct (contact externe, non opt-in-able).
- **D4 — Fan-out fourni, câblage alerte différé.** `notifyResidentsByCategory` (sélection des abonnés opt-in d'une résidence) est livré + testé. Le déclenchement par-alerte / le digest annuaire hebdo (cron) restent un hook à brancher : l'action `createAlert` (4.2) documente déjà « plumbing différé ». Volume 150 villas → fan-out séquentiel acceptable, à passer en `waitUntil`/background si la latence devient sensible.
- **D5 — E-mail destinataire** résolu via `admin.auth.admin.getUserById` (service-role), prefs/locale via tables `public` (service-role). Tout best-effort : l'appelant ne bloque jamais son flux.

## File List

- **NEW** `lib/notifications/dispatch.ts` (`notifyResident`, `notifyResidentsByCategory`)
- **NEW** `lib/notifications/web-push.ts` (stub V1.5, `WEB_PUSH_ENABLED=false`)
- **NEW** `tests/notifications/dispatch.test.ts`
- **NEW** `tests/email/templates-all-render.test.ts` (rendu FR+AR 11 templates + audit FR43)
- **UPDATE** `app/[locale]/comod/moderation/actions.ts` (auteur/reporter via dispatcher ; suppression `emailFor`)

## Change Log

| Date       | Version | Description                                                    |
| ---------- | ------- | -------------------------------------------------------------- |
| 2026-06-22 | 0.1     | Dispatcher notifications opt-in + locale, stub Web Push, tests |
