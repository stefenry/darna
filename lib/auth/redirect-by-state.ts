import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { routing } from '@/lib/i18n/routing';
import { log } from '@/lib/logger';

type Locale = (typeof routing.locales)[number];

type Args = {
  supabase: SupabaseClient;
  user: User;
  locale: Locale;
  nextParam: string | null;
};

export async function resolveRedirect({
  supabase,
  user,
  locale,
  nextParam,
}: Args): Promise<string> {
  if (nextParam && isSafeAdmissionNext(nextParam, locale)) {
    return nextParam;
  }

  // Defensive .order().limit(1): admission_requests should be unique per user
  // (story 1.3 RLS + schema), but if duplicates ever slip through, maybeSingle()
  // throws PGRST116. Pick the most recent row instead.
  const { data, error } = await supabase
    .from('admission_requests')
    .select('state')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ state: 'pending' | 'accepted' | 'rejected' }>();

  if (error) {
    log({
      level: 'error',
      event: 'auth.admission_lookup_failed',
      user_id: user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown' },
    });
    return `/${locale}/admission`;
  }

  if (!data) return `/${locale}/admission`;
  if (data.state === 'pending') return `/${locale}/admission/pending`;
  if (data.state === 'accepted') return `/${locale}/community/`;
  if (data.state === 'rejected') return `/${locale}/admission/refused`;
  return `/${locale}/admission`;
}

function isSafeAdmissionNext(nextParam: string, locale: Locale): boolean {
  if (!nextParam.startsWith('/')) return false;
  if (nextParam.startsWith('//')) return false;
  // Reject backslash and CR/LF — browsers may normalize them and turn them into
  // protocol-relative or header-splitting payloads.
  if (/[\\\r\n]/.test(nextParam)) return false;

  const prefix = `/${locale}/admission`;
  if (nextParam === prefix) return true;
  // Strict boundary: must continue with '/' or '?' so that `/fr/admissionEVIL`
  // doesn't pass a startsWith check.
  return nextParam.startsWith(`${prefix}/`) || nextParam.startsWith(`${prefix}?`);
}
