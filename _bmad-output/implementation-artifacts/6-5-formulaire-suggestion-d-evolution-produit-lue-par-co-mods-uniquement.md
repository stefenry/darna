# Story 6.5: Formulaire suggestion d'évolution produit (lue par co-mods uniquement)

Status: done

## Story

As a **resident**, I want **to submit a free-text product evolution suggestion from my settings**, so that **my voice reaches the co-mods without public debate, vote or ranking (anti-toxicity).**

## Acceptance Criteria

1. **AC1 — Schéma + RLS.** Table `suggestions` (state `new`/`reviewed`, soft-delete) ; résident INSERT/SELECT own, co_mod SELECT résidence + UPDATE state.
2. **AC2 — Form résident.** `/community/profil/parametres/suggestion` : textarea ≤1000 + submit.
3. **AC3 — Soumission.** Row créée (mon user_id), tous les co_mod notifiés par e-mail, accusé « Merci, ton retour a été transmis aux co-mods ».
4. **AC4 — Historique perso.** Je vois SEULEMENT mes suggestions, marquées « lue ».
5. **AC5 — Espace co_mod.** `/comod/suggestions` : toutes celles de la résidence, auteur **pseudonymisé**, action « Marquer comme lue ».
6. **AC6 — Jamais public** : aucune page `/suggestions`, aucun vote/like.

## Dev Notes

- **D1 — defaults figés.** `user_id`/`residence_id` posés par défaut, non grantés ; INSERT ne grant que `body`, UPDATE que `state`. Le résident n'a aucune policy UPDATE → ne peut pas marquer « lue ». [tranché]
- **D2 — Notif co_mods = `INITIAL_COMOD_EMAILS`** (pattern admission/report 1.7/5.2 — pas de lookup DB des co_mods au MVP). Extrait seul, pas l'auteur (FR42). [tranché]
- **D3 — Pseudonyme co_mod UI** : `pseudonymSuffix(user_id, 'suggestions')` (HMAC stable) — réduit la pression sociale. [tranché]
- **D4 — Nouveau template email** `suggestion-notify-comod` (fr/ar) câblé dans la boundary `lib/email/send.ts`.

## File List

- **NEW** `supabase/migrations/20260707090000_suggestions.sql`
- **NEW** résident : `…/parametres/suggestion/{page.tsx,actions.ts,_components/suggestion-form.tsx}`, `lib/validation/suggestion.ts`
- **NEW** co_mod : `…/comod/suggestions/{page.tsx,actions.ts,_components/mark-reviewed-button.tsx}`
- **NEW** email : `lib/email/templates/suggestion-notify-comod.{fr,ar}.ts` (+ wiring send.ts)
- **NEW** tests : `tests/community/suggestion-actions.test.ts` + RLS (a–f)
- **UPDATE** `…/parametres/page.tsx` (lien), `comod/page.tsx` (tuile), `messages/{fr,ar}.json`, types

## Change Log

| Date       | Version | Description                                       |
| ---------- | ------- | ------------------------------------------------- |
| 2026-06-21 | 0.1     | Suggestions résident + espace co_mod + notif mail |
