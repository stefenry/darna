// Story 5.4 — couche données du journal public de modération. Lit la vue
// moderation_log_public (5.1) : lecture anon + authenticated, PII strippée
// (display_name co_mod only, cibles user_deleted masquées). Server-only.
//
// Pagination keyset COMPOSITE (created_at desc, id desc) : stable même si de
// nouveaux events s'insèrent pendant le scroll (vs offset qui décale), ET sans
// sauter d'items lorsque plusieurs events partagent le même created_at (opérations
// batch : purge, suppressions groupées). Le curseur encode `created_at|id`.

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
  nextCursor: string | null; // « created_at|id » du dernier item (keyset composite)
};

// `from`/`to` et le curseur proviennent du client (Server Action loadMoreJournal,
// non authentifiée) → on valide leur FORME avant injection dans la requête
// (défense en profondeur ; PostgREST rejetterait de toute façon une valeur non
// parsable, mais on évite de lui passer du texte arbitraire).
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+([+-]\d{2}:?\d{2}|Z)?)?$/;
const UUID_RE = /^[0-9a-fA-F-]{36}$/;

// Curseur opaque « created_at|id » (ni l'un ni l'autre ne contient « | »).
// Forgé/malformé (ts non-ISO, id non-uuid) → null (repli sur la 1re page).
function parseCursor(cursor: string): { ts: string; id: string } | null {
  const i = cursor.lastIndexOf('|');
  if (i <= 0 || i >= cursor.length - 1) return null;
  const ts = cursor.slice(0, i);
  const id = cursor.slice(i + 1);
  if (!ISO_INSTANT.test(ts) || !UUID_RE.test(id)) return null;
  return { ts, id };
}

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
    .order('id', { ascending: false }) // tie-breaker → keyset stable sur created_at égaux
    .limit(JOURNAL_PAGE_SIZE + 1); // +1 pour détecter s'il y a une page suivante

  if (cursor) {
    const c = parseCursor(cursor);
    if (c) {
      // Strictement « avant » le curseur en ordre (created_at desc, id desc) :
      // created_at < ts, OU (created_at = ts ET id < cursorId). Sans le 2e terme,
      // les ex-aequo de created_at seraient sautés entre deux pages.
      query = query.or(`created_at.lt.${c.ts},and(created_at.eq.${c.ts},id.lt.${c.id})`);
    }
  }
  if (filters.from && ISO_INSTANT.test(filters.from)) query = query.gte('created_at', filters.from);
  if (filters.to && ISO_INSTANT.test(filters.to)) query = query.lte('created_at', filters.to);

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

  // Curseur = dernière LIGNE de la page (slice), pas la dernière entrée filtrée,
  // pour ne pas sauter de ligne entre deux pages.
  const last = slice[slice.length - 1];
  const nextCursor =
    hasMore && last?.created_at && last?.id ? `${last.created_at}|${last.id}` : null;
  return { entries, nextCursor };
}
