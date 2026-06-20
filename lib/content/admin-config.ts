// Story 3.5 (Task 2) — config d'entité générique pour le CRUD co_mod. Permet à
// l'éditeur / la liste / les actions de rester génériques (paramétrés par `kind`)
// plutôt que triplés. Types dérivés de `Database['public']['Tables']`.

import type { Database } from '@/lib/supabase/types.generated';
import { GUIDE_THEME_ORDER } from '@/lib/content/guide';
import { USEFUL_NUMBER_CATEGORY_ORDER } from '@/lib/content/useful-numbers';

export type DurableKind = 'guide' | 'numeros' | 'pack';

/** Valeur `target_kind` / `p_kind` côté DB (RPC retrait + moderation_log). */
export type DurableDbKind = 'guide_entry' | 'useful_number' | 'pack_entry';

export type DurableTable = 'guide_entries' | 'useful_numbers' | 'pack_entries';

type DurableConfigEntry = {
  kind: DurableKind;
  dbKind: DurableDbKind;
  table: DurableTable;
  /** Segment de route lecture résident (`/community/<route>`). */
  readRoute: string;
  /** A un corps Markdown bilingue + preview (Guide/Pack) vs champs téléphone (Numéros). */
  hasMarkdown: boolean;
  hasPhone: boolean;
  /** Champ d'ordre dans la table. */
  orderField: 'order_in_theme' | 'order_in_category' | 'order_in_section';
  /** i18n namespace du module (`comod.admin.<i18nKey>`). */
  i18nKey: 'guide' | 'numeros' | 'pack';
};

export const DURABLE_CONFIG: Record<DurableKind, DurableConfigEntry> = {
  guide: {
    kind: 'guide',
    dbKind: 'guide_entry',
    table: 'guide_entries',
    readRoute: 'guide',
    hasMarkdown: true,
    hasPhone: false,
    orderField: 'order_in_theme',
    i18nKey: 'guide',
  },
  numeros: {
    kind: 'numeros',
    dbKind: 'useful_number',
    table: 'useful_numbers',
    readRoute: 'numeros-utiles',
    hasMarkdown: false,
    hasPhone: true,
    orderField: 'order_in_category',
    i18nKey: 'numeros',
  },
  pack: {
    kind: 'pack',
    dbKind: 'pack_entry',
    table: 'pack_entries',
    readRoute: 'pack-accueil',
    hasMarkdown: true,
    hasPhone: false,
    orderField: 'order_in_section',
    i18nKey: 'pack',
  },
} as const;

export const DURABLE_KINDS: readonly DurableKind[] = ['guide', 'numeros', 'pack'] as const;

export function isDurableKind(value: string): value is DurableKind {
  return value === 'guide' || value === 'numeros' || value === 'pack';
}

/** Choix des sélecteurs (thème / catégorie) exposés au form, depuis les enums. */
export const GUIDE_THEME_CHOICES = GUIDE_THEME_ORDER;
export const USEFUL_NUMBER_CATEGORY_CHOICES = USEFUL_NUMBER_CATEGORY_ORDER;

export type GuideEntryRow = Database['public']['Tables']['guide_entries']['Row'];
export type UsefulNumberRow = Database['public']['Tables']['useful_numbers']['Row'];
export type PackEntryRow = Database['public']['Tables']['pack_entries']['Row'];
