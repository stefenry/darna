// Story 6.4 — état des réactions 👍 pour un lot de cibles (count agrégé + « j'ai
// réagi »). Le compte vient de la vue `reaction_counts` (sans PII) ; « reacted »
// de mes propres lignes (RLS select_own → jamais celles d'autrui).

import { createClient } from '@/lib/supabase/server';
import type { ReactionTarget } from '@/lib/reactions/config';

export type ReactionState = { count: number; reacted: boolean };

export async function fetchReactionStates(
  targetType: ReactionTarget,
  ids: string[],
): Promise<Map<string, ReactionState>> {
  const map = new Map<string, ReactionState>();
  for (const id of ids) map.set(id, { count: 0, reacted: false });
  if (ids.length === 0) return map;

  const supabase = await createClient();
  const [{ data: counts }, { data: mine }] = await Promise.all([
    supabase
      .from('reaction_counts')
      .select('target_id, count')
      .eq('target_type', targetType)
      .in('target_id', ids),
    supabase
      .from('reactions')
      .select('target_id')
      .eq('target_type', targetType)
      .in('target_id', ids),
  ]);

  for (const c of counts ?? []) {
    const s = map.get(c.target_id as string);
    if (s) s.count = (c.count as number) ?? 0;
  }
  for (const m of mine ?? []) {
    const s = map.get(m.target_id);
    if (s) s.reacted = true;
  }
  return map;
}

/** Raccourci mono-cible (pages détail alerte / bon plan). */
export async function fetchReactionState(
  targetType: ReactionTarget,
  id: string,
): Promise<ReactionState> {
  return (await fetchReactionStates(targetType, [id])).get(id) ?? { count: 0, reacted: false };
}
