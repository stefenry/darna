'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { zEmail } from '@/lib/validation/email';
import { createAdminClient } from '@/lib/supabase/admin';
import { detectLocaleFromHeaders } from '@/lib/i18n/detect-locale';
import { sendTransactionalEmail } from '@/lib/email/send';
import { buildPkceConfirmUrl } from '@/lib/auth/build-pkce-confirm-url';
import { checkLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { env } from '@/lib/env';

const EmailForm = z.object({
  email: zEmail,
});

export type SignInState = {
  ok: boolean;
  fieldErrors?: { email?: string[] };
};

const MAGIC_LINK_TTL_MINUTES = 15;
// AR31 — 3 magic-links / 15 min / e-mail.
const MAGIC_RATE_LIMIT = 3;
const MAGIC_RATE_WINDOW_SECONDS = 900;
// Cookie poseur d'e-mail pour le bouton "Renvoyer un code" sur /auth/check-email.
// TTL court (= durée de vie du magic-link) ; httpOnly pour qu'aucun JS client
// ne lise l'adresse ; secure en prod (cohérent isSafeActionLink).
const LOGIN_EMAIL_COOKIE = 'darna_login_email';
const LOGIN_EMAIL_TTL_SECONDS = 15 * 60;

function getBaseUrl(): string {
  return env.client.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
}

/**
 * Génère + envoie un magic-link à `email`. Factorisé pour être réutilisé par
 * signInMagicLink (form public) et resendMagicLink (bouton check-email).
 * NE FAIT PAS de rate-limit : appelants doivent le faire avant.
 */
async function sendMagicLinkFor(email: string, locale: 'fr' | 'ar'): Promise<void> {
  const nextPath = `/${locale}/admission`;
  const redirectTo = `${getBaseUrl()}/auth/confirm?next=${encodeURIComponent(nextPath)}`;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });

    const pkceLink = buildPkceConfirmUrl({
      baseUrl: getBaseUrl(),
      hashedToken: data?.properties?.hashed_token ?? '',
      nextPath,
    });
    if (error || !pkceLink) {
      log({
        level: 'error',
        event: 'auth.magic_link_generate_failed',
        user_id: null,
        residence_id: null,
        request_id: null,
        payload: { errorCode: error?.code ?? 'no_action_link', locale },
      });
      return;
    }

    const sendResult = await sendTransactionalEmail({
      template: 'magic-link',
      to: email,
      locale,
      vars: {
        link: pkceLink,
        expiresInMinutes: MAGIC_LINK_TTL_MINUTES,
        code:
          typeof data?.properties?.email_otp === 'string' ? data.properties.email_otp : undefined,
      },
    });

    log({
      level: 'info',
      event: 'auth.magic_link_sent',
      user_id: data.user?.id ?? null,
      residence_id: null,
      request_id: null,
      payload: { locale, ok: sendResult.ok },
    });
  } catch (cause) {
    // Do not log cause.message: Supabase often echoes the submitted e-mail
    // back inside error messages — that's PII (AR19).
    log({
      level: 'error',
      event: 'auth.magic_link_threw',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: {
        errorCode: 'thrown',
        errorName: cause instanceof Error ? cause.name : 'unknown',
        locale,
      },
    });
  }
}

async function setLoginEmailCookie(email: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOGIN_EMAIL_COOKIE, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: LOGIN_EMAIL_TTL_SECONDS,
  });
}

export async function signInMagicLink(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = EmailForm.safeParse({
    email: formData.get('email'),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      fieldErrors: { email: flat.fieldErrors.email ?? ['emailErrorInvalid'] },
    };
  }

  const headerList = await headers();
  const locale = detectLocaleFromHeaders(
    headerList.get('cookie'),
    headerList.get('accept-language'),
  );

  // AR31 — rate-limit par e-mail. Anti-énumération préservée : on redirige
  // toujours vers check-email, mais sans envoyer de lien si la limite est
  // dépassée.
  const rl = await checkLimit(
    `magic:${parsed.data.email.toLowerCase()}`,
    MAGIC_RATE_LIMIT,
    MAGIC_RATE_WINDOW_SECONDS,
  );
  if (rl.success) {
    await sendMagicLinkFor(parsed.data.email, locale);
  } else {
    log({
      level: 'info',
      event: 'auth.rate_limited',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { locale },
    });
  }

  // On pose le cookie même si rate-limited : ça permet à l'utilisateur de
  // retenter via le bouton "Renvoyer" plus tard sans retaper son e-mail.
  await setLoginEmailCookie(parsed.data.email);

  // Anti-enumeration: always redirect to check-email regardless of outcome.
  redirect(`/${locale}/auth/check-email`);
}

/**
 * Server Action déclenchée par le bouton « Renvoyer un code » sur /auth/check-email.
 * Lit l'e-mail du cookie posé par signInMagicLink ; ne demande pas de nouveau
 * saisie utilisateur. Rate-limit identique au flow initial.
 */
export async function resendMagicLink(): Promise<void> {
  const headerList = await headers();
  const locale = detectLocaleFromHeaders(
    headerList.get('cookie'),
    headerList.get('accept-language'),
  );
  const cookieStore = await cookies();
  const email = cookieStore.get(LOGIN_EMAIL_COOKIE)?.value;

  if (!email) {
    // Cookie expiré ou absent : renvoyer sur /auth/login pour ressaisir.
    redirect(`/${locale}/auth/login`);
  }

  // Re-valide via Zod : protège contre cookie manipulé.
  const parsed = EmailForm.safeParse({ email });
  if (!parsed.success) {
    redirect(`/${locale}/auth/login`);
  }

  const rl = await checkLimit(
    `magic:${parsed.data.email.toLowerCase()}`,
    MAGIC_RATE_LIMIT,
    MAGIC_RATE_WINDOW_SECONDS,
  );
  if (rl.success) {
    await sendMagicLinkFor(parsed.data.email, locale);
  } else {
    log({
      level: 'info',
      event: 'auth.resend_rate_limited',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { locale },
    });
  }

  // Refresh cookie TTL.
  await setLoginEmailCookie(parsed.data.email);
  redirect(`/${locale}/auth/check-email?resent=1`);
}

/**
 * Helper RSC pour récupérer l'e-mail courant du cookie (sans le révéler en
 * clair côté UI : la page check-email l'utilise pour le masquer en local***@x).
 */
export async function getLoginEmailFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(LOGIN_EMAIL_COOKIE)?.value ?? null;
}
