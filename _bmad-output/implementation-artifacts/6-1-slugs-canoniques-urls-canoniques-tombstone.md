# Story 6.1: Slugs canoniques + URLs canoniques + tombstone

Status: done

## Story

As a **solo dev**, I want **stable short canonical URLs (locale-less) on every shareable entity with permanent tombstoning**, so that **WhatsApp-shared links stay stable and never get reused or collide.**

## Acceptance Criteria

1. **AC1 — Slugs stables.** Slugs ASCII kebab-case déjà générés (artisans/alerts/tips/guide) ; unicité incluant lignes soft-deleted = tombstone (jamais réémis) — acquis Epics 2-4, conservé.
2. **AC2 — URLs canoniques courtes.** `/artisan/<slug>`, `/alerte/<slug>`, `/bon-plan/<slug>`, `/guide/<slug>` — **sans préfixe locale** (ADR 0003), stables.
3. **AC3 — Tombstone 410.** Slug soft-deleted ou expiré → HTTP **410 Gone** localisé. Slug jamais existant → **404**.
4. **AC4 — Deep link / teaser.** Vivant + résident connecté → 307 vers la fiche communautaire ; visiteur anonyme → teaser 200 + CTA `?next=`.
5. **AC5 — Meta.** `<link rel="canonical">` + OpenGraph (image Darna défaut) + `noindex, nofollow` sur les fiches communautaires.

## Dev Notes

- **D1 — Route Handlers, pas pages.** Émettre un STATUS HTTP précis (200/404/410/307) est impossible depuis une page App Router → les 4 routes canoniques sont des `route.ts` rendant une interstitielle HTML auto-portée (`lib/share/interstitial.ts`, brandée, bilingue, noindex). [tranché]
- **D2 — Lecture admin pré-auth.** Le resolver (`resolve-entity.ts`) lit via service role (le visiteur n'a pas de session → RLS bloquerait) et n'expose QUE des champs teaser (nom/type), jamais de PII (FR39).
- **D3 — `gone` = soft-deleted OU expiré** (alerts/tips) ; artisan non `published` → `not-found` (on ne révèle pas un pending/refused).
- **D4 — `?next=` posé ici, plomberie en 6.3.** Le CTA inclut déjà `?next=<canonicalPath>` ; la propagation admission→magic-link→callback est livrée en 6.3.

## File List

- **NEW** `lib/share/{entities,canonical,resolve-entity,interstitial,canonical-route,metadata}.ts`
- **NEW** `app/{artisan,alerte,bon-plan,guide}/[slug]/route.ts`
- **NEW** `tests/lib/share.test.ts`
- **UPDATE** fiches `generateMetadata` : artisan/alertes/bons-plans/guide `[slug]/page.tsx`

## Change Log

| Date       | Version | Description                                       |
| ---------- | ------- | ------------------------------------------------- |
| 2026-06-21 | 0.1     | Routes canoniques + 410 tombstone + meta + teaser |
