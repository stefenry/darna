// Story 7.3 — prédicats de routage du Service Worker, extraits ici en fonctions
// PURES pour être unit-testés sans contexte SW (sw/index.ts les importe et y
// adjoint le garde `sameOrigin`). Toute évolution des stratégies de cache se
// teste donc côté Node.

/** Données JSON de l'annuaire (CacheFirst, lecture offline < 100ms). */
export function isAnnuaireDataPath(pathname: string): boolean {
  return pathname === '/api/annuaire';
}

/**
 * Contenu durable éditorial : Guide (+ /[slug], + pack-accueil) et Numéros
 * utiles (StaleWhileRevalidate). On matche pathname + search car les payloads
 * RSC ajoutent `?_rsc=` (entrée de cache distincte par URL complète).
 */
export function isDurableContentPath(pathnameAndSearch: string): boolean {
  return /\/community\/(guide|numeros-utiles)(\/|$|\?)/.test(pathnameAndSearch);
}

/**
 * Feeds éphémères (alertes, bons plans) : NetworkFirst — ils changent vite, on
 * privilégie la fraîcheur mais on garde un fallback cache hors-ligne.
 */
export function isEphemeralFeedPath(pathname: string): boolean {
  return /\/community\/(alertes|bons-plans)(\/|$)/.test(pathname);
}

/**
 * Surfaces token-based publiques : JAMAIS cacher (token raw dans l'URL + PII).
 * `/consent/[token]`, `/respond/[token]`, `/artisan/contact`.
 */
export function isTokenSurfacePath(pathname: string): boolean {
  return (
    pathname.startsWith('/consent/') ||
    pathname.startsWith('/respond/') ||
    pathname === '/artisan/contact'
  );
}

/**
 * Écritures communautaires (Server Actions POST sous /[locale]/community/…) :
 * candidates au background-sync si la requête échoue hors-ligne.
 */
export function isCommunityWritePath(pathname: string): boolean {
  return /^\/(fr|ar)\/community\//.test(pathname);
}
