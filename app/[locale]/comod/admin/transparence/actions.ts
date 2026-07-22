'use server';

// Story 8.4 (FR54) — export du journal de modération sur période (audit CNDP).
// Garde co_mod (NFR21, double protection derrière le proxy + le layout). Lecture
// de la vue redaction-safe `moderation_log_public` (jamais de PII auteur). Upload
// Storage (URL signée 24h) avec repli inline si le storage est indisponible.

import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { requireComod } from '@/lib/auth/require-comod';
import {
  fetchModerationExportRows,
  normalizeRangeDate,
  toCsv,
  toJson,
  EXPORT_COLUMNS,
  type ModerationExportFormat,
} from '@/lib/exports/moderation';
import { uploadExport } from '@/lib/exports/storage';
import { log } from '@/lib/logger';
// Type + état initial dans export-state.ts : un fichier 'use server' ne peut
// exporter QUE des fonctions async (l'export d'objet cassait la route au runtime).
import type { ModerationExportState } from './export-state';

export async function exportModerationLog(
  _prev: ModerationExportState,
  formData: FormData,
): Promise<ModerationExportState> {
  const guard = await requireComod();
  if (!guard.ok) return { ok: false, code: 'forbidden' };

  const format: ModerationExportFormat = formData.get('format') === 'json' ? 'json' : 'csv';
  const localeRaw = formData.get('locale');
  const locale = localeRaw === 'ar' ? 'ar' : 'fr';
  const from = normalizeRangeDate(
    typeof formData.get('from') === 'string' ? (formData.get('from') as string) : undefined,
  );
  const to = normalizeRangeDate(
    typeof formData.get('to') === 'string' ? (formData.get('to') as string) : undefined,
    true,
  );

  const supabase = await createClient();
  let rows;
  try {
    rows = await fetchModerationExportRows(supabase, from, to);
  } catch (cause) {
    log({
      level: 'error',
      event: 'export.moderation_threw',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorName: cause instanceof Error ? cause.name : 'unknown' },
    });
    return { ok: false, code: 'failed' };
  }

  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.replace(/[:.]/g, '-');

  let content: string;
  let mime: string;
  let ext: string;
  if (format === 'json') {
    content = toJson(rows, { from, to, generatedAt });
    mime = 'application/json';
    ext = 'json';
  } else {
    const t = await getTranslations({ locale, namespace: 'comod.transparence.columns' });
    const headers = Object.fromEntries(EXPORT_COLUMNS.map((c) => [c, t(c)]));
    content = toCsv(rows, headers);
    mime = 'text/csv;charset=utf-8';
    ext = 'csv';
  }

  const filename = `darna-moderation-${stamp}.${ext}`;
  const path = `moderation/${guard.user.id}/${stamp}.${ext}`;
  const url = await uploadExport(path, content, mime);

  log({
    level: 'info',
    event: 'export.moderation_completed',
    user_id: guard.user.id,
    residence_id: null,
    request_id: null,
    payload: { format, rows: rows.length, mode: url ? 'url' : 'inline' },
  });

  if (!url) return { ok: true, mode: 'inline', content, filename, mime };
  return { ok: true, mode: 'url', url, filename };
}
