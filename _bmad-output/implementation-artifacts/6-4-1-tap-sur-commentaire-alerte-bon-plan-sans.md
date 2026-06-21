# Story 6.4: 👍 1-tap sur commentaire, alerte, bon plan (sans 👎)

Status: done

## Story

As a **resident**, I want **to 👍 a comment / alerte / bon plan in one tap with a public aggregated count**, so that **I express light support without toxicity (no 👎 by construction).**

## Acceptance Criteria

1. **AC1 — Schéma + RLS.** Table `reactions` (unique `(user_id, target_type, target_id)`) ; INSERT/DELETE/SELECT own ; compte agrégé via vue `reaction_counts` (jamais la liste des likers).
2. **AC2 — Bouton.** 👍 + compte agrégé, tap ≥ 48×48.
3. **AC3 — Optimistic + toggle.** Incrément immédiat, action upsert, réconciliation serveur ; 2e tap retire.
4. **AC4 — Compte 0 → « 👍 » sans chiffre.** **AC5 — vie privée** : on voit le compte, jamais QUI.
5. **AC6 — Aucun 👎** : `grep thumbs_down|dislike` = 0 hit fonctionnel (rejet par construction — pas de colonne `kind`).

## Dev Notes

- **D1 — `target_type` ∈ {rating, alert, tip}** : « commentaire » = `rating` (commentaire artisan). Pas de table de commentaires d'alerte au MVP. [tranché]
- **D2 — Privacy par RLS.** `reactions_resident_select_own` → un résident ne lit QUE ses lignes ; le compte passe par la vue `SECURITY DEFINER` (agrège sans exposer les user_id). [tranché]
- **D3 — defaults figés** : `user_id`/`residence_id` posés par défaut (auth.uid()/auth_residence_id()), non grantés ; le client ne grant que `target_type, target_id`. [tranché]
- **D4 — toggle côté action** (lecture existant → delete/insert) ; course double-tap (23505) absorbée (« réagi »).

## File List

- **NEW** `supabase/migrations/20260706090000_reactions.sql` (table + vue + RLS)
- **NEW** `lib/reactions/config.ts`, `app/actions/toggle-reaction.ts`, `app/[locale]/community/_data/reactions.ts`, `components/content/reaction-button.tsx`
- **NEW** `tests/share/{toggle-reaction,reaction-button}.test.*` + RLS (o)(p)(q)
- **UPDATE** fiches artisan (commentaires)/alerte/bon plan, `messages/{fr,ar}.json` (`reactions.like`), types régénérés

## Change Log

| Date       | Version | Description                         |
| ---------- | ------- | ----------------------------------- |
| 2026-06-21 | 0.1     | Réactions 👍 toggle + compte agrégé |
