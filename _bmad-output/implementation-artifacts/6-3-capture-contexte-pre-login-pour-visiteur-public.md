# Story 6.3: Capture contexte pré-login pour visiteur public

Status: done

## Story

As a **visitor opening a WhatsApp-shared community link**, I want **to register with the link preserved through admission and login**, so that **I land directly on the entity I came to see.**

## Acceptance Criteria

1. **AC1 — Teaser.** Visiteur anonyme sur URL canonique → teaser + CTA « S'inscrire pour voir » (livré 6.1).
2. **AC2 — `next` préservé.** CTA → `/admission?next=/artisan/<slug>` ; le chemin survit tout le flux.
3. **AC3 — Atterrissage post-acceptation.** Après acceptation + login magic-link, redirigé vers l'entité (PAS `/community/`).
4. **AC4 — Tombstone.** Deep link vers entité supprimée → 410 sans prompt d'inscription (livré 6.1).
5. **AC5 — PWA deep link** résident connecté → ouvre l'entité directement (307, livré 6.1). A11y teaser (livré 6.1).

## Dev Notes

- **D1 — Persistance sur `admission_requests.landing_path`.** Le `next` est capté à la soumission, stocké (CHECK canonique en DB), et restitué dans le magic-link de **BIENVENUE** (post-acceptation) via `sendWelcome` → l'utilisateur accepté atterrit sur l'entité. Le 1er lien (vérif e-mail, demandeur pending) garde `next=/admission/pending` (un pending ne peut pas voir l'entité). [tranché]
- **D2 — `resolveRedirect` étendu** : accepte un `next` canonique d'entité (`isCanonicalEntityPath`) en plus des chemins d'admission. Le route handler canonique 307-redirige ensuite le résident vers la fiche communautaire. [tranché]
- **D3 — Anti open-redirect** : `isCanonicalEntityPath` (match strict full-string) côté form + action + `resolveRedirect`, doublé d'un CHECK DB. [tranché]

## File List

- **NEW** `lib/share/safe-next.ts`, `supabase/migrations/20260708090000_admission_landing_path.sql`
- **NEW** `tests/lib/safe-next.test.ts` (+ cas 6.3 dans `redirect-by-state.test.ts`, `submit-action.test.ts`)
- **UPDATE** `lib/auth/redirect-by-state.ts`, admission `page.tsx`/`admission-form.tsx`/`admission-submit.ts`, `comod/admission/actions.ts` (sendWelcome), types
- **CHORE** rename `20260705090000_share_counters.sql` → `…090200` (collision de timestamp avec `review_5_moderation_log_lockdown`, débloque `db reset`/CI)

## Change Log

| Date       | Version | Description                                            |
| ---------- | ------- | ------------------------------------------------------ |
| 2026-06-21 | 0.1     | Capture `next` admission→accept→login + landing entité |
