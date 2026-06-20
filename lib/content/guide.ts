// Story 3.2 — constantes partagées du Guide (liste 3.2 + CRUD co_mod 3.5).
// Ordre d'affichage canonique des thèmes (l'enum DB n'impose pas d'ordre de
// rendu). Les libellés sont résolus à l'affichage via i18n `community.guide.themes.<key>`
// (NFR47 — pas de display_name en base).

import type { Database } from '@/lib/supabase/types.generated';

export type GuideThemeKey = Database['public']['Enums']['guide_theme_key'];

export const GUIDE_THEME_ORDER: readonly GuideThemeKey[] = [
  'codes_portails',
  'horaires_gardien',
  'regles_jardin',
  'dechets',
  'traditions',
  'securite',
  'autre',
] as const;
