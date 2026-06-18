'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { zEmail } from '@/lib/validation/email';
import { createAdminClient } from '@/lib/supabase/admin';
import { detectLocaleFromHeaders } from '@/lib/i18n/detect-locale';
import { sendTransactionalEmail } from '@/lib/email/send';
import { isSafeActionLink } from '@/lib/auth/safe-action-link';
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

function getBaseUrl(): string {
  return env.client.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
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
  const redirectTo = `${getBaseUrl()}/auth/confirm?next=${encodeURIComponent(
    `/${locale}/admission`,
  )}`;

  // AR31 — rate-limit par e-mail. Anti-énumération préservée : on redirige
  // toujours vers check-email, mais sans envoyer de lien si la limite est
  // dépassée (le rl.success gate le bloc generateLink/send ci-dessous).
  const rl = await checkLimit(
    `magic:${parsed.data.email.toLowerCase()}`,
    MAGIC_RATE_LIMIT,
    MAGIC_RATE_WINDOW_SECONDS,
  );
  if (!rl.success) {
    log({
      level: 'info',
      event: 'auth.rate_limited',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { locale },
    });
    redirect(`/${locale}/auth/check-email`);
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: parsed.data.email,
      options: { redirectTo },
    });

    if (error || !isSafeActionLink(data?.properties?.action_link)) {
      log({
        level: 'error',
        event: 'auth.magic_link_generate_failed',
        user_id: null,
        residence_id: null,
        request_id: null,
        payload: { errorCode: error?.code ?? 'no_action_link', locale },
      });
    } else {
      const sendResult = await sendTransactionalEmail({
        template: 'magic-link',
        to: parsed.data.email,
        locale,
        vars: {
          link: data.properties.action_link,
          expiresInMinutes: MAGIC_LINK_TTL_MINUTES,
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
    }
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

  // Anti-enumeration: always redirect to check-email regardless of outcome.
  redirect(`/${locale}/auth/check-email`);
}
