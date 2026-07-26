import { createAdminClient } from '@/lib/supabase/admin';
import { log } from '@/lib/logger';

// Filet de sécurité sur le pont `auth.users` → `public.users`.
//
// Incident bêta 2026-07-26 : un nouvel inscrit n'est jamais arrivé chez les
// co_mods. `admission_requests.user_id` référence `public.users(id)` et
// l'insertion échouait en 23503 — la ligne `public.users` n'existait pas.
//
// Pourquoi elle peut manquer : le trigger `handle_new_auth_user` provisionne
// `public.users` + `notifications_prefs`, mais il enveloppe le tout dans un
// `exception when others then raise warning; return new`. Si l'une des deux
// insertions échoue, les DEUX sont annulées et le compte `auth.users` est
// conservé malgré tout. Et comme le trigger ne se déclenche qu'à l'INSERT dans
// `auth.users`, rien ne rejoue jamais : `generateLink` retrouve le compte
// existant, ne réinsère rien, et la personne reste bloquée définitivement.
//
// D'où cette réparation à la demande, juste avant l'insertion qui en dépend.

/**
 * Garantit l'existence de `public.users` (et des préférences de notification)
 * pour un compte `auth.users` donné. Idempotent et NON destructif : un compte
 * déjà présent n'est jamais modifié — surtout pas son rôle.
 *
 * @returns `true` si la ligne `public.users` est présente à la sortie.
 */
export async function ensurePublicUser(userId: string, residenceId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();

    // `ignoreDuplicates` : on ne fait qu'AJOUTER ce qui manque. Sans lui, un
    // résident ou un co_mod repassant par ici serait rétrogradé en « demandeur ».
    const { error } = await admin
      .from('users')
      .upsert(
        { id: userId, residence_id: residenceId, role: 'demandeur' },
        { onConflict: 'id', ignoreDuplicates: true },
      );

    if (error) {
      log({
        level: 'error',
        event: 'auth.ensure_public_user_failed',
        user_id: userId,
        residence_id: null,
        request_id: null,
        payload: { errorCode: error.code ?? 'unknown' },
      });
      return false;
    }

    // Les préférences sont accessoires : leur échec ne bloque pas l'admission
    // (c'est précisément ce couplage qui a fait perdre la ligne `users` dans le
    // trigger). On log et on continue.
    const prefs = await admin
      .from('notifications_prefs')
      .upsert(
        { user_id: userId, residence_id: residenceId },
        { onConflict: 'user_id', ignoreDuplicates: true },
      );

    if (prefs.error) {
      log({
        level: 'warn',
        event: 'auth.ensure_prefs_failed',
        user_id: userId,
        residence_id: null,
        request_id: null,
        payload: { errorCode: prefs.error.code ?? 'unknown' },
      });
    }

    return true;
  } catch (cause) {
    log({
      level: 'error',
      event: 'auth.ensure_public_user_failed',
      user_id: userId,
      residence_id: null,
      request_id: null,
      payload: {
        errorCode: 'thrown',
        errorName: cause instanceof Error ? cause.name : 'unknown',
      },
    });
    return false;
  }
}
