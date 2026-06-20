import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/config';
import { pickLocalized, type TipCategoryKey } from '@/lib/content/ephemeral';

// Story 4.4 — lecture du feed unifié + détail alerte. RLS filtre déjà au scope
// résidence ; on RAJOUTE explicitement `deleted_at is null` + `expires_at > now()`
// car la policy `*_author_select_own` laisserait fuiter les items expirés de
// l'auteur dans le feed (AC4.4 : expirés filtrés côté serveur).

export type FeedItem = {
  kind: 'alert' | 'tip';
  id: string;
  slug: string;
  title: string;
  untranslated: boolean;
  createdAt: string;
  expiresAt: string;
  category: TipCategoryKey | null;
};

export type AlertDetail = {
  id: string;
  slug: string;
  title: string;
  body: string;
  untranslated: boolean;
  createdAt: string;
  expiresAt: string;
  isOwn: boolean;
};

export type AlertDetailResult = { kind: 'found'; entry: AlertDetail } | { kind: 'not-found' };

export const fetchFeed = cache(_fetchFeed);

async function _fetchFeed(locale: Locale): Promise<FeedItem[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [alertsRes, tipsRes] = await Promise.all([
    supabase
      .from('alerts')
      .select('id, slug, title_fr, title_ar, created_at, expires_at')
      .is('deleted_at', null)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false }),
    supabase
      .from('tips')
      .select('id, slug, title_fr, title_ar, created_at, expires_at, category_key')
      .is('deleted_at', null)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false }),
  ]);
  if (alertsRes.error) throw alertsRes.error;
  if (tipsRes.error) throw tipsRes.error;

  const items: FeedItem[] = [
    ...(alertsRes.data ?? []).map((a) => {
      const t = pickLocalized(locale, a.title_fr, a.title_ar);
      return {
        kind: 'alert' as const,
        id: a.id,
        slug: a.slug,
        title: t.value,
        untranslated: t.untranslated,
        createdAt: a.created_at,
        expiresAt: a.expires_at,
        category: null,
      };
    }),
    ...(tipsRes.data ?? []).map((t) => {
      const loc = pickLocalized(locale, t.title_fr, t.title_ar);
      return {
        kind: 'tip' as const,
        id: t.id,
        slug: t.slug,
        title: loc.value,
        untranslated: loc.untranslated,
        createdAt: t.created_at,
        expiresAt: t.expires_at,
        category: t.category_key as TipCategoryKey,
      };
    }),
  ];

  // Tri fraîcheur global (created_at DESC) après fusion des deux sources.
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return items;
}

export const fetchAlertBySlug = cache(_fetchAlertBySlug);

async function _fetchAlertBySlug(locale: Locale, slug: string): Promise<AlertDetailResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('alerts')
    .select(
      'id, slug, title_fr, title_ar, body_fr, body_ar, created_at, expires_at, created_by, deleted_at',
    )
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { kind: 'not-found' };

  const title = pickLocalized(locale, data.title_fr, data.title_ar);
  const body = pickLocalized(locale, data.body_fr, data.body_ar);
  return {
    kind: 'found',
    entry: {
      id: data.id,
      slug: data.slug,
      title: title.value,
      body: body.value,
      untranslated: title.untranslated || body.untranslated,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      isOwn: !!user && data.created_by === user.id,
    },
  };
}
