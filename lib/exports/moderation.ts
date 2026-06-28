// Story 8.4 (FR54, CC#19) — construction de l'export du journal de modération pour
// l'audit CNDP. Source : vue `moderation_log_public` (déjà redaction-safe : aucune
// PII auteur, cibles PII masquées, exclut report_opened + *_self_retracted). On
// reste STRICTEMENT cohérent avec la vue publique du journal (8.4 AC « consistent
// with the redacted public journal view »). Colonnes : created_at, event_key,
// actor_pseudonym, target_type, motive_key — pseudonymes + identifiants structurels
// uniquement. CSV : BOM UTF-8 (compat Excel), valeurs échappées RFC 4180.

import type { SupabaseClient } from '@supabase/supabase-js';

export type ModerationExportFormat = 'csv' | 'json';

export type ModerationExportRow = {
  created_at: string;
  event_key: string;
  actor_pseudonym: string;
  target_type: string;
  motive_key: string;
};

// Colonnes ordonnées + clé i18n d'en-tête (comod.transparence.columns.<key>).
export const EXPORT_COLUMNS = [
  'created_at',
  'event_key',
  'actor_pseudonym',
  'target_type',
  'motive_key',
] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Normalise une date `YYYY-MM-DD` (début ou fin de journée UTC). null si invalide.
export function normalizeRangeDate(d: string | undefined, endOfDay = false): string | null {
  if (!d || !ISO_DATE.test(d)) return null;
  return endOfDay ? `${d}T23:59:59.999Z` : `${d}T00:00:00.000Z`;
}

export async function fetchModerationExportRows(
  supabase: SupabaseClient,
  from: string | null,
  to: string | null,
): Promise<ModerationExportRow[]> {
  let query = supabase
    .from('moderation_log_public')
    .select('created_at, action, actor_display_name, target_kind, reason_code')
    .order('created_at', { ascending: false });
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((r) => ({
    created_at: r.created_at ?? '',
    event_key: r.action ?? '',
    actor_pseudonym: r.actor_display_name ?? '',
    target_type: r.target_kind ?? '',
    motive_key: r.reason_code ?? '',
  }));
}

// Échappement RFC 4180 : double les guillemets, quote si , " \r \n présents.
function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// CSV avec BOM UTF-8 (Excel détecte l'UTF-8) et en-têtes localisés.
export function toCsv(rows: ModerationExportRow[], headers: Record<string, string>): string {
  const headerLine = EXPORT_COLUMNS.map((c) => csvCell(headers[c] ?? c)).join(',');
  const lines = rows.map((row) => EXPORT_COLUMNS.map((c) => csvCell(row[c])).join(','));
  return `﻿${[headerLine, ...lines].join('\r\n')}\r\n`;
}

export function toJson(
  rows: ModerationExportRow[],
  meta: { from: string | null; to: string | null; generatedAt: string },
): string {
  return JSON.stringify(
    {
      schema_version: '1.0',
      generated_at: meta.generatedAt,
      range: { from: meta.from, to: meta.to },
      events: rows,
    },
    null,
    2,
  );
}
