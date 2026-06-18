'use server';

import { createClient } from '@/lib/supabase/server';
import { requireResident } from '@/lib/auth/require-resident';
import { zProfileSettings, zDeleteAccount, type ProfilErrorKey } from '@/lib/validation/profile';
import { log } from '@/lib/logger';

// Story 1.9 — Server Actions profil. Tout passe par le client SSR session
// (RLS self) : profiles_resident_update_self + le column-grant
// (villa, tranche, language, identity_mode, updated_at) autorisent les writes ;
// la suppression appelle la RPC SECURITY DEFINER request_account_deletion qui
// utilise auth.uid() (self-service, pas d'admin client).

export type ProfilActionState =
  | { ok: true }
  | { ok: false; code: 'forbidden' | 'invalid_input' | 'failed'; message_key: ProfilErrorKey };

export async function updateProfileSettings(input: {
  identity_mode: string;
  language: string;
}): Promise<ProfilActionState> {
  const guard = await requireResident();
  if (!guard.ok) {
    return { ok: false, code: 'forbidden', message_key: 'errors.profil.forbidden' };
  }

  const parsed = zProfileSettings.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: 'invalid_input', message_key: 'errors.profil.settings_failed' };
  }

  const supabase = await createClient();
  const { data: updatedRows, error } = await supabase
    .from('profiles')
    .update({
      identity_mode: parsed.data.identity_mode,
      language: parsed.data.language,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', guard.user.id)
    .select('user_id');

  if (error) {
    log({
      level: 'error',
      event: 'profil.settings_update_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown' },
    });
    return { ok: false, code: 'failed', message_key: 'errors.profil.settings_failed' };
  }

  if (!updatedRows || updatedRows.length === 0) {
    log({
      level: 'warn',
      event: 'profil.settings_no_row',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: {},
    });
  }

  log({
    level: 'info',
    event: 'profil.settings_updated',
    user_id: guard.user.id,
    residence_id: null,
    request_id: null,
    payload: { identity_mode: parsed.data.identity_mode, language: parsed.data.language },
  });

  return { ok: true };
}

export async function deleteAccount(input: { confirm: string }): Promise<ProfilActionState> {
  const guard = await requireResident();
  if (!guard.ok) {
    return { ok: false, code: 'forbidden', message_key: 'errors.profil.forbidden' };
  }

  const parsed = zDeleteAccount.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: 'invalid_input', message_key: 'errors.profil.confirm_mismatch' };
  }

  const supabase = await createClient();

  // Soft-delete + anonymisation + log user_deleted (atomique, SECURITY DEFINER
  // self-service via auth.uid()). La purge dure (auth.admin.deleteUser → cascade)
  // est faite à J+7 par le cron purge-expired (D1).
  const { error } = await supabase.rpc('request_account_deletion');
  if (error) {
    log({
      level: 'error',
      event: 'profil.deletion_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown' },
    });
    return { ok: false, code: 'failed', message_key: 'errors.profil.delete_failed' };
  }

  // Invalide toutes les sessions (le compte est inaccessible immédiatement ;
  // le guard isAccountDeleted bloque tout re-login pendant la grâce J+7).
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
  if (signOutError) {
    log({
      level: 'error',
      event: 'profil.signout_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: signOutError.code ?? 'unknown' },
    });
    // Ne pas bloquer — le soft-delete est déjà commis (RPC idempotente).
    // isAccountDeleted bloquera le prochain magic-link si la session reste valide.
  }

  log({
    level: 'info',
    event: 'profil.deletion_requested',
    user_id: guard.user.id,
    residence_id: null,
    request_id: null,
    payload: {},
  });

  return { ok: true };
}
