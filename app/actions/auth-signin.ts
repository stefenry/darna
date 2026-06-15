'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { zEmail } from '@/lib/validation/email';
import { createAdminClient } from '@/lib/supabase/admin';
import { detectLocaleFromHeaders } from '@/lib/i18n/detect-locale';
import { sendTransactionalEmail } from '@/lib/email/send';
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

function getBaseUrl(): string {
  return env.client.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
}

function isSafeActionLink(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
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
