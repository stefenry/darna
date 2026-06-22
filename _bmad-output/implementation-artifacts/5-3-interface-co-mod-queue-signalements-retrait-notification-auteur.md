# Story 5.3: Interface co-mod queue signalements + retrait + notification auteur

Status: done

> ⚠️ **3 points structurants** : (1) Le retrait soft-delete une cible **polymorphe** (6 tables) + transitionne le report + écrit l'audit, **atomiquement**, via 2 RPC SECURITY DEFINER (`moderate_remove_content` / `moderate_keep_content`) — re-check co_mod+résidence interne, garde anti-race `state='open'`. (2) Le contenu cible est résolu par `resolveTarget` (snippet queue / corps détail). (3) **Présence live différée** : la moitié « un autre co_mod consulte » de l'AC concurrence nécessite du Realtime (hors MVP) ; la partie substantielle (anti double-modération + résolution visible) est couverte par la garde `state='open'` du RPC + l'affichage de la résolution sur le détail.

## Story

As a **co-mod (Karim — Journey 5)**,
I want **a queue of open reports with full context and a one-tap remove-with-motive flow**,
so that **I can act under the 24h SLA per the moderation charter.**

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 5.3 » (l. 1488-1522). FR32, NFR17, NFR27, AR17-19.

1. **AC1 — Queue.** `/(comod)/moderation` : reports `open` triés `created_at ASC`, chacun : snippet (locale), pseudo reporter (visible co_mod only), motif, note, ancienneté.
2. **AC2 — Détail.** Contenu cible COMPLET en contexte, infos reporter + note, actions de modération antérieures sur la cible, boutons Retirer / Conserver.
3. **AC3 — Retrait.** Motif fermé (Diffamation, Info erronée, Hors-charte, Autre) + note ; cible soft-deletée (`deleted_at/by/reason`), report `closed_removed`, `moderation_log content_removed` (motif + snippet redacted), e-mail auteur « Votre contribution a été retirée — motif : […] ».
4. **AC4 — Conservation.** Report `closed_kept`, `moderation_log content_kept`, e-mail neutre reporter « signalement examiné, contenu conservé », cible reste visible.
5. **AC5 — Badge SLA.** Report ouvert > 24h de présence (7h-23h) → badge rouge « SLA dépassé » (NFR27).
6. **AC6 — Concurrence.** Si déjà résolu → la résolution est visible (le 2e co_mod ne re-modère pas → `already_resolved`). [Présence live « consulte en ce moment » = différée, cf. encadré.]
7. **AC7 — Robustesse.** Server Actions : Zod, `Result<T>`, logs structurés sans PII (AR17-19).

### AC additionnel (régression)

8. **AC8 — Tests.** RPC RLS (5 tests : not_co_mod, wrong_residence, retrait complet, already_resolved anti-race, conservation) + SLA présence (7 tests unitaires).

## Tasks / Subtasks

- [x] **Task 1 — RPC** (`20260702090000_moderation_resolve_rpc.sql`) — `moderate_remove_content` (whitelist target_type→table+colonne auteur, soft-delete idempotent, transition `state='open'` atomique, audit content_removed, retourne auteur) ; `moderate_keep_content` (closed_kept, content_kept, retourne reporter).
- [x] **Task 2 — Résolveur cible** (`lib/moderation/target-content.ts`) — `resolveTarget(locale, type, id)` (6 types) + `snippet()`.
- [x] **Task 3 — SLA** (`lib/moderation/sla.ts`) — `presenceHoursElapsed` (fenêtre 7h-23h UTC, pas horaire) + `isSlaBreached` (≥24h-présence). + tests.
- [x] **Task 4 — Server Actions** (`moderation/actions.ts`) — `removeReportedContent` / `keepReportedContent` : requireComod, Zod, RPC, notif e-mail auteur/reporter (admin getUserById + Brevo), Result.
- [x] **Task 5 — E-mails** — `content-removed-author` + `report-kept-reporter` (fr/ar) ; enregistrés `send.ts`.
- [x] **Task 6 — UI** — queue `moderation/page.tsx` (snippet, pseudo, badge SLA), détail `[id]/page.tsx` (contexte complet + actions antérieures + résolution si déjà traité), client `moderation-actions.tsx` (Retirer motif+note / Conserver note). Tuile hub co_mod.
- [x] **Task 7 — Validation + labels** — `lib/validation/moderation.ts` (`REMOVAL_MOTIVES`, notes 2000c) ; `lib/moderation/labels.ts` (libellés FR partagés, dedupe report-submit).
- [x] **Task 8 — i18n** — `comod.moderation.*` + `errors.moderation.*` + tuile.

## Dev Notes

### §Décisions

1. **D1 — RPC unique par décision.** Soft-delete polymorphe + transition report + audit = indivisibles → SECURITY DEFINER (modèle `retire_durable_entry` 3.5). Appel via client **authentifié** (auth.uid() interne) ; le RPC re-check co_mod+résidence. [tranché]
2. **D2 — Anti-race par WHERE state='open'.** La transition `update reports set state=... where id and state='open'` + `if not found → already_resolved` garantit qu'un seul co_mod résout (FR concurrence). [tranché]
3. **D3 — Auteur ratings = `user_id`, autres = `created_by`.** Mappé dans le CASE du RPC. [tranché]
4. **D4 — Notif FR-only.** E-mail auteur/reporter en FR (MVP, comme 1.7/1.8). Locale par profil différée. [tranché]
5. **D5 — Présence live différée.** « Un autre co_mod consulte ce signalement » en temps réel = Realtime/heartbeat (hors stack MVP, AR « polling-à-l'ouverture »). Substance de l'AC (ne pas double-modérer + voir la résolution) couverte par D2 + détail. [tranché — noté deferred-work]
6. **D6 — SLA présence approximé UTC.** `presenceHoursElapsed` somme les heures 7h-23h UTC ; raffinement Africa/Casablanca (≤1h) différé. [tranché]

### §Sécurité

- RPC `revoke from public,anon` + `grant to authenticated` ; re-check `auth_role()='co_mod'` + `auth_residence_id()`.
- Aucune PII de l'auteur/reporter dans `moderation_log` (seulement motif + payload `{target_type, motive}`).
- `note_text` du report (PII potentielle) jamais copié dans le log.

### §Réutilisation directe

- RPC pattern `retire_durable_entry` (3.5), `requireComod` (1.8), `sendTransactionalEmail` (1.7), divulgation inline (4.3), page queue (admission 1.8).

### Project Structure Notes

- **NEW** : migration RPC, `lib/moderation/{sla,target-content,labels}.ts`(+tests), `lib/validation/moderation.ts`, `app/[locale]/comod/moderation/{page,[id]/page,data,actions}.tsx` + `_components/moderation-actions.tsx`, 4 templates e-mail.
- **UPDATE** : `lib/email/send.ts`, `app/actions/report-submit.ts` (dedupe labels), `app/[locale]/comod/page.tsx` (tuile), `messages/fr.json`, `lib/supabase/types.generated.ts`.

### References

- [Source: epics.md#Story-5.3] — AC verbatim.
- [Source: supabase/migrations/20260627110000_durable_content_retire_rpc.sql] — modèle RPC retrait.

## Dev Agent Record

### Completion Notes

- 2 RPC + UI queue/détail + 4 e-mails + SLA. typecheck ✓, lint ✓ (0 err), 425 unit ✓, 86 RLS ✓ (+5 RPC).
- Présence live « autre co_mod consulte » consignée dans `deferred-work.md` (Realtime hors MVP).

### File List

- `supabase/migrations/20260702090000_moderation_resolve_rpc.sql` (NEW)
- `lib/moderation/sla.ts` (+test), `lib/moderation/target-content.ts`, `lib/moderation/labels.ts` (NEW)
- `lib/validation/moderation.ts` (NEW)
- `lib/email/templates/content-removed-author.fr/.ar.ts`, `report-kept-reporter.fr/.ar.ts` (NEW)
- `app/[locale]/comod/moderation/page.tsx`, `[id]/page.tsx`, `data.ts`, `actions.ts`, `_components/moderation-actions.tsx` (NEW)
- `lib/email/send.ts`, `app/actions/report-submit.ts`, `app/[locale]/comod/page.tsx`, `messages/fr.json`, `lib/supabase/types.generated.ts`, `tests/rls.test.ts` (UPDATE)

### Change Log

- 2026-06-20 — Story 5.3 implémentée (queue co_mod + retrait/conservation + notif auteur/reporter + SLA).
