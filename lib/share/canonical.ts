// Story 6.1 — fabriques d'URL canoniques (pures, testables, isomorphes).
//
// `canonicalPath` = chemin court SANS locale (`/artisan/<slug>`), la cible des
// liens partagés (FR36/FR37). `canonicalUrl` = absolu via NEXT_PUBLIC_SITE_URL
// (single source of truth contre l'injection de Host header). `communityPath` =
// la fiche authentifiée RLS-scopée vers laquelle on route un résident connecté.

import { env } from '@/lib/env';
import type { Locale } from '@/lib/i18n/config';
import { CANONICAL_SEGMENT, COMMUNITY_SEGMENT, type ShareKind } from './entities';

/** Base absolue sans slash final (NEXT_PUBLIC_SITE_URL). */
export function siteUrl(): string {
  return env.client.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
}

/** Chemin canonique court, locale-less : `/artisan/<slug>`. */
export function canonicalPath(kind: ShareKind, slug: string): string {
  return `/${CANONICAL_SEGMENT[kind]}/${slug}`;
}

/** URL canonique absolue : `https://darna.org/artisan/<slug>`. */
export function canonicalUrl(kind: ShareKind, slug: string): string {
  return `${siteUrl()}${canonicalPath(kind, slug)}`;
}

/** Fiche communautaire authentifiée : `/<locale>/community/<seg>/<slug>`. */
export function communityPath(locale: Locale, kind: ShareKind, slug: string): string {
  return `/${locale}/community/${COMMUNITY_SEGMENT[kind]}/${slug}`;
}
