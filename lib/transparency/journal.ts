// Story 5.4 — couche données du journal public de modération. Lit la vue
// moderation_log_public (5.1) : lecture anon + authenticated, PII strippée
// (display_name co_mod only, cibles user_deleted masquées). Server-only.
//
// Pagination keyset (created_at desc) : stable même si de nouveaux events
// s'insèrent pendant le scroll (vs offset qui décale). Le curseur = created_at
// du dernier item rendu.

import { createClient } from '@/lib/supabase/server';
import { actionsForFilter, isJournalAction, type JournalAction } from './events';

export const JOURNAL_PAGE_SIZE = 20;

export type JournalEntry = {
  id: string;
  createdAt: string;
  action: JournalAction;
  targetKind: string | null;
  reasonCode: string | null;
  actorDisplayName: string | null;
};

export type JournalFilters = {
  filter?: string | null; // catégorie (all/removals/…)
  from?: string | null; // ISO date (inclus)
  to?: string | null; // ISO date (inclus, fin de journée appliquée en amont)
};

export type JournalPage = {
  entries: JournalEntry[];
  nextCursor: string | null; // created_at à passer pour la page suivante
};

export async function fetchJournalPage(
  filters: JournalFilters,
  cursor?: string | null,
): Promise<JournalPage> {
  const supabase = await createClient();

  let query = supabase
    .from('moderation_log_public')
    .select('id, created_at, action, target_kind, reason_code, actor_display_name')
    .in('action', [...actionsForFilter(filters.filter)])
    .order('created_at', { ascending: false })
    .limit(JOURNAL_PAGE_SIZE + 1); // +1 pour détecter s'il y a une page suivante

  if (cursor) query = query.lt('created_at', cursor);
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lte('created_at', filters.to);

  const { data, error } = await query;
  if (error || !data) return { entries: [], nextCursor: null };

  const hasMore = data.length > JOURNAL_PAGE_SIZE;
  const slice = hasMore ? data.slice(0, JOURNAL_PAGE_SIZE) : data;

  const entries: JournalEntry[] = slice
    .filter((r) => r.created_at !== null && isJournalAction(r.action))
    .map((r) => ({
      id: r.id ?? r.created_at!,
      createdAt: r.created_at!,
      action: r.action as JournalAction,
      targetKind: r.target_kind,
      reasonCode: r.reason_code,
      actorDisplayName: r.actor_display_name,
    }));

  const nextCursor = hasMore ? (entries[entries.length - 1]?.createdAt ?? null) : null;
  return { entries, nextCursor };
}
