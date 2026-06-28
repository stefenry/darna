'use server';

// Promotion in-app d'un résident en co_mod (depuis la liste des résidents par
// villa). La RÉTROGRADATION reste volontairement script-only (`pnpm grant:comod`
// ne retire pas ; le retrait est un geste ops délibéré) — asymétrie assumée.
//
// Réutilise exactement la logique de `scripts/_apply-comod-role.ts` :
//   1. app_metadata.role='co_mod' + residence_id  (admin API — SOURCE du JWT,
//      lue par le proxy + `auth_role()` dans les RLS) ;
//   2. public.users.role='co_mod'                  (cohérence DB ↔ JWT).
// La cible devra SE RECONNECTER pour que son token porte le nouveau rôle.
//
// Sécurité : admin client (service_role, bypass RLS) STRICTEMENT derrière
// requireComod + re-check résidence en code (anti cross-residence). Audit via
// `log()` (event `comod.promoted`) — cohérent avec le bootstrap des scripts ;
// pas d'écriture moderation_log (enum `moderation_action` fermé, pas de valeur
// `comod_*` → éviterait une migration ; durcissement audit DB différé).

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireComod } from '@/lib/auth/require-comod';
import { log } from '@/lib/logger';

export type PromoteState =
  | { ok: true }
  | {
      ok: false;
      code: 'forbidden' | 'invalid' | 'cross_residence' | 'already_comod' | 'failed';
    };

export async function promoteToComod(targetUserId: string): Promise<PromoteState> {
  const guard = await requireComod();
  if (!guard.ok) return { ok: false, code: 'forbidden' };

  const callerResidence = guard.user.app_metadata?.residence_id as string | undefined;
  if (!callerResidence || typeof targetUserId !== 'string' || targetUserId.length === 0) {
    return { ok: false, code: 'invalid' };
  }

  const admin = createAdminClient();

  // 1. Charger la cible et TOUT re-vérifier en code (l'admin client bypasse RLS).
  const { data: target, error: readErr } = await admin
    .from('users')
    .select('id, residence_id, role, deleted_at')
    .eq('id', targetUserId)
    .maybeSingle();
  if (readErr) {
    log({
      level: 'error',
      event: 'comod.promote_read_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: readErr.code ?? 'unknown' },
    });
    return { ok: false, code: 'failed' };
  }
  if (!target || target.deleted_at) return { ok: false, code: 'invalid' };
  if (target.residence_id !== callerResidence) return { ok: false, code: 'cross_residence' };
  if (target.role === 'co_mod') return { ok: false, code: 'already_comod' };

  // 2. app_metadata (JWT) — source de vérité du rôle côté proxy + RLS.
  const meta = await admin.auth.admin.updateUserById(targetUserId, {
    app_metadata: { role: 'co_mod', residence_id: callerResidence },
  });
  if (meta.error) {
    log({
      level: 'error',
      event: 'comod.promote_meta_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: meta.error.code ?? 'unknown' },
    });
    return { ok: false, code: 'failed' };
  }

  // 3. public.users.role (cohérence DB ↔ JWT). En cas d'échec ici, app_metadata
  //    est déjà posé → ré-exécuter la promotion est idempotent (already_comod
  //    serait renvoyé une fois users.role posé ; ici on signale l'échec partiel).
  const { error: roleErr } = await admin
    .from('users')
    .update({ role: 'co_mod', updated_at: new Date().toISOString() })
    .eq('id', targetUserId);
  if (roleErr) {
    log({
      level: 'error',
      event: 'comod.promote_role_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: roleErr.code ?? 'unknown' },
    });
    return { ok: false, code: 'failed' };
  }

  // Audit (sans PII : UUID uniquement).
  log({
    level: 'info',
    event: 'comod.promoted',
    user_id: guard.user.id,
    residence_id: null,
    request_id: null,
    payload: { target_id: targetUserId },
  });

  revalidatePath(`/[locale]/comod/residents`, 'page');
  return { ok: true };
}
