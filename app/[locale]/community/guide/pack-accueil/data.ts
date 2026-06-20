// Story 3.4 (AC2/AC6) — couche données Pack accueil (server-only, RLS-scopée).
//
// Lecture via client session : `pack_entries_resident_select_residence` (3.1)
// scope la résidence + exclut `deleted_at`. Groupé par `section_key` (text libre,
// 3.1 D3) selon l'ordre d'apparition (min order_in_section). Fallback FR (FR48)
// + flag `untranslated` (badge partagé `community.guide.notTranslatedBadge`).

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/config';

export type PackEntry = {
  title: string;
  body: string;
  untranslated: boolean;
};

export type PackSection = {
  sectionKey: string;
  entries: PackEntry[];
};

type Row = {
  section_key: string;
  title_fr: string;
  title_ar: string | null;
  body_fr_markdown: string;
  body_ar_markdown: string | null;
  order_in_section: number;
};

export const fetchPackEntries = cache(_fetchPackEntries);

async function _fetchPackEntries(locale: Locale): Promise<PackSection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pack_entries')
    .select('section_key, title_fr, title_ar, body_fr_markdown, body_ar_markdown, order_in_section')
    .is('deleted_at', null)
    // D5 : ordre des sections = ordre d'apparition (min order_in_section), PAS
    // alphabétique. On trie globalement par order_in_section, puis on regroupe
    // first-seen → une section apparaît à la position de son entrée la plus basse.
    // `section_key` en tie-break déterministe.
    .order('order_in_section', { ascending: true })
    .order('section_key', { ascending: true });
  if (error) throw error;

  const isAr = locale === 'ar';
  // Map insertion-ordered : la 1ʳᵉ apparition (order_in_section le plus bas) fixe
  // l'ordre des sections ; les entrées d'une section restent triées par order.
  const bySection = new Map<string, PackEntry[]>();
  for (const row of (data ?? []) as Row[]) {
    const title = isAr && row.title_ar?.trim() ? row.title_ar : row.title_fr;
    const body = isAr && row.body_ar_markdown?.trim() ? row.body_ar_markdown : row.body_fr_markdown;
    const entry: PackEntry = {
      title,
      body,
      untranslated: isAr && !row.body_ar_markdown?.trim(),
    };
    const list = bySection.get(row.section_key);
    if (list) list.push(entry);
    else bySection.set(row.section_key, [entry]);
  }

  return [...bySection.entries()].map(([sectionKey, entries]) => ({ sectionKey, entries }));
}
