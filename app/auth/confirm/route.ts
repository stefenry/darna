import { type EmailOtpType } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectLocale } from '@/lib/i18n/detect-locale';
import { resolveRedirect } from '@/lib/auth/redirect-by-state';
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

  const destination = await resolveRedirect({
    supabase,
    user,
    locale,
    nextParam,
  });
  redirect(destination);
}
