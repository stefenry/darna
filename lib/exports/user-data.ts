// Story 8.3 (FR53, RGPD art. 20) — agrégation server-side des données d'un résident
// pour l'export self-service. Client ADMIN (service-role) : l'appelant a déjà été
// authentifié par requireResident() dans la Server Action, et on lit STRICTEMENT
// les lignes possédées par `userId` (filtre sur la colonne propriétaire de chaque
// table). L'admin bypasse la RLS → export COMPLET (aucun trou de column-grant),
// tout en ne renvoyant que ce qui appartient à l'utilisateur (aucune donnée tierce,
// aucun agrégat ré-identifiant).

import type { SupabaseClient } from '@supabase/supabase-js';
import { log } from '@/lib/logger';

export const EXPORT_SCHEMA_VERSION = '1.0';

// (table, colonne propriétaire) — source unique de vérité du périmètre exporté.
const OWNED: ReadonlyArray<{ key: string; table: string; column: string }> = [
  { key: 'artisans', table: 'artisans', column: 'created_by' },
  { key: 'ratings', table: 'ratings', column: 'user_id' },
  { key: 'alerts', table: 'alerts', column: 'created_by' },
  { key: 'tips', table: 'tips', column: 'created_by' },
  { key: 'suggestions', table: 'suggestions', column: 'user_id' },
  { key: 'reactions', table: 'reactions', column: 'user_id' },
  { key: 'reports', table: 'reports', column: 'reporter_id' },
];

export type UserExport = {
  schema_version: string;
  exported_at: string;
  user: {
    id: string;
    profile: Record<string, unknown> | null;
    account: Record<string, unknown> | null;
    notification_prefs: Record<string, unknown> | null;
  };
  contributions: Record<string, unknown[]>;
};

type Admin = SupabaseClient;

async function selectOwned(admin: Admin, table: string, column: string, userId: string) {
  const { data, error } = await admin.from(table).select('*').eq(column, userId);
  if (error) {
    log({
      level: 'error',
      event: 'export.user_table_failed',
      user_id: userId,
      residence_id: null,
      request_id: null,
      payload: { table, errorCode: error.code ?? 'unknown' },
    });
    return [];
  }
  return data ?? [];
}

export async function buildUserExport(
  admin: Admin,
  userId: string,
  exportedAtIso: string,
): Promise<UserExport> {
  const [account, profile, prefs] = await Promise.all([
    admin.from('users').select('*').eq('id', userId).maybeSingle(),
    admin.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    admin.from('notifications_prefs').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  const contributions: Record<string, unknown[]> = {};
  for (const { key, table, column } of OWNED) {
    contributions[key] = await selectOwned(admin, table, column, userId);
  }

  return {
    schema_version: EXPORT_SCHEMA_VERSION,
    exported_at: exportedAtIso,
    user: {
      id: userId,
      account: account.data ?? null,
      profile: profile.data ?? null,
      notification_prefs: prefs.data ?? null,
    },
    contributions,
  };
}
