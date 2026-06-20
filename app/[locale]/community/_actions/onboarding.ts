'use server';

// Story 3.4 (AC3/AC4/AC6) — Server Actions lifecycle onboarding. Écriture des 2
// signaux via client session uniquement (grant UPDATE self `first_login_at`/
// `pack_accueil_dismissed_at` + RLS users_resident_update_self, `id=auth.uid()`).
// Jamais d'admin client. Idempotentes (garde `is null` → ne réécrit pas un
// timestamp posé) et NON bloquantes (un échec ne casse pas la navigation → warn).

import { createClient } from '@/lib/supabase/server';
import { requireResident } from '@/lib/auth/require-resident';
import { log } from '@/lib/logger';

/** Écarte la bannière Pack (le Pack reste accessible). Pose `pack_accueil_dismissed_at`. */
export async function dismissPackBanner(): Promise<void> {
  const guard = await requireResident();
  if (!guard.ok) return; // non bloquant : effet de bord UX

  const supabase = await createClient();
  const { error } = await supabase
    .from('users')
    .update({
      pack_accueil_dismissed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', guard.user.id)
    .is('pack_accueil_dismissed_at', null); // idempotence

  if (error) {
    log({
      level: 'warn',
      event: 'onboarding.dismiss_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown' },
    });
  }
}

/** Marque l'onboarding complété (lecture du Pack). Pose `first_login_at` ET, si
 * encore null, `pack_accueil_dismissed_at` (consommer le Pack vaut écarter la
 * bannière — D2). */
export async function completeOnboarding(): Promise<void> {
  const guard = await requireResident();
  if (!guard.ok) return;

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('users')
    .update({ first_login_at: now, pack_accueil_dismissed_at: now, updated_at: now })
    .eq('id', guard.user.id)
    .is('first_login_at', null); // idempotence : ne rajeunit pas l'onboarding

  if (error) {
    log({
      level: 'warn',
      event: 'onboarding.complete_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown' },
    });
  }
}
