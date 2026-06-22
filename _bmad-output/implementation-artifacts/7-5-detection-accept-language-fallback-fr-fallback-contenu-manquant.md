# Story 7.5: Détection Accept-Language + fallback FR + fallback contenu manquant

Status: done

## Story

As a **visitor**, I want **the system to auto-detect my language from the browser AND gracefully fallback to FR when content is missing in AR**, so that **I am never confronted with broken pages.**

## Acceptance Criteria

1. **AC1 — Accept-Language → /ar.** `Accept-Language: ar-MA, ar;q=0.9, fr;q=0.8` sur `/` → redirection `/ar` (FR47).
2. **AC2 — Langue non supportée → /fr.** `Accept-Language: en-US, en;q=0.9` → redirection `/fr` (fallback défaut) (FR47).
3. **AC3 — Guide AR null → FR + badge.** Entrée guide `body_ar` vide en AR → markdown FR rendu + badge « non traduit » (« غير مترجم ») ; l'entrée reste visible (FR48).
4. **AC4 — Numéro utile FR only → indicateur.** `useful_number` avec seul `label_fr` → label FR + indicateur discret (FR48).
5. **AC5 — Alerte template FR+AR.** Une alerte issue d'un template a les deux champs par défaut (templates seedés FR+AR) ; les alertes free-form FR-only retombent sur le fallback.
6. **AC6 — Fallback complet.** Aucune chaîne d'UI n'affiche jamais `undefined` ni une clé du type `errors.foo.bar` (NFR47).

## Dev Notes

- **D1 — Largement pré-existant.** `lib/i18n/detect-locale.ts` (parser RFC 7231 Accept-Language, ordre par `q`, cookie `NEXT_LOCALE` prioritaire, fallback FR) + le middleware next-intl couvrent AC1/AC2 (tests `tests/auth/detect-locale.test.ts`). Les badges « non traduit » existent déjà sur guide, guide/[slug], pack-accueil, alertes (feed + slug), bons-plans.
- **D2 — Complément AC4 (numéros utiles).** Ajout du flag `untranslated` (label AR vide) dans `numeros-utiles/data.ts` + indicateur sur `NumberCard` (badge partagé `community.numerosUtiles.notTranslatedBadge`). Affine la décision 3.3 D5 (qui ne badgeait que la note) en couvrant le label, conformément à l'AC.
- **D3 — Fallback complet prouvé (AC6).** Le `deepMerge` de `lib/i18n/request.ts` (FR base, AR override, stub AR vide OU clé absente → garde FR) garantit qu'aucune clé ne manque. Nouveau test `tests/i18n/messages-fallback.test.ts` reproduit le merge et asserte que **toute** chaîne fusionnée est non vide, non `undefined`, et n'est jamais sa propre clé pointée.
- **D4 — MVP FR-only.** Au MVP le contenu DB est quasi-100% FR ; la mécanique de fallback + indicateurs est en place pour V1.5 quand l'AR sera partiellement rempli.

## File List

- **NEW** `tests/i18n/messages-fallback.test.ts` (fallback FR complet, AC4/AC6)
- **UPDATE** `app/[locale]/community/numeros-utiles/data.ts` (flag `untranslated`)
- **UPDATE** `app/[locale]/community/numeros-utiles/_components/number-card.tsx` (indicateur)
- **UPDATE** `messages/{fr,ar}.json` (`community.numerosUtiles.notTranslatedBadge`)
- **UPDATE** `tests/numeros/numeros-list.test.tsx` (fixture + tests badge)
- **VERIFIED** `lib/i18n/detect-locale.ts` + `tests/auth/detect-locale.test.ts` (AC1/AC2, déjà en place)

## Change Log

| Date       | Version | Description                                                               |
| ---------- | ------- | ------------------------------------------------------------------------- |
| 2026-06-22 | 0.1     | Indicateur numéros utiles + test fallback FR complet ; détection vérifiée |
