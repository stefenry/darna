// CAVEAT TURBOPACK : Serwist 9.x ne tourne PAS en dev Turbopack.
// Utiliser `pnpm dev:webpack` pour itérer sur le SW en local.
// La prod (`pnpm build && pnpm start`) marche normalement.
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import {
  BackgroundSyncPlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from 'serwist';
import {
  isAnnuaireDataPath,
  isCommunityWritePath,
  isDurableContentPath,
  isEphemeralFeedPath,
  isTokenSurfacePath,
} from '../lib/offline/sw-matchers';

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
  matcher: ({ url, sameOrigin }) => sameOrigin && isAnnuaireDataPath(url.pathname),
  handler: new CacheFirst({
    cacheName: 'annuaire-data',
    plugins: [new ExpirationPlugin({ maxAgeSeconds: 24 * 60 * 60, maxEntries: 32 })],
  }),
};

// Story 7.3 — feeds éphémères (alertes, bons plans) en NetworkFirst : ils
// changent vite (fraîcheur prioritaire), mais un fallback cache borné permet la
// lecture hors-ligne du dernier état connu. networkTimeout court pour basculer
// vite sur le cache en connexion dégradée.
const ephemeralFeedCache: RuntimeCaching = {
  matcher: ({ url, sameOrigin }) => sameOrigin && isEphemeralFeedPath(url.pathname),
  handler: new NetworkFirst({
    cacheName: 'ephemeral-feed',
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxAgeSeconds: 60 * 60, maxEntries: 32 })],
  }),
};

// Story 7.3 — écritures communautaires (Server Actions POST) tentées hors-ligne :
// mises en file via la Background Sync API et rejouées à la reconnexion. Le
// `matcher` cible les POST same-origin sous /[locale]/community/. La requête
// échoue côté client (l'UI affiche « action enregistrée, sera envoyée à la
// reconnexion » via la bannière offline), mais la mutation serveur est rejouée
// dès le retour du réseau. `maxRetentionTime` borne la file à 24h.
const communityWriteSync: RuntimeCaching = {
  matcher: ({ url, request, sameOrigin }) =>
    sameOrigin && request.method === 'POST' && isCommunityWritePath(url.pathname),
  method: 'POST',
  handler: new NetworkOnly({
    plugins: [new BackgroundSyncPlugin('darna-community-writes', { maxRetentionTime: 24 * 60 })],
  }),
};

// Story 3.2 (AC5) / 3.3 / 3.4 — contenu durable (Guide + entrées + Pack accueil)
// en StaleWhileRevalidate : lecture hors-ligne < 100ms, rafraîchi en arrière-plan
// (contenu éditorial peu volatil). Matche les navigations `/[locale]/community/
// guide…` (inclut `guide/[slug]` ET `guide/pack-accueil` 3.4) ET leurs payloads
// RSC (même pathname, query `?_rsc=` → entrée de cache distincte par URL complète).
// 3.3 élargit ce matcher à `numeros-utiles`.
//
// NOTE multi-tenant : le contenu est résidence-scopé (RLS). Au MVP mono-résidence
// (Darna), pas de partitionnement par résidence ; à généraliser (cookie/locale)
// si plusieurs résidences partagent un appareil (cf. story 3.2 Task 7).
//
// Review 3.2 P5/P6 — fenêtre de stale réduite à 5 min (au lieu de 24h) :
//   1. Soft-delete co_mod (retract d'une info compromise, ex. code portail) est
//      visible à tous les résidents en ≤ 5 min, même hors-ligne ;
//   2. Logout-puis-login d'un autre user sur appareil partagé limite la fenêtre
//      de leak du HTML cached ; complété par `Clear-Site-Data: "cache"` posé
//      par `app/auth/signout/route.ts`.
// Trade-off accepté : un offline > 5 min revient en revalidation réseau, mais
// l'AC5 (< 100 ms offline) reste satisfait sur le hit cached pendant la fenêtre.
const durableContentCache: RuntimeCaching = {
  matcher: ({ url, sameOrigin }) => sameOrigin && isDurableContentPath(url.pathname + url.search),
  handler: new StaleWhileRevalidate({
    cacheName: 'durable-content',
    plugins: [new ExpirationPlugin({ maxAgeSeconds: 5 * 60, maxEntries: 64 })],
  }),
};

// Story 2.3 (AC4) — fiche artisan : pas de runtime cache (review 2026-06-17 P19).
// La page est authentifiée et personnalisée (ContributorPanel visible si isOwner)
// → un CacheFirst sans clé user fuiterait le HTML d'un user à un autre sur
// appareil partagé. AC4 strict (< 100ms offline) régressé : la fiche détaillée
// nécessite réseau ; le bouton `tel:` reste OS-level (marche hors-ligne) et
// l'annuaire (lecture publique anonyme) reste cachable. Le 410/cache strict
// reviendra avec Story 6.1 (slugs canoniques + invalidation explicite).

// Story 2.5 review P12 + Story 2.8 — JAMAIS cacher les surfaces token-based
// publiques (token raw dans l'URL + PII fiche dans le HTML) : `/consent/[token]`,
// `/respond/[token]`, `/artisan/contact`. Passe BEFORE defaultCache (NetworkFirst
// HTML same-origin) qui sinon stockerait le HTML localement (leak token + nom).
const tokenSurfaceBypass: RuntimeCaching = {
  matcher: ({ url, sameOrigin }) => sameOrigin && isTokenSurfacePath(url.pathname),
  handler: new NetworkOnly(),
};

// Story 7.3 — page de repli hors-ligne. Précachée via `additionalPrecacheEntries`
// (next.config.ts) ; servie quand une navigation (document) échoue ET n'est pas
// déjà en cache (ex. toute première visite sans réseau). MVP FR-only : un seul
// shell FR couvre les deux locales.
const OFFLINE_FALLBACK_URL = '/fr/offline';

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  // AC4 — activation gracieuse : le nouveau SW prend la main immédiatement
  // (skipWaiting + clientsClaim) SANS forcer de hard reload ; un toast client
  // (ServiceWorkerUpdater) propose un rafraîchissement doux.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: supportsNavigationPreload,
  runtimeCaching: [
    tokenSurfaceBypass,
    communityWriteSync,
    durableContentCache,
    ephemeralFeedCache,
    annuaireCache,
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: OFFLINE_FALLBACK_URL,
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

serwist.addEventListeners();
