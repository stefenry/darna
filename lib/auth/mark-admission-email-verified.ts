import { createAdminClient } from '@/lib/supabase/admin';
import { log } from '@/lib/logger';

// Story 1.7 — Marque admission_requests.email_verified_at = now() pour la ligne
// pending de cet utilisateur après que `/auth/confirm` a vérifié le magic-link.
//
// Discipline :
//   - Idempotent : si email_verified_at est déjà set, l'UPDATE ne touche rien
//     (clause WHERE `is null`) — anti race-condition double-click.
//   - State-bound : on n'update que si state='pending'. Si l'admission a été
//     acceptée/rejetée entre le send et le click, on n'overwrite pas l'audit.
//   - Soft-delete safe : on exclut `deleted_at IS NOT NULL`.
//   - **N'échoue jamais le callback** : toute erreur (RLS unexpected, DB down)
//     est captée + loggée, on retourne { updated: false } silencieusement.
//
// Utilise le service-role (admin client) car les policies column-level RLS
// (story 1.3 review #11) interdisent à `authenticated` d'updater
// email_verified_at via session demandeur — service-role bypass nécessaire.

export async function markAdmissionEmailVerified(args: {
  userId: string;
}): Promise<{ updated: boolean }> {
  const { userId } = args;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('admission_requests')
      .update({ email_verified_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('state', 'pending')
      .is('email_verified_at', null)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      log({
        level: 'error',
        event: 'admission.email_verified_update_failed',
        user_id: userId,
        residence_id: null,
        request_id: null,
        payload: { errorCode: error.code ?? 'unknown' },
      });
      return { updated: false };
    }

    const updated = Array.isArray(data) && data.length > 0;

    if (updated) {
      log({
        level: 'info',
        event: 'admission.email_verified',
        user_id: userId,
        residence_id: null,
        request_id: null,
        payload: { rowCount: data?.length ?? 0 },
      });
    }

    return { updated };
  } catch (cause) {
    log({
      level: 'error',
      event: 'admission.email_verified_threw',
      user_id: userId,
      residence_id: null,
      request_id: null,
      payload: {
        errorCode: 'thrown',
        errorName: cause instanceof Error ? cause.name : 'unknown',
      },
    });
    return { updated: false };
  }
}
