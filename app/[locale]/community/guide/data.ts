// Story 3.2 (AC1/AC2/AC4/AC8) — couche données Guide (server-only, RLS-scopée).
//
// Lecture via client session uniquement : `guide_entries_resident_select_residence`
// (3.1) scope la résidence + exclut `deleted_at`. Jamais de createAdminClient.
// La recherche passe par le RPC `search_guide_entries` (SECURITY INVOKER → RLS du
// résident appliquée, ts_rank + ts_headline). Fallback FR (FR48) résolu ici.

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { sanitizeQuery, hasQuery } from '@/lib/search/fts';
import { GUIDE_THEME_ORDER, type GuideThemeKey } from '@/lib/content/guide';
import type { Locale } from '@/lib/i18n/config';

export type GuideListEntry = {
  slug: string;
  themeKey: GuideThemeKey;
  title: string;
  /** `true` si locale AR mais titre AR absent → badge « Non traduit » (FR48). */
  untranslated: boolean;
};

export type GuideThemeGroup = {
  themeKey: GuideThemeKey;
  entries: GuideListEntry[];
};

export type GuideSearchHit = {
  slug: string;
  themeKey: GuideThemeKey;
  title: string;
  /** HTML `ts_headline` : texte échappé par Postgres + balises <mark> (sûr — D3). */
  snippet: string;
  rank: number;
};

type ListRow = {
  slug: string;
  theme_key: GuideThemeKey;
  title_fr: string;
  title_ar: string | null;
  order_in_theme: number;
};

/**
 * Entrées du Guide groupées par thème (ordre canonique GUIDE_THEME_ORDER), triées
 * par `order_in_theme`. Lève en cas d'erreur Supabase (la page log + error state).
 */
export const fetchGuideEntries = cache(_fetchGuideEntries);

async function _fetchGuideEntries(locale: Locale): Promise<GuideThemeGroup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('guide_entries')
    .select('slug, theme_key, title_fr, title_ar, order_in_theme')
    .is('deleted_at', null)
    .order('theme_key', { ascending: true })
    .order('order_in_theme', { ascending: true });
  if (error) throw error;

  const byTheme = new Map<GuideThemeKey, GuideListEntry[]>();
  for (const row of (data ?? []) as ListRow[]) {
    const isAr = locale === 'ar';
    const title = isAr && row.title_ar?.trim() ? row.title_ar : row.title_fr;
    const entry: GuideListEntry = {
      slug: row.slug,
      themeKey: row.theme_key,
      title,
      untranslated: isAr && !row.title_ar?.trim(),
    };
    const list = byTheme.get(row.theme_key);
    if (list) list.push(entry);
    else byTheme.set(row.theme_key, [entry]);
  }

  // Ordre d'affichage canonique ; seuls les thèmes non vides sont rendus.
  return GUIDE_THEME_ORDER.filter((key) => byTheme.has(key)).map((themeKey) => ({
    themeKey,
    entries: byTheme.get(themeKey)!,
  }));
}

/**
 * Recherche FTS classée + snippet surligné. `[]` si la requête est vide. RLS
 * appliquée par le RPC SECURITY INVOKER (aucune fuite cross-résidence).
 */
export async function searchGuide(locale: Locale, rawQuery: string): Promise<GuideSearchHit[]> {
  if (!hasQuery(rawQuery)) return [];
  const query = sanitizeQuery(rawQuery);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('search_guide_entries', {
    p_query: query,
    p_locale: locale,
  });
  if (error) throw error;
  return ((data ?? []) as ListRowHit[]).map((r) => ({
    slug: r.slug,
    themeKey: r.theme_key,
    title: r.title,
    snippet: r.snippet ?? '',
    // PostgREST sérialise `real` en number ici (rpc) ; coercition défensive.
    rank: typeof r.rank === 'number' ? r.rank : Number(r.rank ?? 0),
  }));
}

type ListRowHit = {
  slug: string;
  theme_key: GuideThemeKey;
  title: string;
  snippet: string | null;
  rank: number | string | null;
};
