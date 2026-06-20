// Story 5.3 — couche données de la file de modération (co_mod, server-only).
// Lecture via client authentifié : RLS reports_co_mod_select_residence borne à la
// résidence du co_mod. Chaque report est enrichi de son snippet de cible
// (resolveTarget) et d'un pseudonyme reporter stable (jamais le nom réel).

import { createClient } from '@/lib/supabase/server';
import { resolveTarget, snippet, type ResolvedTarget } from '@/lib/moderation/target-content';
import type { ReportReason, ReportTargetType } from '@/lib/validation/report';

type Locale = 'fr' | 'ar';

export type ReportListItem = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  note: string | null;
  createdAt: string;
  reporterPseudonym: string;
  snippet: string;
};

export type PriorAction = {
  action: string;
  createdAt: string;
  reasonCode: string | null;
};

export type ReportDetail = {
  id: string;
  state: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolutionMotive: string | null;
  reporterPseudonym: string;
  target: ResolvedTarget;
  priorActions: PriorAction[];
};

// Pseudonyme reporter : 4 derniers hex de l'uuid (stable, non ré-identifiant).
function reporterPseudonym(reporterId: string | null): string {
  if (!reporterId) return 'Voisin supprimé';
  return `Voisin #${reporterId.replace(/-/g, '').slice(-4).toUpperCase()}`;
}

export async function fetchOpenReports(locale: Locale): Promise<ReportListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reports')
    .select('id, target_type, target_id, reason, note_text, created_at, reporter_id')
    .eq('state', 'open')
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return Promise.all(
    data.map(async (r) => {
      const target = await resolveTarget(locale, r.target_type, r.target_id);
      return {
        id: r.id,
        targetType: r.target_type,
        targetId: r.target_id,
        reason: r.reason,
        note: r.note_text,
        createdAt: r.created_at,
        reporterPseudonym: reporterPseudonym(r.reporter_id),
        snippet: target.exists ? snippet(target) : '—',
      };
    }),
  );
}

export async function fetchReportDetail(locale: Locale, id: string): Promise<ReportDetail | null> {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from('reports')
    .select(
      'id, state, target_type, target_id, reason, note_text, created_at, resolved_at, resolution_motive, reporter_id',
    )
    .eq('id', id)
    .maybeSingle();
  if (!r) return null;

  const target = await resolveTarget(locale, r.target_type, r.target_id);

  // Actions de modération antérieures sur la même cible (content_removed/kept) —
  // visibles via la policy publique de moderation_log (report_opened exclu).
  const { data: prior } = await supabase
    .from('moderation_log')
    .select('action, created_at, reason_code')
    .eq('target_id', r.target_id)
    .in('action', ['content_removed', 'content_kept', 'escalation_triggered'])
    .order('created_at', { ascending: false });

  return {
    id: r.id,
    state: r.state,
    targetType: r.target_type,
    targetId: r.target_id,
    reason: r.reason,
    note: r.note_text,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    resolutionMotive: r.resolution_motive,
    reporterPseudonym: reporterPseudonym(r.reporter_id),
    target,
    priorActions: (prior ?? []).map((p) => ({
      action: p.action,
      createdAt: p.created_at,
      reasonCode: p.reason_code,
    })),
  };
}
