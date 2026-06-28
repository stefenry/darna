// Story 8.3 / 8.4 — stockage des exports + URL signée 24h. Les AC visent R2
// (r2://darna-exports/…) mais R2 n'est pas provisionné au MVP (env `R2_*`
// optionnels, cf. lib/env.ts + runbook §4) → on réutilise Supabase Storage,
// déjà dans la stack, exactement comme la story 5.5 (legal-storage). Bucket privé
// `darna-exports` : accès uniquement via URL signée générée côté serveur (client
// admin service-role, qui bypasse la RLS Storage). Échec storage non bloquant :
// l'appelant bascule sur un téléchargement inline (data URL).

import { createAdminClient } from '@/lib/supabase/admin';
import { log } from '@/lib/logger';

export const EXPORTS_BUCKET = 'darna-exports';
const TWENTY_FOUR_HOURS_SECONDS = 24 * 3_600;

/**
 * Upload `content` sous `path` dans le bucket privé puis renvoie une URL signée
 * (24h), ou null si le storage échoue / n'est pas disponible (l'appelant bascule
 * alors sur l'inline). `path` est construit côté serveur (jamais issu du client).
 */
export async function uploadExport(
  path: string,
  content: string,
  contentType: string,
): Promise<string | null> {
  try {
    const admin = createAdminClient();
    // Bucket provisionné par migration. Filet idempotent (dev local) — no-op sinon.
    await admin.storage.createBucket(EXPORTS_BUCKET, { public: false }).catch(() => undefined);

    const { error: upErr } = await admin.storage
      .from(EXPORTS_BUCKET)
      .upload(path, content, { contentType, upsert: true });
    if (upErr) {
      log({
        level: 'error',
        event: 'export.upload_failed',
        user_id: null,
        residence_id: null,
        request_id: null,
        payload: { path, errorName: upErr.name ?? 'unknown' },
      });
      return null;
    }

    const { data, error } = await admin.storage
      .from(EXPORTS_BUCKET)
      .createSignedUrl(path, TWENTY_FOUR_HOURS_SECONDS);
    if (error || !data?.signedUrl) {
      log({
        level: 'error',
        event: 'export.sign_failed',
        user_id: null,
        residence_id: null,
        request_id: null,
        payload: { path },
      });
      return null;
    }
    return data.signedUrl;
  } catch (cause) {
    log({
      level: 'error',
      event: 'export.storage_threw',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorName: cause instanceof Error ? cause.name : 'unknown' },
    });
    return null;
  }
}
