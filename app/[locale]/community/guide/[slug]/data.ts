// Story 3.2 (AC3/AC4/AC8) — couche données entrée Guide (deep link, server-only).
//
// `cache(_fetch…)` dédupe l'appel (generateMetadata + page = 1 fetch). RLS
// `guide_entries_resident_select_residence` scope la résidence → un slug d'une
// AUTRE résidence renvoie `null` → `notFound()` (404, pas 403 : on ne révèle pas
// l'existence cross-tenant). Fallback FR (FR48) + flag `untranslated` résolus ici.

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { GuideThemeKey } from '@/lib/content/guide';
import type { Locale } from '@/lib/i18n/config';

export type GuideEntryDetail = {
  slug: string;
  themeKey: GuideThemeKey;
  title: string;
  /** Corps Markdown dans la locale (fallback FR si AR absent). */
  body: string;
  untranslated: boolean;
};

export type FetchGuideEntryResult =
  | { kind: 'found'; entry: GuideEntryDetail }
  | { kind: 'not-found' };

type EntryRow = {
  slug: string;
  theme_key: GuideThemeKey;
  title_fr: string;
  title_ar: string | null;
  body_fr_markdown: string;
  body_ar_markdown: string | null;
};

export const fetchGuideEntryBySlug = cache(_fetchGuideEntryBySlug);

async function _fetchGuideEntryBySlug(
  locale: Locale,
  slug: string,
): Promise<FetchGuideEntryResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('guide_entries')
    .select('slug, theme_key, title_fr, title_ar, body_fr_markdown, body_ar_markdown')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { kind: 'not-found' };

  const row = data as EntryRow;
  const isAr = locale === 'ar';
  const title = isAr && row.title_ar?.trim() ? row.title_ar : row.title_fr;
  const body = isAr && row.body_ar_markdown?.trim() ? row.body_ar_markdown : row.body_fr_markdown;
  const untranslated = isAr && !row.body_ar_markdown?.trim();

  return {
    kind: 'found',
    entry: { slug: row.slug, themeKey: row.theme_key, title, body, untranslated },
  };
}
