# Story 5.5: Workflow escalade juridique

Status: review

> ⚠️ **2 points structurants** : (1) Le dossier est stocké via **Supabase Storage** (URL signée 30j) et non R2 — R2 (AR29) est un scaffold env non provisionné au MVP ; fallback **inline** dans l'e-mail si le storage échoue. (2) Le dossier est **PII-safe par construction** (`dossier.ts`) : pseudonymes tronqués, snippet de contenu, données structurelles — jamais de nom/e-mail/téléphone.

## Story

As a **co-mod**,
I want **a guided escalation workflow when a moderation case requires legal expertise**,
so that **I can prepare a complete dossier and reach the pre-identified legal contact without ad-hoc compilation.**

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 5.5 » (l. 1556-1586). FR35, NFR30.

1. **AC1 — Action escalade.** « Escalader vers contact juridique » disponible à côté de Retirer/Conserver (report ouvert).
2. **AC2 — Formulaire guidé.** Pré-remplit snippet cible, motif, actions antérieures + note de contexte libre (≤ 1000c).
3. **AC3 — Server Action.** (a) `moderation_log escalation_triggered`, (b) dossier (Markdown) généré + URL signée 30j (Supabase Storage), (c) e-mail Brevo à `LEGAL_CONTACT_EMAIL` (lien + résumé), (d) report → `closed_kept_pending_legal` (cible reste visible).
4. **AC4 — Résolution out-of-band.** Le co_mod marque `closed_kept_legal_approved` ou `closed_removed_legal_advised` + note loggée.
5. **AC5 — Garde env.** `LEGAL_CONTACT_EMAIL` manquant → `errors.moderation.legal_contact_missing` + renvoi runbook (NFR30).
6. **AC6 — Dossier sans PII tierce.** Jamais de PII d'autres résidents que les parties (auteur cible, reporter) — snippets redacted + données structurelles.

### AC additionnel (régression)

7. **AC7 — Tests.** RPC RLS escalade (5 : not_co_mod, pending_legal transition, not_pending_legal, approved, removed+soft-delete) + dossier PII-safe (4 unitaires).

## Tasks / Subtasks

- [x] **Task 1 — États** (`20260703090000_escalation_states.sql`) — `report_state += closed_kept_pending_legal / closed_kept_legal_approved / closed_removed_legal_advised`.
- [x] **Task 2 — RPC** (`20260703090100_escalation_rpc.sql`) — `escalate_report_legal` (open→pending_legal, log escalation_triggered, retourne ids parties) ; `resolve_legal_escalation` (pending→approved content_kept / removed content_removed+soft-delete), gardes co_mod+résidence+état atomique.
- [x] **Task 3 — Dossier** (`lib/moderation/dossier.ts`) — `generateDossierMarkdown` (PII-safe : pseudonymes tronqués, snippet, historique) + `dossierSummary` + `authorPseudonymFromId`. + tests.
- [x] **Task 4 — Storage** (`lib/moderation/legal-storage.ts`) — `uploadDossier` Supabase Storage (bucket privé `legal-dossiers`, createSignedUrl 30j), échec → null (fallback inline).
- [x] **Task 5 — E-mail** (`escalation-legal.fr/.ar`) — résumé + lien signé OU dossier inline ; enregistré `send.ts`.
- [x] **Task 6 — Server Actions** — `escalateReportLegal` (Zod ctx 1000c, garde LEGAL_CONTACT_EMAIL, RPC, dossier, upload, e-mail) ; `resolveLegalEscalation` (Zod decision, RPC).
- [x] **Task 7 — UI** — bouton « Escalader » + form contexte dans `moderation-actions` ; `legal-resolution.tsx` (Approuver/Retirer sur avis) ; détail branche sur `closed_kept_pending_legal`.
- [x] **Task 8 — Validation + i18n** — `zEscalateLegal`/`zResolveLegal` ; `comod.moderation.escalateForm/legal.*` + `errors.moderation.{legal_contact_missing,not_pending_legal,context_required}`.

## Dev Notes

### §Décisions

1. **D1 — Supabase Storage vs R2.** R2 (AR29 backup) non provisionné au MVP (env optionnels, pas de client S3). Le dossier utilise Supabase Storage (déjà dans la stack, service-role) avec URL signée 30j. Fallback inline e-mail si storage KO → l'escalade aboutit toujours. [tranché — deferred-work : migrer vers R2 quand provisionné]
2. **D2 — Dossier PII-safe par construction.** `dossier.ts` n'accepte que des pseudonymes (uuid tronqué) + snippet + structure ; impossible d'injecter un nom/e-mail. Testé (no `@`, no uuid brut). [tranché]
3. **D3 — Résolution juridique réutilise content_kept/content_removed.** Pas de nouvelle moderation_action ; seuls 3 `report_state` ajoutés. `removed` → soft-delete cible (idempotent). [tranché]
4. **D4 — Garde LEGAL_CONTACT_EMAIL.** `env` la valide (`z.email()`) au boot → toujours présente en pratique ; garde défensive runtime + clé i18n runbook (NFR30). [tranché]
5. **D5 — Contexte obligatoire (≥1).** `zEscalateLegal.context_note` min 1 (l'escalade sans justification n'a pas de sens), max 1000. [tranché]

### §Sécurité

- RPC `revoke from public,anon` + `grant authenticated` + re-check co_mod+résidence+état.
- Dossier sans PII tierce (AC6) ; e-mail uniquement au contact juridique configuré.
- `note`/contexte sanitisés (NFC + strip bidi/control).

### §Réutilisation directe

- RPC pattern `moderate_*` (5.3), `resolveTarget` (5.3), `sendTransactionalEmail` (1.7), `createAdminClient` storage (1.x), divulgation inline (4.3).

### Project Structure Notes

- **NEW** : 2 migrations, `lib/moderation/{dossier,legal-storage}.ts` (+dossier.test), `escalation-legal.fr/.ar`, `_components/legal-resolution.tsx`.
- **UPDATE** : `moderation/actions.ts` (2 actions), `moderation-actions.tsx` (mode escalate), `[id]/page.tsx` (branch pending_legal), `lib/validation/moderation.ts`, `lib/email/send.ts`, `messages/fr.json`, `lib/supabase/types.generated.ts`, `tests/rls.test.ts`.

### References

- [Source: epics.md#Story-5.5] — AC verbatim.
- [Source: supabase/migrations/20260702090000_moderation_resolve_rpc.sql] — modèle RPC modération.

## Dev Agent Record

### Completion Notes

- Escalade + dossier PII-safe + résolution juridique. typecheck ✓, lint ✓, 433 unit ✓ (+4 dossier), 91 RLS ✓ (+5 escalade).
- R2 → Supabase Storage (R2 non provisionné) consigné dans `deferred-work.md`.

### File List

- `supabase/migrations/20260703090000_escalation_states.sql`, `20260703090100_escalation_rpc.sql` (NEW)
- `lib/moderation/dossier.ts` (+test), `lib/moderation/legal-storage.ts` (NEW)
- `lib/email/templates/escalation-legal.fr/.ar.ts` (NEW)
- `app/[locale]/comod/moderation/_components/legal-resolution.tsx` (NEW)
- `app/[locale]/comod/moderation/actions.ts`, `_components/moderation-actions.tsx`, `[id]/page.tsx`, `lib/validation/moderation.ts`, `lib/email/send.ts`, `messages/fr.json`, `lib/supabase/types.generated.ts`, `tests/rls.test.ts` (UPDATE)

### Change Log

- 2026-06-20 — Story 5.5 implémentée (workflow escalade juridique + dossier + résolution out-of-band).
