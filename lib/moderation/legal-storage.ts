// Story 5.5 — stockage du dossier d'escalade + URL signée 30j. R2 (AR29) n'est pas
// provisionné au MVP (env optionnels) → on utilise Supabase Storage (déjà dans la
// stack, client admin service-role). Bucket privé `legal-dossiers`. Échec storage
// non bloquant : la Server Action bascule sur un envoi inline du dossier.

import { createAdminClient } from '@/lib/supabase/admin';
import { log } from '@/lib/logger';

const BUCKET = 'legal-dossiers';
const THIRTY_DAYS_SECONDS = 30 * 24 * 3_600;

/**
 * Upload le dossier Markdown et retourne une URL signée (30j), ou null si le
 * storage échoue / n'est pas disponible (l'appelant bascule alors sur l'inline).
 */
export async function uploadDossier(reportId: string, markdown: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    // Création de bucket idempotente (ignore "already exists").
    await admin.storage.createBucket(BUCKET, { public: false }).catch(() => undefined);

    const path = `${reportId}.md`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, markdown, { contentType: 'text/markdown;charset=utf-8', upsert: true });
    if (upErr) {
      log({
        level: 'error',
        event: 'moderation.dossier_upload_failed',
        user_id: null,
        residence_id: null,
        request_id: null,
        payload: { reportId },
      });
      return null;
    }

    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, THIRTY_DAYS_SECONDS);
    if (error || !data?.signedUrl) {
      log({
        level: 'error',
        event: 'moderation.dossier_sign_failed',
        user_id: null,
        residence_id: null,
        request_id: null,
        payload: { reportId },
      });
      return null;
    }
    return data.signedUrl;
  } catch (cause) {
    log({
      level: 'error',
      event: 'moderation.dossier_threw',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorName: cause instanceof Error ? cause.name : 'unknown' },
    });
    return null;
  }
}
