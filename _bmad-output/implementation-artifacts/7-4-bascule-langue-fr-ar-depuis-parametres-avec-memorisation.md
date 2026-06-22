# Story 7.4: Bascule langue FR/AR depuis paramètres avec mémorisation

Status: done

## Story

As a **resident**, I want **to switch my UI language between FR and AR from my settings with persistence**, so that **I read Darna in my preferred language across sessions and devices.**

## Acceptance Criteria

1. **AC1 — Sélecteur.** `/community/profil/parametres` expose un sélecteur de langue (FR ⇄ AR) (FR46).
2. **AC2 — Bascule.** Switch FR→AR → (a) `profiles.language='ar'`, (b) cookie `NEXT_LOCALE='ar'`, (c) re-rendu en AR avec `<html lang="ar" dir="rtl">` (navigation vers le préfixe /ar) (FR46).
3. **AC3 — Cross-device.** Nouvel appareil/navigateur : au login, `profiles.language` est lu et le cookie posé ; l'UI démarre dans la langue mémorisée.
4. **AC4 — Fallback clé manquante.** Clé AR absente/vide → valeur FR rendue silencieusement (pas de `MISSING_KEY`, pas d'erreur console) (FR48/NFR47).
5. **AC5 — Accept-Language.** Cookies vidés + `Accept-Language: ar` sur `/` → redirection `/ar` (FR47, via le middleware next-intl).
6. **AC6 — A11y.** Sélecteur au clavier (Tab + flèches/Space), RTL correct, propriétés logiques (NFR37/45).

## Dev Notes

- **D1 — Cookie `NEXT_LOCALE` = source de persistance.** Helper partagé `lib/i18n/locale-cookie.ts` (`setLocaleCookie`, mêmes options que le cookie next-intl : path `/`, `sameSite=lax`, ~1 an, `secure` en prod). Lu par le middleware next-intl + `detectLocale`.
- **D2 — Écriture du cookie à 2 points** : (a) `updateProfileSettings` (Server Action) après le write `profiles.language` ; (b) au login dans `app/auth/confirm/route.ts` via `applyLocaleFromProfile` (lit `profiles.language`, pose le cookie, renvoie la locale effective pour `resolveRedirect`). Best-effort : un échec DB ne casse jamais le login.
- **D3 — Re-rendu locale** côté client : `SettingsForm` utilise le router next-intl (`@/lib/i18n/navigation`) → `replace(pathname, { locale })` sur bascule, ce qui recharge le layout avec `dir`/`lang` corrects (`localePrefix: 'always'`).
- **D4 — Fallback FR garanti** par le `deepMerge` de `lib/i18n/request.ts` : FR est la base, les clés AR vides OU absentes conservent la valeur FR → aucun `MISSING_KEY`.
- **D5 — MVP FR-only respecté** : le contenu DB reste clampé FR via `ACTIVE_LOCALES` (annuaire/api). La bascule expose le shell RTL prêt (V1.5 traduira le contenu) — cohérent avec la décision MVP FR-only.

## File List

- **NEW** `lib/i18n/locale-cookie.ts` (`setLocaleCookie`, `applyLocaleFromProfile`, `LOCALE_COOKIE_NAME`)
- **NEW** `tests/i18n/locale-cookie.test.ts`
- **UPDATE** `app/[locale]/community/profil/actions.ts` (set cookie sur changement de langue)
- **UPDATE** `app/[locale]/community/profil/_components/settings-form.tsx` (navigation locale-aware)
- **UPDATE** `app/auth/confirm/route.ts` (`applyLocaleFromProfile` au login)
- **UPDATE** `tests/profil/profile-actions.test.ts` (mock locale-cookie + assertion cookie)

## Change Log

| Date       | Version | Description                                        |
| ---------- | ------- | -------------------------------------------------- |
| 2026-06-22 | 0.1     | Bascule langue persistée (cookie + profil + login) |
