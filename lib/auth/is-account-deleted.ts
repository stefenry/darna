import { createAdminClient } from '@/lib/supabase/admin';
import { log } from '@/lib/logger';

// Story 1.9 (D3) — Garde re-login : un compte soft-deleted (deleted_at non-null)
// persiste dans auth.users jusqu'au purge dur J+7, donc un magic-link rouvrirait
// une session. Ce helper, appelé dans /auth/confirm avant resolveRedirect,
// permet de bloquer ce re-login. Fail-open : ne JAMAIS faire 500 le callback à
// cause de cette lecture opportuniste (cohérent markAdmissionEmailVerified 1.7).
export async function isAccountDeleted(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('users')
      .select('deleted_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      log({
        level: 'error',
        event: 'auth.deleted_check_failed',
        user_id: userId,
        residence_id: null,
        request_id: null,
        payload: { errorCode: error.code ?? 'unknown' },
      });
      return false;
    }
    return data?.deleted_at != null;
  } catch (cause) {
    log({
      level: 'error',
      event: 'auth.deleted_check_threw',
      user_id: userId,
      residence_id: null,
      request_id: null,
      payload: { errorName: cause instanceof Error ? cause.name : 'unknown' },
    });
    return false;
  }
}
