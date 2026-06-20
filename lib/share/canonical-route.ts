// Story 6.1/6.3 — logique partagée des routes canoniques courtes (`/artisan/<slug>`
// etc.), montée par 4 route handlers minces. Émet les bons STATUS HTTP :
//   - slug malformé / inexistant → 404
//   - tombstone (soft-deleted) ou expiré → 410 Gone (CC #19)
//   - vivant + visiteur anonyme    → 200 teaser + CTA `?next=` (FR39, capture 6.3)
//   - vivant + résident connecté   → 307 vers la fiche communautaire (deep link FR38)

import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectLocaleFromHeaders } from '@/lib/i18n/detect-locale';
import { canonicalPath, communityPath, siteUrl } from './canonical';
import { resolveCanonicalEntity } from './resolve-entity';
import { renderInterstitial } from './interstitial';
import type { ShareKind } from './entities';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'x-robots-tag': 'noindex, nofollow',
} as const;

export async function handleCanonical(request: NextRequest, kind: ShareKind, slugRaw: string) {
  const locale = detectLocaleFromHeaders(
    request.headers.get('cookie'),
    request.headers.get('accept-language'),
  );

  if (!SLUG_RE.test(slugRaw)) {
    return new Response(renderInterstitial({ locale, variant: 'not-found' }), {
      status: 404,
      headers: HTML_HEADERS,
    });
  }

  const res = await resolveCanonicalEntity(kind, slugRaw, locale);

  if (res.status === 'not-found') {
    return new Response(renderInterstitial({ locale, variant: 'not-found' }), {
      status: 404,
      headers: HTML_HEADERS,
    });
  }
  if (res.status === 'gone') {
    return new Response(renderInterstitial({ locale, variant: 'gone' }), {
      status: 410,
      headers: HTML_HEADERS,
    });
  }

  // Vivant : un résident connecté est routé directement vers la fiche (deep link) ;
  // un visiteur anonyme voit le teaser + CTA d'inscription (contexte préservé 6.3).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const target = `${siteUrl()}${communityPath(locale, kind, slugRaw)}`;
    return Response.redirect(target, 307);
  }

  const ctaHref = `/${locale}/admission?next=${encodeURIComponent(canonicalPath(kind, slugRaw))}`;
  return new Response(
    renderInterstitial({
      locale,
      variant: 'teaser',
      kind: res.teaser.kind,
      title: res.teaser.title,
      subtitle: res.teaser.subtitle,
      ctaHref,
    }),
    { status: 200, headers: HTML_HEADERS },
  );
}
