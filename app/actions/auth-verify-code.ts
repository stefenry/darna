'use server';

// 2026-06-22 — workaround PWA iOS standalone : Safari et la PWA partagent pas
// le cookie jar, donc un user qui clique le magic-link reçu dans Mail tombe
// sur Safari (cookie posé) puis quand il ouvre la PWA via l'icône
// d'accueil il est déconnecté. Solution standard : OTP 6-chiffres saisi
// dans l'app — Supabase verifyOtp({ type: 'email', token, email }) pose la
// session dans le contexte browser actif (= la PWA).

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { zEmail } from '@/lib/validation/email';
import { detectLocaleFromHeaders } from '@/lib/i18n/detect-locale';
import { resolveRedirect } from '@/lib/auth/redirect-by-state';
import { isAccountDeleted } from '@/lib/auth/is-account-deleted';
import { markAdmissionEmailVerified } from '@/lib/auth/mark-admission-email-verified';
import { checkLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';

const Form = z.object({
  email: zEmail,
  code: z.string().regex(/^\d{6}$/, 'codeErrorInvalid'),
});

export type VerifyCodeState = {
  ok: boolean;
  fieldErrors?: { email?: string[]; code?: string[] };
};

// AR31 — 5 essais code / 15 min / e-mail (un brute-force humain réaliste).
const CODE_RATE_LIMIT = 5;
const CODE_RATE_WINDOW_SECONDS = 900;

export async function verifyEmailCode(
  _previous: VerifyCodeState,
  formData: FormData,
): Promise<VerifyCodeState> {
  const parsed = Form.safeParse({
    email: formData.get('email'),
    code: formData.get('code'),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      fieldErrors: {
        email: flat.fieldErrors.email,
        code: flat.fieldErrors.code,
      },
    };
  }

  const headerList = await headers();
  const locale = detectLocaleFromHeaders(
    headerList.get('cookie'),
    headerList.get('accept-language'),
  );

  const rl = await checkLimit(
    `code:${parsed.data.email.toLowerCase()}`,
    CODE_RATE_LIMIT,
    CODE_RATE_WINDOW_SECONDS,
  );
  if (!rl.success) {
    log({
      level: 'info',
      event: 'auth.code_rate_limited',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { locale },
    });
    return { ok: false, fieldErrors: { code: ['codeErrorInvalid'] } };
  }

  const supabase = await createClient();
  const { data: verifyData, error } = await supabase.auth.verifyOtp({
    type: 'email',
    email: parsed.data.email,
    token: parsed.data.code,
  });

  if (error || !verifyData?.user) {
    log({
      level: 'info',
      event: 'auth.code_verify_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error?.code ?? 'no_user', locale },
    });
    return { ok: false, fieldErrors: { code: ['codeErrorInvalid'] } };
  }

  const user = verifyData.user;

  if (await isAccountDeleted(user.id)) {
    log({
      level: 'info',
      event: 'auth.deleted_account_code_blocked',
      user_id: user.id,
      residence_id: null,
      request_id: null,
    });
    await supabase.auth.signOut({ scope: 'global' });
    redirect(`/${locale}/`);
  }

  await markAdmissionEmailVerified({ userId: user.id });

  log({
    level: 'info',
    event: 'auth.code_verified',
    user_id: user.id,
    residence_id: null,
    request_id: null,
  });

  const destination = await resolveRedirect({
    supabase,
    user,
    locale,
    nextParam: null,
  });
  redirect(destination);
}
