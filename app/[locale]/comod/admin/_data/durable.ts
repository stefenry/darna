// Story 3.5 (Task 5/6 / AC1) — couche données admin co_mod (server-only).
// Lecture via client session : la RLS co_mod (`<table>_co_mod_select_residence`,
// 3.1) scope la résidence ET inclut les lignes soft-deleted (affichage « retiré »
// + restauration future). Pas d'admin client.

import { createClient } from '@/lib/supabase/server';
import { DURABLE_CONFIG, type DurableKind } from '@/lib/content/admin-config';

export type AdminListItem = {
  id: string;
  /** Libellé principal (title_fr / label_fr). */
  title: string;
  /** Sélecteur (theme_key / category_key / section_key). */
  selector: string;
  order: number;
  retired: boolean;
};

export async function fetchAdminList(kind: DurableKind): Promise<AdminListItem[]> {
  const cfg = DURABLE_CONFIG[kind];
  const supabase = await createClient();

  if (kind === 'numeros') {
    const { data, error } = await supabase
      .from('useful_numbers')
      .select('id, label_fr, category_key, order_in_category, deleted_at')
      .order('category_key', { ascending: true })
      .order('order_in_category', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      title: r.label_fr,
      selector: r.category_key,
      order: r.order_in_category,
      retired: r.deleted_at != null,
    }));
  }

  if (kind === 'guide') {
    const { data, error } = await supabase
      .from('guide_entries')
      .select('id, title_fr, theme_key, order_in_theme, deleted_at')
      .order('theme_key', { ascending: true })
      .order('order_in_theme', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      title: r.title_fr,
      selector: r.theme_key,
      order: r.order_in_theme,
      retired: r.deleted_at != null,
    }));
  }

  const { data, error } = await supabase
    .from('pack_entries')
    .select('id, title_fr, section_key, order_in_section, deleted_at')
    .order('section_key', { ascending: true })
    .order('order_in_section', { ascending: true });
  if (error) throw error;
  void cfg;
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title_fr,
    selector: r.section_key,
    order: r.order_in_section,
    retired: r.deleted_at != null,
  }));
}

/** Valeurs brutes d'une entrée pour l'éditeur (édition). `null` si absente/autre
 * résidence (RLS co_mod scope → un id cross-résidence renvoie null). */
export type DurableEntryValues = Record<string, string | number | null>;

export async function fetchAdminEntry(
  kind: DurableKind,
  id: string,
): Promise<DurableEntryValues | null> {
  const supabase = await createClient();

  if (kind === 'numeros') {
    const { data } = await supabase
      .from('useful_numbers')
      .select('category_key, label_fr, label_ar, phone_e164, notes_fr, notes_ar, order_in_category')
      .eq('id', id)
      .maybeSingle();
    return data ?? null;
  }
  if (kind === 'guide') {
    const { data } = await supabase
      .from('guide_entries')
      .select(
        'slug, theme_key, title_fr, title_ar, body_fr_markdown, body_ar_markdown, order_in_theme',
      )
      .eq('id', id)
      .maybeSingle();
    return data ?? null;
  }
  const { data } = await supabase
    .from('pack_entries')
    .select('section_key, title_fr, title_ar, body_fr_markdown, body_ar_markdown, order_in_section')
    .eq('id', id)
    .maybeSingle();
  return data ?? null;
}
