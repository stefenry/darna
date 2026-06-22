'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { signInMagicLink, type SignInState } from '@/app/actions/auth-signin';
import { verifyEmailCode, type VerifyCodeState } from '@/app/actions/auth-verify-code';

const INITIAL_LINK: SignInState = { ok: false };
const INITIAL_CODE: VerifyCodeState = { ok: false };

type LoginErrorKey = 'emailErrorRequired' | 'emailErrorInvalid' | 'codeErrorInvalid';
const ERROR_KEYS: ReadonlySet<LoginErrorKey> = new Set([
  'emailErrorRequired',
  'emailErrorInvalid',
  'codeErrorInvalid',
]);

function translateError(t: ReturnType<typeof useTranslations>, code: string) {
  if ((ERROR_KEYS as ReadonlySet<string>).has(code)) {
    return t(code as LoginErrorKey);
  }
  return t('emailErrorInvalid');
}

export function LoginForm() {
  const t = useTranslations('auth.login');
  const [linkState, linkFormAction, linkPending] = useActionState(signInMagicLink, INITIAL_LINK);
  const [codeState, codeFormAction, codePending] = useActionState(verifyEmailCode, INITIAL_CODE);
  const [email, setEmail] = useState('');

  const emailError = linkState.fieldErrors?.email?.[0];
  const codeError = codeState.fieldErrors?.code?.[0];
  const codeEmailError = codeState.fieldErrors?.email?.[0];

  return (
    <div className="flex flex-col gap-8">
      <form
        action={linkFormAction}
        noValidate
        className="flex flex-col gap-4"
        aria-busy={linkPending}
      >
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          disabled={linkPending}
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:bg-neutral-300 disabled:text-neutral-500"
        >
          {linkPending ? t('submitting') : t('submit')}
        </button>
      </form>

      <div className="flex items-center gap-3 text-sm text-neutral-500">
        <span className="h-px flex-1 bg-neutral-200" />
        <span>{t('codeDivider')}</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <form
        action={codeFormAction}
        noValidate
        className="flex flex-col gap-4"
        aria-busy={codePending}
      >
        <p className="text-sm text-neutral-700">{t('codeHelp')}</p>
        <input type="hidden" name="email" value={email} />
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-neutral-900">{t('codeLabel')}</span>
          <input
            type="text"
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="123456"
            aria-invalid={codeError || codeEmailError ? true : undefined}
            aria-describedby={codeError ? 'code-error' : undefined}
            className="min-h-touch rounded-[14px] border border-neutral-300 bg-bg-card px-4 text-center text-2xl font-semibold tracking-[0.4em] text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 aria-[invalid=true]:border-danger"
          />
          {(codeError || codeEmailError) && (
            <span id="code-error" role="alert" className="text-sm text-danger">
              {translateError(t, codeError || codeEmailError || 'codeErrorInvalid')}
            </span>
          )}
        </label>

        <button
          type="submit"
          disabled={codePending || email.length === 0}
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:bg-neutral-300 disabled:text-neutral-500"
        >
          {codePending ? t('codeSubmitting') : t('codeSubmit')}
        </button>
      </form>
    </div>
  );
}
