# 0003 — Routing i18n : préfixe de locale sur les routes publiques uniquement

## Context

Darna est bilingue FR/AR (RTL). next-intl propose plusieurs stratégies de routing : préfixe de
locale partout (`/fr/...`, `/ar/...`), ou locale via cookie/header sans préfixe. Décision MVP :
**FR-only** (l'arabe est différé V1.5, mais la structure technique reste prête). Les routes
authentifiées (`/community/*`, `/comod/*`) et les Route Handlers (`/auth/*`, `/api/*`) n'ont pas
besoin d'être indexables ni partageables par locale.

## Decision

Préfixe de locale **sur les routes publiques** (`app/[locale]/(public)/*`) — indexables,
partageables, SEO. Les **Route Handlers** (`/auth/confirm`, `/auth/signout`, `/api/cron/*`) sont
**hors `[locale]`** (pas de préfixe : ce sont des endpoints machine). Les routes communautaires
et co-mod vivent sous `app/[locale]/` (préfixées) pour cohérence avec `resolveRedirect` et le
proxy, mais leur contenu reste FR au MVP. La locale runtime est lue via cookie + `Accept-Language`
(`detectLocale`), avec fallback FR.

## Consequences

- ✅ URLs publiques propres et partageables ; endpoints machine simples et stables.
- ✅ `messages/ar.json` existe en stubs vides → fallback FR via `deepMerge` (story 1.5) : aucune
  page cassée, bascule AR triviale en V1.5.
- ⚠️ Le switcher de langue global (header) et le routing AR actif sont différés story 7.4 ;
  `profiles.language` est déjà persisté (story 1.9) mais n'altère pas encore le rendu.

## Status

Accepted — décision step-04. Implémenté stories 1.4 (shell i18n), 1.5 (deepMerge fallback).
