'use server';

// Story 8.3 (FR53, RGPD art. 20) — export self-service des données du résident.
// Flux : requireResident → build (client admin, lignes own) → JSON → upload
// Supabase Storage (URL signée 24h) → e-mail « export prêt » (AR21). Si le storage
// échoue/n'est pas dispo, on bascule sur un téléchargement INLINE (le client
// reconstruit un Blob) — l'utilisateur récupère toujours ses données.

import { createAdminClient } from '@/lib/supabase/admin';
import { requireResident } from '@/lib/auth/require-resident';
import { buildUserExport } from '@/lib/exports/user-data';
import { uploadExport } from '@/lib/exports/storage';
import { sendTransactionalEmail } from '@/lib/email/send';
import { log } from '@/lib/logger';

export type ExportActionState =
  | { ok: false; code: 'forbidden' | 'failed'; message_key: string }
  // mode 'url' : téléchargement via URL signée 24h (+ e-mail envoyé).
  | { ok: true; mode: 'url'; url: string; filename: string }
  // mode 'inline' : storage indisponible → le client génère le fichier localement.
  | { ok: true; mode: 'inline'; content: string; filename: string };

export async function exportMyData(locale: 'fr' | 'ar'): Promise<ExportActionState> {
  const guard = await requireResident();
  if (!guard.ok) {
    return { ok: false, code: 'forbidden', message_key: 'errors.profil.forbidden' };
  }

  const userId = guard.user.id;
  const exportedAt = new Date().toISOString();
  const admin = createAdminClient();

  let json: string;
  try {
    const payload = await buildUserExport(admin, userId, exportedAt);
    json = JSON.stringify(payload, null, 2);
  } catch (cause) {
    log({
      level: 'error',
      event: 'export.build_threw',
      user_id: userId,
      residence_id: null,
      request_id: null,
      payload: { errorName: cause instanceof Error ? cause.name : 'unknown' },
    });
    return { ok: false, code: 'failed', message_key: 'profil.export.error' };
  }

  // Horodatage compact pour le nom de fichier (pas de ':' — compat FS/URL).
  const stamp = exportedAt.replace(/[:.]/g, '-');
  const filename = `darna-export-${stamp}.json`;
  const path = `users/${userId}/${stamp}.json`;

  const url = await uploadExport(path, json, 'application/json');

  if (!url) {
    // Storage indisponible — repli inline (l'utilisateur récupère quand même tout).
    log({
      level: 'warn',
      event: 'export.inline_fallback',
      user_id: userId,
      residence_id: null,
      request_id: null,
      payload: {},
    });
    return { ok: true, mode: 'inline', content: json, filename };
  }

  // Notification « export prêt » (best-effort : un échec d'e-mail ne bloque pas,
  // l'URL est déjà renvoyée à l'écran).
  const email = guard.user.email;
  if (email) {
    await sendTransactionalEmail({
      template: 'export-ready',
      to: email,
      locale,
      vars: { download_url: url },
    });
  }

  log({
    level: 'info',
    event: 'export.completed',
    user_id: userId,
    residence_id: null,
    request_id: null,
    payload: { mode: 'url' },
  });

  return { ok: true, mode: 'url', url, filename };
}
