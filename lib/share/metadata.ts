// Story 6.1 — fragment Metadata canonique commun aux fiches communautaires :
// `<link rel="canonical">` vers l'URL courte stable, OpenGraph (titre/desc/image
// Darna par défaut), et `noindex, nofollow` (les fiches communautaires ne sont
// JAMAIS indexées — PRD SEO Strategy : contenu réservé résidents).

import type { Metadata } from 'next';
import { canonicalUrl, siteUrl } from './canonical';
import type { ShareKind } from './entities';

export function canonicalMetadata(
  kind: ShareKind,
  slug: string,
  opts: { title: string; description?: string | null },
): Metadata {
  const url = canonicalUrl(kind, slug);
  return {
    title: opts.title,
    alternates: { canonical: url },
    robots: { index: false, follow: false },
    openGraph: {
      title: opts.title,
      description: opts.description ?? undefined,
      url,
      siteName: 'Darna',
      images: [`${siteUrl()}/opengraph-image.png`],
    },
  };
}
