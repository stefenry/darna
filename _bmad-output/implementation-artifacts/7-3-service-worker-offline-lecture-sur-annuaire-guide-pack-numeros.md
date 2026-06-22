# Story 7.3: Service Worker offline lecture sur annuaire + guide + pack + numéros

Status: done

## Story

As a **resident**, I want **to read the annuaire, guide, pack accueil and useful numbers entirely offline after my first visit**, so that **I can use Darna in the elevator, the basement, or on the bus without signal.**

## Acceptance Criteria

1. **AC1 — Stratégies de cache.** `sw/index.ts` : `CacheFirst` pour `/api/annuaire` (24h) + assets statiques (defaultCache) ; `StaleWhileRevalidate` pour `/community/(guide|numeros-utiles)` (inclut guide/[slug] + pack-accueil) ; `NetworkFirst` pour `/community/(alertes|bons-plans)` ; token-surfaces jamais cachées (FR45).
2. **AC2 — Lecture offline < 100ms.** Page déjà visitée → rendue depuis le cache + bannière « Hors ligne — mise à jour il y a Xh » (déjà livrée par `OfflineBanner` 2.2) (NFR8).
3. **AC3 — Background sync écritures.** Écriture (note/commentaire/alerte) hors-ligne → la requête POST est mise en file (Background Sync API) et rejouée à la reconnexion (FR45).
4. **AC4 — MAJ gracieuse.** Nouveau SW (`skipWaiting` + `clientsClaim`) sans hard reload forcé ; toast `ServiceWorkerUpdater` propose un rafraîchissement doux (NFR-UX).
5. **AC5 — Repli offline 1re visite.** Première ouverture sans réseau → page de repli claire « Aucune connexion détectée… » (dégradation gracieuse).
6. **AC6 — Cache borné.** Tous les runtime caches ont un `ExpirationPlugin` (maxAge + maxEntries).

## Dev Notes

- **D1 — Prédicats extraits + testés.** Les matchers de routes du SW vivent dans `lib/offline/sw-matchers.ts` (fonctions PURES) → unit-testés Node (le SW n'est pas typecheck par tsc, exclu tsconfig ; validé en standalone `tsc --lib webworker`).
- **D2 — SWR conservé pour le durable** (vs CacheFirst de l'AC) : décision review 3.2 P5/P6 (fenêtre 5 min pour la visibilité des soft-deletes). SWR satisfait « < 100ms offline » (renvoie le cache immédiatement, revalide en arrière-plan).
- **D3 — Background sync** = `NetworkOnly` + `BackgroundSyncPlugin('darna-community-writes', maxRetentionTime 24h)` sur les POST same-origin `/[locale]/community/`. La mutation serveur est rejouée à la reconnexion ; l'UI affiche l'état hors-ligne via `OfflineBanner`. Nuance Server Actions : la réponse RSC rejouée n'est pas consommée par le client (la page a pu changer) mais le write aboutit — UX précise par-action à raffiner pré-bêta.
- **D4 — Repli offline** : page statique `/[locale]/offline` précachée via `additionalPrecacheEntries` (next.config) + `fallbacks` SW sur les requêtes `document`. MVP FR-only : un shell FR `/fr/offline` couvre les deux locales.
- **D5 — MAJ gracieuse** : on garde `skipWaiting`+`clientsClaim` (AC4 explicite) ; `ServiceWorkerUpdater` écoute `controllerchange` (après qu'un controller existait) et propose un refresh SANS recharger (préserve la saisie).
- **D6 — Vérif manuelle déférée** (cohérent résidu 2.2) : l'E2E offline (cache hit < 100ms, replay background-sync, repli) exige `pnpm build --webpack` + un device/navigateur réel — Serwist ne tourne pas en dev Turbopack. À valider pré-bêta.

## File List

- **NEW** `lib/offline/sw-matchers.ts` (prédicats purs) + `tests/offline/sw-matchers.test.ts`
- **NEW** `app/[locale]/offline/page.tsx` + `_components/offline-retry.tsx`
- **NEW** `components/pwa/sw-updater.tsx` (toast MAJ gracieuse)
- **UPDATE** `sw/index.ts` (NetworkFirst feeds, background-sync POST, fallback offline, prédicats)
- **UPDATE** `next.config.ts` (`additionalPrecacheEntries` page offline)
- **UPDATE** `app/[locale]/layout.tsx` (montage `ServiceWorkerUpdater`)
- **UPDATE** `messages/{fr,ar}.json` (`offline.*`, `pwa.*`)

## Change Log

| Date       | Version | Description                                                             |
| ---------- | ------- | ----------------------------------------------------------------------- |
| 2026-06-22 | 0.1     | NetworkFirst feeds, background-sync écritures, repli offline, MAJ douce |
