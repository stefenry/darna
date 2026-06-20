// Story 3.3 — constantes partagées Numéros utiles (liste 3.3 + CRUD co_mod 3.5).
// Ordre d'affichage canonique des catégories (l'enum DB n'impose pas d'ordre).
// Libellés résolus à l'affichage via i18n `community.numerosUtiles.categories.<key>`.

import type { Database } from '@/lib/supabase/types.generated';

export type UsefulNumberCategory = Database['public']['Enums']['useful_number_category'];

export const USEFUL_NUMBER_CATEGORY_ORDER: readonly UsefulNumberCategory[] = [
  'securite',
  'syndic',
  'urgences',
  'sante',
  'autre',
] as const;
