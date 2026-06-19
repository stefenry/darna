// CAVEAT TURBOPACK : Serwist 9.x ne tourne PAS en dev Turbopack.
// Utiliser `pnpm dev:webpack` pour itérer sur le SW en local.
// La prod (`pnpm build && pnpm start`) marche normalement.
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & {
  registration: ServiceWorkerRegistration & {
    navigationPreload?: { enable: () => Promise<void> };
  };
};

const supportsNavigationPreload =
  typeof self !== 'undefined' && 'registration' in self && 'navigationPreload' in self.registration;

// Story 2.2 (AC4) — données annuaire en CacheFirst : lecture hors-ligne < 100ms,
// fraîcheur bornée par ExpirationPlugin (la bannière affiche « il y a Xh »).
//
// Partitionnement (review 2026-06-17 D1) : la clé cache par défaut de
// Workbox/Serwist est `request.url` (incluant query string). Le client appelle
// `/api/annuaire?r=<residence_id>&loc=<locale>` → une entrée distincte par
// résidence × locale. Le matcher reste pathname-only : il accepte tout `/api/
// annuaire*` mais le cache est partitionné automatiquement par URL complète.
// `maxEntries` élevé pour absorber les variations résidence/locale + futures.
const annuaireCache: RuntimeCaching = {
  matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/api/annuaire',
  handler: new CacheFirst({
    cacheName: 'annuaire-data',
    plugins: [new ExpirationPlugin({ maxAgeSeconds: 24 * 60 * 60, maxEntries: 32 })],
  }),
};

// Story 2.3 (AC4) — fiche artisan : pas de runtime cache (review 2026-06-17 P19).
// La page est authentifiée et personnalisée (ContributorPanel visible si isOwner)
// → un CacheFirst sans clé user fuiterait le HTML d'un user à un autre sur
// appareil partagé. AC4 strict (< 100ms offline) régressé : la fiche détaillée
// nécessite réseau ; le bouton `tel:` reste OS-level (marche hors-ligne) et
// l'annuaire (lecture publique anonyme) reste cachable. Le 410/cache strict
// reviendra avec Story 6.1 (slugs canoniques + invalidation explicite).

// Story 2.5 review P12 — `/consent/[token]` JAMAIS cacher (token raw dans URL).
// Le matcher passe BEFORE defaultCache (NetworkFirst HTML same-origin) qui sinon
// stockerait le HTML de la fiche localement (leak token + nom artisan).
const consentBypass: RuntimeCaching = {
  matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/consent/'),
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: supportsNavigationPreload,
  runtimeCaching: [consentBypass, annuaireCache, ...defaultCache],
});

serwist.addEventListeners();
