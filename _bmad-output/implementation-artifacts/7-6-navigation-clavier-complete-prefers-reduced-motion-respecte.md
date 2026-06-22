# Story 7.6: Navigation clavier complète + `prefers-reduced-motion` respecté

Status: done

## Story

As a **power user or a screen-reader user**, I want **to navigate the entire MVP with keyboard only and have motion-sensitive options respected**, so that **the app is accessible to all and feels right to me.**

## Acceptance Criteria

1. **AC1 — Ordre de focus + anneau visible.** Tab parcourt chaque élément interactif dans l'ordre de lecture, avec un anneau de focus visible (≥ 2px contrasté) — pattern `focus-visible:outline-2 outline-accent-500` déjà uniforme (FR49/NFR37).
2. **AC2 — Escape ferme les modales + retour focus.** Les dialogues natifs `<dialog>` (showModal/close) gèrent piège de focus + retour ; Radix dropdown idem (built-in).
3. **AC3 — Aucun piège clavier + skip link.** Tous les éléments sortables au Tab/Shift+Tab ; un lien « Aller au contenu » est le 1er focusable de chaque page → `#main-content`.
4. **AC4 — Reduced-motion.** `@media (prefers-reduced-motion: reduce)` global neutralise transitions/animations/auto-scroll (y compris animations Radix non `motion-safe:`) (NFR39/FR50).
5. **AC5 — e2e clavier.** `e2e/keyboard-navigation.spec.ts` parcourt les journeys au clavier : skip link en tête, aucun `tabindex="-1"` focusable, axe zéro violation (parcours publics en CI, authentifiés gated).
6. **AC6 — Lecteur d'écran + axe AA.** Landmarks `<main id="main-content">`, focus rings, ARIA déjà en place ; axe WCAG A/AA zéro violation sur les parcours.

## Dev Notes

- **D1 — Skip link universel.** Ajouté comme 1er enfant focusable du `<body>` dans `app/[locale]/layout.tsx` (`sr-only` → `focus:not-sr-only`), cible `#main-content`. Label i18n `a11y.skipToContent` (fr/ar).
- **D2 — Landmark `#main-content`** posé sur le `<main>` partagé (`PageContainer` reçoit un prop `id`) : layouts community + comod + page admission publique + page offline → couvre les 5 journeys. Les autres pages publiques héritent du skip link (cible ajoutable au besoin).
- **D3 — Reduced-motion = règle CSS globale** (vs `motion-safe:` partout) : approche catch-all robuste dans `globals.css`, neutralise aussi les animations Radix `data-[state]:animate-in/out` qui n'utilisent pas `motion-safe:`. Les skeletons utilisaient déjà `motion-safe:` (pré-existant).
- **D4 — Focus trap** : pas de nouveau code — `<dialog>` natif (decision-form 1.8) et Radix dropdown gèrent Escape + retour focus nativement.
- **D5 — e2e** : parcours publics (admission, login, accueil) testés en CI (comme `a11y.spec.ts`) ; parcours authentifiés (annuaire, guide, création) gated `RESIDENT_LOGIN_URL` (skip si absent) — l'exécution complète sur les 5 journeys reste un run pré-bêta avec session staging (cohérent résidu 1.10c).

## File List

- **NEW** `e2e/keyboard-navigation.spec.ts`
- **UPDATE** `app/[locale]/layout.tsx` (skip link)
- **UPDATE** `app/globals.css` (`@media prefers-reduced-motion`)
- **UPDATE** `components/layout/page-container.tsx` (prop `id`)
- **UPDATE** `app/[locale]/community/layout.tsx`, `app/[locale]/comod/layout.tsx`, `app/[locale]/(public)/admission/page.tsx` (`id="main-content"`)
- **UPDATE** `messages/{fr,ar}.json` (`a11y.skipToContent`)

## Change Log

| Date       | Version | Description                                                   |
| ---------- | ------- | ------------------------------------------------------------- |
| 2026-06-22 | 0.1     | Skip link + landmark main, reduced-motion global, e2e clavier |
