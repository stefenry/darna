# Story 4.3: Publication bon plan typé expirable

Status: review

> ⚠️ **2 points structurants** : (1) expiration explicite (picker date) validée serveur → `invalid_expiration` si passée ou >30j ; (2) retrait auteur via RPC `retract_own_ephemeral` (4.1), bouton sur la page détail.

## Story

As a **resident**,
I want **to publish a "Bon plan" categorized and time-bound (offre voisin, prêt d'objet, etc.)**,
so that **I share opportunities without polluting the feed long-term.**

## Acceptance Criteria

> Source verbatim : `epics.md` § « Story 4.3 » (l. 1344-1364). FR29, AR18.

1. **AC1 — Formulaire.** `/(community)/bons-plans/nouveau` : sélecteur catégorie (Offre voisin / Prêt d'objet / Événement / Autre), titre (locale), corps (locale), date d'expiration explicite (max 30j), submit.
2. **AC2 — Validation expiration.** `expires_at` passé ou > 30j → `errors.tip.invalid_expiration` (AR18).
3. **AC3 — createTip.** Crée `tips` avec `expires_at`, champs locale, `created_by`, `slug` ; notification opt-in (plumbing Epic 7).
4. **AC4 — Édition/retrait.** Bons plans de l'auteur retirables via flux générique de retrait (`retract_own_ephemeral`).

## Tasks / Subtasks

- [x] **Task 1 — Page** `bons-plans/nouveau/page.tsx` — calcule `minDate`/`maxDate` (demain → +30j) serveur, passe au form.
- [x] **Task 2 — Form client** `tip-publish-form.tsx` — catégorie radio, titre/corps, `input type=date` (min/max), version AR repliée, CTA.
- [x] **Task 3 — Server Action** `createTip` — `requireResident` + rate-limit, zod, `resolveExpiresAt` (fin de journée, futur, ≤30j → sinon `invalid_expiration`), INSERT session.
- [x] **Task 4 — Retrait** — Server Action `retractOwnEphemeral` (wrap RPC) + bouton `RetireOwnButton` (confirmation inline) sur page détail.
- [x] **Task 5 — i18n** `community.bonsPlans.*`, `errors.tip.*`.
- [x] **Task 6 — Tests** createTip (OK, passé, >30j, catégorie KO) + retract (OK, forbidden, not_found) + RLS retrait auteur.

## Dev Notes

### §Décisions

1. **D1 — Validation expiration en action** (pas zod refine) pour renvoyer la clé `invalid_expiration` propre ; date interprétée fin de journée (23:59:59). [tranché]
2. **D2 — Retrait générique RPC.** `retract_own_ephemeral(p_kind, p_id, p_reason)` couvre alerts + tips (whitelist), garde `created_by`, action audit dédiée (`tip_self_retracted`). Le flux 2.7 est retract-centric → ré-implémenté pour l'éphémère. [tranché]
3. **D3 — Édition (re-ouverture form) différée.** Le retrait couvre l'AC « retiré » ; l'édition complète (rare sur de l'éphémère) est un follow-up. [tranché — voir Limitations]

### §Sécurité

- Backstop DB `tips_expires_cap` (≤31j) double la validation app. RPC retrait : garde `created_by`, idempotent.

### §Réutilisation

- `zCreateTip`/`mapTipFieldError`, `buildEphemeralSlug`, `RetireOwnButton` partagé avec les alertes, pattern `retire-confirm.tsx` (3.5).

### Project Structure Notes

- **NEW** : `bons-plans/nouveau/{page.tsx,actions.ts,_components/tip-publish-form.tsx}`, `community/_actions/ephemeral-retract.ts`, `alertes/_components/retire-own-button.tsx`.

### References

- [Source: epics.md#Story-4.3] ; [Source: supabase/migrations/20260630090200_ephemeral_retract_rpc.sql].

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (2026-06-20).

### Completion Notes List

- **Limitation assumée** : édition complète d'un bon plan différée (retrait livré). Cohérent avec le flux retract-centric 2.7.
- Picker `min/max` calculés serveur (pas de hydration mismatch).

### File List

- **NEW** `app/[locale]/community/bons-plans/nouveau/page.tsx`
- **NEW** `app/[locale]/community/bons-plans/nouveau/actions.ts`
- **NEW** `app/[locale]/community/bons-plans/nouveau/_components/tip-publish-form.tsx`
- **NEW** `app/[locale]/community/_actions/ephemeral-retract.ts`
- **NEW** `app/[locale]/community/alertes/_components/retire-own-button.tsx`
- **UPDATE** `messages/fr.json`, `messages/ar.json`

### Change Log

| Date       | Version | Description                                   |
| ---------- | ------- | --------------------------------------------- |
| 2026-06-20 | 0.1     | Publication bon plan + retrait (dev autonome) |
