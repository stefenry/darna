# Story 6.2: Bouton « Partager » 1-tap (presse-papier + native share)

Status: done

## Story

As a **resident**, I want **a one-tap share action on every entity (native share sheet or clipboard)**, so that **I paste the link into WhatsApp without friction.**

## Acceptance Criteria

1. **AC1 — Bouton.** « Partager » inline primaire sur chaque fiche (artisan/alerte/bon plan/guide), tap ≥ 48×48.
2. **AC2 — Native share.** `navigator.share({title,text,url})` si supporté (WhatsApp natif).
3. **AC3 — Repli.** Sinon `navigator.clipboard.writeText(url)` + toast « Lien copié ».
4. **AC4 — Compteur.** Succès → `share_count` +1 serveur (compteur seul, zéro PII — NFR16/52).
5. **AC5 — AR.** Label « مشاركة », RTL. **AC6 — pas de modale** (1-tap, NFR40).

## Dev Notes

- **D1 — Compteur via RPC SECURITY DEFINER** `increment_share_count(kind,id)` : le résident n'a aucun grant sur `share_count`. Incrément **borné à sa résidence** (`auth_residence_id()`) — anti-gonflage cross-tenant. [tranché]
- **D2 — Comptage best-effort, fire-and-forget.** L'UI ne bloque pas dessus. Pas compté si l'utilisateur annule la feuille native (`AbortError`). [tranché]
- **D3 — URL canonique passée en prop** (construite serveur via `canonicalUrl`) — le client n'importe pas `env`.

## File List

- **NEW** `supabase/migrations/20260705090000_share_counters.sql` (colonne + RPC)
- **NEW** `app/actions/record-share.ts`, `components/content/share-button.tsx`
- **NEW** `tests/share/{record-share.test.ts,share-button.test.tsx}` + RLS (m)(n)
- **UPDATE** 4 fiches `[slug]/page.tsx` (ShareButton), `messages/{fr,ar}.json` (`share.button.*`), types régénérés

## Change Log

| Date       | Version | Description                                    |
| ---------- | ------- | ---------------------------------------------- |
| 2026-06-21 | 0.1     | Bouton partager natif/presse-papier + compteur |
