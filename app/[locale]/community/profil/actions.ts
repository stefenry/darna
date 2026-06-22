'use server';

import { createClient } from '@/lib/supabase/server';
import { requireResident } from '@/lib/auth/require-resident';
import {
  zProfileSettings,
  zDeleteAccount,
  zNotificationPrefs,
  type ProfilErrorKey,
} from '@/lib/validation/profile';
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
  display_name?: string;
}): Promise<ProfilActionState> {
  const guard = await requireResident();
  if (!guard.ok) {
    return { ok: false, code: 'forbidden', message_key: 'errors.profil.forbidden' };
  }

  const parsed = zProfileSettings.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const key = firstIssue?.message;
    const isProfilKey = typeof key === 'string' && key.startsWith('errors.profil.');
    return {
      ok: false,
      code: 'invalid_input',
      message_key: isProfilKey ? (key as ProfilErrorKey) : 'errors.profil.settings_failed',
    };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: updatedRows, error } = await supabase
    .from('profiles')
    .update({
      identity_mode: parsed.data.identity_mode,
      language: parsed.data.language,
      updated_at: now,
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

  // Story 2026-06-22 — display_name est dans public.users (pas profiles). Le
  // grant column UPDATE + la policy users_resident_update_self autorisent
  // l'édition self.
  if (parsed.data.display_name !== undefined) {
    const { error: nameErr } = await supabase
      .from('users')
      .update({ display_name: parsed.data.display_name, updated_at: now })
      .eq('id', guard.user.id);
    if (nameErr) {
      log({
        level: 'error',
        event: 'profil.display_name_update_failed',
        user_id: guard.user.id,
        residence_id: null,
        request_id: null,
        payload: { errorCode: nameErr.code ?? 'unknown' },
      });
      return { ok: false, code: 'failed', message_key: 'errors.profil.settings_failed' };
    }
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

// Story 7.1 — Préférences notifications opt-in 3 catégories. La row
// notifications_prefs est provisionnée à l'inscription (trigger
// trg_auth_users_after_insert, défauts FR40 : alerts ON, annuaire OFF,
// activité ON). On update via le client SSR session (RLS self :
// notifications_prefs_resident_update_self) — pas d'admin client.
export async function updateNotificationPrefs(input: {
  alerts_urgentes_enabled: boolean;
  nouvelles_entrees_annuaire_enabled: boolean;
  activite_contributions_enabled: boolean;
}): Promise<ProfilActionState> {
  const guard = await requireResident();
  if (!guard.ok) {
    return { ok: false, code: 'forbidden', message_key: 'errors.profil.forbidden' };
  }

  const parsed = zNotificationPrefs.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: 'invalid_input', message_key: 'errors.profil.notifications_failed' };
  }

  const supabase = await createClient();
  const { data: updatedRows, error } = await supabase
    .from('notifications_prefs')
    .update({
      alerts_urgentes_enabled: parsed.data.alerts_urgentes_enabled,
      nouvelles_entrees_annuaire_enabled: parsed.data.nouvelles_entrees_annuaire_enabled,
      activite_contributions_enabled: parsed.data.activite_contributions_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', guard.user.id)
    .select('user_id');

  if (error) {
    log({
      level: 'error',
      event: 'profil.notifications_update_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown' },
    });
    return { ok: false, code: 'failed', message_key: 'errors.profil.notifications_failed' };
  }

  if (!updatedRows || updatedRows.length === 0) {
    // Pas de row : provisioning trigger raté (rare). On la crée pour ne pas
    // laisser le résident sans contrôle (idempotent, RLS self-insert).
    const { error: insertError } = await supabase.from('notifications_prefs').insert({
      user_id: guard.user.id,
      residence_id: guard.user.residence_id,
      alerts_urgentes_enabled: parsed.data.alerts_urgentes_enabled,
      nouvelles_entrees_annuaire_enabled: parsed.data.nouvelles_entrees_annuaire_enabled,
      activite_contributions_enabled: parsed.data.activite_contributions_enabled,
    });
    if (insertError) {
      log({
        level: 'error',
        event: 'profil.notifications_insert_failed',
        user_id: guard.user.id,
        residence_id: null,
        request_id: null,
        payload: { errorCode: insertError.code ?? 'unknown' },
      });
      return { ok: false, code: 'failed', message_key: 'errors.profil.notifications_failed' };
    }
  }

  log({
    level: 'info',
    event: 'profil.notifications_updated',
    user_id: guard.user.id,
    residence_id: null,
    request_id: null,
    payload: {
      alerts_urgentes_enabled: parsed.data.alerts_urgentes_enabled,
      nouvelles_entrees_annuaire_enabled: parsed.data.nouvelles_entrees_annuaire_enabled,
      activite_contributions_enabled: parsed.data.activite_contributions_enabled,
    },
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
