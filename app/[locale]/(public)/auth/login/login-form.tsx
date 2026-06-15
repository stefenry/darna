'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { signInMagicLink, type SignInState } from '@/app/actions/auth-signin';

const INITIAL_STATE: SignInState = { ok: false };

type LoginErrorKey = 'emailErrorRequired' | 'emailErrorInvalid';
const ERROR_KEYS: ReadonlySet<LoginErrorKey> = new Set(['emailErrorRequired', 'emailErrorInvalid']);

function translateError(t: ReturnType<typeof useTranslations>, code: string) {
  if ((ERROR_KEYS as ReadonlySet<string>).has(code)) {
    return t(code as LoginErrorKey);
  }
  return t('emailErrorInvalid');
}

export function LoginForm() {
  const t = useTranslations('auth.login');
  const [state, formAction, isPending] = useActionState(signInMagicLink, INITIAL_STATE);

  const emailError = state.fieldErrors?.email?.[0];

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4" aria-busy={isPending}>
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-neutral-900">{t('emailLabel')}</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t('emailPlaceholder')}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? 'email-error' : undefined}
          className="min-h-touch rounded-[14px] border border-neutral-300 bg-bg-card px-4 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 aria-[invalid=true]:border-danger"
        />
        {emailError && (
          <span id="email-error" role="alert" className="text-sm text-danger">
            {translateError(t, emailError)}
          </span>
        )}
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:bg-neutral-300 disabled:text-neutral-500"
      >
        {isPending ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
