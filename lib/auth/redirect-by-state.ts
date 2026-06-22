import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { routing } from '@/lib/i18n/routing';
import { log } from '@/lib/logger';
import { isCanonicalEntityPath } from '@/lib/share/safe-next';

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
  // 1. Co_mod prioritaire : auth-signin pose nextParam=/<locale>/admission
  //    par défaut, qui matche isSafeAdmissionNext et renvoyait le co_mod sur
  //    /admission au login. On respecte uniquement les deep-links explicites
  //    vers /comod ou une entity canonique.
  if (user.app_metadata?.role === 'co_mod') {
    if (
      nextParam &&
      (nextParam === `/${locale}/comod` ||
        nextParam.startsWith(`/${locale}/comod/`) ||
        isCanonicalEntityPath(nextParam))
    ) {
      return nextParam;
    }
    return `/${locale}/comod`;
  }

  // 2. Lookup public.users.role — source de vérité (vs admission_requests qui
  //    est un historique : un user accepté puis refusé sur une 2e demande
  //    garde role=resident, mais admission_requests.latest = rejected).
  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: 'demandeur' | 'resident' | 'co_mod' }>();

  // 3. Résident : shortcut /community/ même si nextParam=/admission (default
  //    posé par auth-signin). On ne respecte que les entity canoniques (story 6.3).
  if (userRow?.role === 'resident') {
    if (nextParam && isCanonicalEntityPath(nextParam)) {
      return nextParam;
    }
    return `/${locale}/community/`;
  }

  // 4. Demandeur ou sans row : lookup la dernière admission_request pour
  //    différencier pending/rejected/no_request.
  const { data: adm, error } = await supabase
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

  // 5. Respecter nextParam admis si fourni explicitement.
  if (nextParam && (isSafeAdmissionNext(nextParam, locale) || isCanonicalEntityPath(nextParam))) {
    return nextParam;
  }

  if (!adm) return `/${locale}/admission`;
  if (adm.state === 'pending') return `/${locale}/admission/pending`;
  if (adm.state === 'rejected') return `/${locale}/admission/refused`;
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
