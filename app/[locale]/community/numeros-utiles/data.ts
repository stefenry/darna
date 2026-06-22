// Story 3.3 (AC1/AC3/AC6) — couche données Numéros utiles (server-only, RLS-scopée).
//
// Lecture via client session uniquement : `useful_numbers_resident_select_residence`
// (3.1) scope la résidence + exclut `deleted_at`. Jamais de createAdminClient.
// Fallback FR (FR48) résolu ici. Story 7.5 : flag `untranslated` (label AR vide)
// → indicateur partagé sur la carte (la note reste sans badge, complément court).

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import {
  USEFUL_NUMBER_CATEGORY_ORDER,
  type UsefulNumberCategory,
} from '@/lib/content/useful-numbers';
import type { Locale } from '@/lib/i18n/config';

export type UsefulNumber = {
  id: string;
  categoryKey: UsefulNumberCategory;
  label: string;
  phoneE164: string;
  notes: string | null;
  // Story 7.5 — en AR, le label retombe sur le FR faute de traduction → indicateur.
  untranslated: boolean;
};

export type UsefulNumberGroup = {
  categoryKey: UsefulNumberCategory;
  numbers: UsefulNumber[];
};

type Row = {
  id: string;
  category_key: UsefulNumberCategory;
  label_fr: string;
  label_ar: string | null;
  phone_e164: string;
  notes_fr: string | null;
  notes_ar: string | null;
  order_in_category: number;
};

export const fetchUsefulNumbers = cache(_fetchUsefulNumbers);

async function _fetchUsefulNumbers(locale: Locale): Promise<UsefulNumberGroup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('useful_numbers')
    .select(
      'id, category_key, label_fr, label_ar, phone_e164, notes_fr, notes_ar, order_in_category',
    )
    .is('deleted_at', null)
    .order('category_key', { ascending: true })
    .order('order_in_category', { ascending: true });
  if (error) throw error;

  const isAr = locale === 'ar';
  const byCategory = new Map<UsefulNumberCategory, UsefulNumber[]>();
  for (const row of (data ?? []) as Row[]) {
    const label = isAr && row.label_ar?.trim() ? row.label_ar : row.label_fr;
    const notes = isAr && row.notes_ar?.trim() ? row.notes_ar : row.notes_fr;
    const number: UsefulNumber = {
      id: row.id,
      categoryKey: row.category_key,
      label,
      phoneE164: row.phone_e164,
      notes: notes?.trim() ? notes : null,
      untranslated: isAr && !row.label_ar?.trim(),
    };
    const list = byCategory.get(row.category_key);
    if (list) list.push(number);
    else byCategory.set(row.category_key, [number]);
  }

  return USEFUL_NUMBER_CATEGORY_ORDER.filter((key) => byCategory.has(key)).map((categoryKey) => ({
    categoryKey,
    numbers: byCategory.get(categoryKey)!,
  }));
}
