'use server';

// 2026-06-23 — Co_mod publie un artisan sans attendre le consent SMS.
// En staging et pendant la bêta, le flow SMS consent n'est pas opérationnel
// (pas de credit Brevo SMS / pas de provider tiers). Le co_mod prend la
// responsabilité d'avoir contacté l'artisan offline (téléphone, accord verbal).
// Traçabilité : moderation_log `artisan_published` avec actor_id.

import { revalidatePath } from 'next/cache';
import { requireComod } from '@/lib/auth/require-comod';
import { createAdminClient } from '@/lib/supabase/admin';
import { log } from '@/lib/logger';

export type PublishResult =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'not_found' | 'not_pending' | 'wrong_residence' | 'failed' };

export async function publishArtisanWithoutConsent(
  artisanId: string,
  locale: 'fr' | 'ar',
): Promise<PublishResult> {
  const guard = await requireComod();
  if (!guard.ok) return { ok: false, error: 'forbidden' };

  const admin = createAdminClient();
  const { data: artisan, error: fetchErr } = await admin
    .from('artisans')
    .select('id, slug, state, residence_id')
    .eq('id', artisanId)
    .maybeSingle();
  if (fetchErr || !artisan) return { ok: false, error: 'not_found' };
  if (artisan.state !== 'pending_consent') return { ok: false, error: 'not_pending' };

  const actorResidenceId = guard.user.app_metadata?.residence_id as string | undefined;
  if (!actorResidenceId || artisan.residence_id !== actorResidenceId) {
    return { ok: false, error: 'wrong_residence' };
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await admin
    .from('artisans')
    .update({ state: 'published', published_at: now, updated_at: now })
    .eq('id', artisanId);
  if (updateErr) {
    log({
      level: 'error',
      event: 'artisan.publish_no_consent_failed',
      user_id: guard.user.id,
      residence_id: actorResidenceId,
      request_id: null,
      payload: { artisanId, errorCode: updateErr.code ?? 'unknown' },
    });
    return { ok: false, error: 'failed' };
  }

  await admin.from('moderation_log').insert({
    residence_id: actorResidenceId,
    actor_id: guard.user.id,
    action: 'artisan_published',
    target_kind: 'artisan',
    target_id: artisanId,
  });

  log({
    level: 'info',
    event: 'artisan.published_no_consent',
    user_id: guard.user.id,
    residence_id: actorResidenceId,
    request_id: null,
    payload: { artisanId },
  });

  revalidatePath(`/${locale}/community/artisan/${artisan.slug}`);
  revalidatePath(`/${locale}/community/annuaire`);
  return { ok: true };
}
