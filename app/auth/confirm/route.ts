import { type EmailOtpType } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectLocale } from '@/lib/i18n/detect-locale';
import { applyLocaleFromProfile } from '@/lib/i18n/locale-cookie';
import { resolveRedirect } from '@/lib/auth/redirect-by-state';
import { markAdmissionEmailVerified } from '@/lib/auth/mark-admission-email-verified';
import { isAccountDeleted } from '@/lib/auth/is-account-deleted';
import { log } from '@/lib/logger';

// Map Supabase verifyOtp error.code → user-facing reason in the whitelist
// supported by /auth/error (expired | invalid | used). Unknown codes fall back
// to the dedicated /auth/expired page (most common case).
function mapErrorToReason(code: string | undefined): 'expired' | 'used' | 'invalid' | null {
  if (!code) return null;
  if (code === 'otp_expired' || code === 'expired_token') return 'expired';
  if (code === 'token_already_used' || code === 'otp_used') return 'used';
  if (code === 'invalid_token' || code === 'token_not_found' || code === 'bad_jwt')
    return 'invalid';
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const nextParam = searchParams.get('next');
  const locale = detectLocale(request);

  if (!token_hash || type !== 'email') {
    log({
      level: 'info',
      event: 'auth.callback_invalid_params',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { hasTokenHash: Boolean(token_hash), type: type ?? 'null' },
    });
    redirect(`/${locale}/auth/error?reason=invalid`);
  }

  const supabase = await createClient();
  const { data: verifyData, error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    log({
      level: 'info',
      event: 'auth.callback_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown' },
    });
    const reason = mapErrorToReason(error.code);
    if (reason === 'used' || reason === 'invalid') {
      redirect(`/${locale}/auth/error?reason=${reason}`);
    }
    // Default + 'expired' both land on the dedicated expired page (user can
    // request a new link from there).
    redirect(`/${locale}/auth/expired`);
  }

  // Use the user returned by verifyOtp instead of a separate getUser() call —
  // that avoids a race where cookies aren't yet visible on the second call.
  const user = verifyData.user;
  if (!user) {
    log({
      level: 'error',
      event: 'auth.callback_no_user_after_verify',
      user_id: null,
      residence_id: null,
      request_id: null,
    });
    redirect(`/${locale}/auth/error?reason=invalid`);
  }

  log({
    level: 'info',
    event: 'auth.callback_verified',
    user_id: user.id,
    residence_id: null,
    request_id: null,
  });

  // Story 1.9 (D3) — Garde re-login : un compte soft-deleted (suppression RGPD
  // en attente de purge J+7) ne doit pas pouvoir rouvrir une session. On invalide
  // toutes les sessions et on renvoie sur l'accueil public.
  if (await isAccountDeleted(user.id)) {
    log({
      level: 'info',
      event: 'auth.deleted_account_login_blocked',
      user_id: user.id,
      residence_id: null,
      request_id: null,
    });
    const { error: signOutErr } = await supabase.auth.signOut({ scope: 'global' });
    if (signOutErr) {
      log({
        level: 'error',
        event: 'auth.deleted_signout_failed',
        user_id: user.id,
        residence_id: null,
        request_id: null,
        payload: { errorCode: signOutErr.code ?? 'unknown' },
      });
    }
    redirect(`/${locale}/`);
  }

  // Story 1.7 — Marque admission_requests.email_verified_at pour la demande
  // pending de cet utilisateur (idempotent, ne throw jamais). Doit tourner
  // AVANT resolveRedirect car la décision de routage est state-based, mais
  // l'audit `email_verified_at` est utile aux co-mods pour filtrer la queue
  // (story 1.8) — pas pour rediriger ici.
  await markAdmissionEmailVerified({ userId: user.id });

  // Story 7.4 — appareil/navigateur neuf : aligne le cookie NEXT_LOCALE sur la
  // langue mémorisée (profiles.language) et redirige dans cette locale.
  const effectiveLocale = await applyLocaleFromProfile(supabase, user.id, locale);

  const destination = await resolveRedirect({
    supabase,
    user,
    locale: effectiveLocale,
    nextParam,
  });
  redirect(destination);
}
