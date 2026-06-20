// Story 6.1/6.3 — résolution d'un slug canonique → teaser public OU tombstone.
//
// Lecture via le client ADMIN (service role) : la route canonique est PRÉ-AUTH
// (un visiteur non connecté n'a aucune session ; la RLS le bloquerait). On
// n'expose que des champs « teaser » non sensibles (nom, type) — jamais de
// téléphone, corps, ni PII (FR39). Distinction stricte (CC #19) :
//   - `not-found` : aucun slug → HTTP 404 (jamais existé).
//   - `gone`      : slug tombstoné (soft-deleted) OU expiré → HTTP 410.
//   - `found`     : entité vivante et publiquement teasable → 200 / redirect.
// Un artisan non `published` (pending/refused) → `not-found` (on ne révèle pas
// son existence). Une alerte/bon plan expiré → `gone` (a existé, n'est plus là).

import { createAdminClient } from '@/lib/supabase/admin';
import type { Locale } from '@/lib/i18n/config';
import type { ShareKind } from './entities';

export type EntityTeaser = {
  kind: ShareKind;
  slug: string;
  title: string;
  subtitle: string | null;
};

export type ResolveResult =
  | { status: 'found'; teaser: EntityTeaser }
  | { status: 'gone' }
  | { status: 'not-found' };

function pick(locale: Locale, fr: string, ar: string | null | undefined): string {
  if (locale === 'ar' && ar && ar.trim()) return ar.trim();
  return fr.trim();
}

export async function resolveCanonicalEntity(
  kind: ShareKind,
  slug: string,
  locale: Locale,
): Promise<ResolveResult> {
  const admin = createAdminClient();
  const nowMs = Date.now();

  if (kind === 'artisan') {
    const { data } = await admin
      .from('artisans')
      .select(
        'slug, display_name_fr, display_name_ar, state, deleted_at, artisan_tags ( tags ( label_fr, label_ar ) )',
      )
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return { status: 'not-found' };
    if (data.deleted_at) return { status: 'gone' };
    if (data.state !== 'published') return { status: 'not-found' };
    const firstTag = (data.artisan_tags ?? [])
      .map((at) => (at as { tags: { label_fr: string; label_ar: string | null } | null }).tags)
      .find((t): t is { label_fr: string; label_ar: string | null } => !!t);
    return {
      status: 'found',
      teaser: {
        kind,
        slug,
        title: pick(locale, data.display_name_fr, data.display_name_ar),
        subtitle: firstTag ? pick(locale, firstTag.label_fr, firstTag.label_ar) : null,
      },
    };
  }

  if (kind === 'alert' || kind === 'tip') {
    const table = kind === 'alert' ? 'alerts' : 'tips';
    const { data } = await admin
      .from(table)
      .select('slug, title_fr, title_ar, deleted_at, expires_at')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return { status: 'not-found' };
    if (data.deleted_at || new Date(data.expires_at).getTime() <= nowMs) return { status: 'gone' };
    return {
      status: 'found',
      teaser: { kind, slug, title: pick(locale, data.title_fr, data.title_ar), subtitle: null },
    };
  }

  // guide_entry
  const { data } = await admin
    .from('guide_entries')
    .select('slug, title_fr, title_ar, deleted_at')
    .eq('slug', slug)
    .maybeSingle();
  if (!data) return { status: 'not-found' };
  if (data.deleted_at) return { status: 'gone' };
  return {
    status: 'found',
    teaser: { kind, slug, title: pick(locale, data.title_fr, data.title_ar), subtitle: null },
  };
}
