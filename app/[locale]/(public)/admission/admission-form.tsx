'use client';

import { useActionState, useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { submitAdmissionRequest, type SubmitState } from '@/app/actions/admission-submit';
import {
  ADMISSION_FIELD_ERROR_KEYS,
  type AdmissionFieldErrorKey,
} from '@/lib/validation/admission';

type Props = {
  locale: string;
  cguHref: string;
};

const INITIAL_STATE: SubmitState = { ok: false };
const ERROR_KEY_SET: ReadonlySet<string> = new Set(ADMISSION_FIELD_ERROR_KEYS);

function isKnownErrorKey(key: string): key is AdmissionFieldErrorKey {
  return ERROR_KEY_SET.has(key);
}

function errorMessage(
  t: ReturnType<typeof useTranslations<string>>,
  key: string,
  fallback: string,
): string {
  if (!isKnownErrorKey(key)) return fallback;
  // 'errors.admission.<code>' → namespace 'errors.admission' + key '<code>'
  const code = key.replace(/^errors\.admission\./, '');
  return t(code);
}

export function AdmissionForm({ locale, cguHref }: Props) {
  const t = useTranslations('admission.form');
  const tErrors = useTranslations('errors.admission');
  const tRate = useTranslations('errors.rate_limit');
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(submitAdmissionRequest, INITIAL_STATE);

  useEffect(() => {
    if (state.ok) {
      const targetLocale = state.locale ?? locale;
      router.push(`/${targetLocale}/auth/check-email`);
    }
  }, [state, router, locale]);

  const fieldErrors = 'fieldErrors' in state && state.fieldErrors ? state.fieldErrors : undefined;
  const duplicate = 'errorCode' in state && state.errorCode === 'duplicate_pending';
  const rateLimited = 'errorCode' in state && state.errorCode === 'rate_limited';

  const villaId = useId();
  const trancheId = useId();
  const firstNameId = useId();
  const emailId = useId();
  const cguId = useId();
  const villaErrId = `${villaId}-error`;
  const trancheErrId = `${trancheId}-error`;
  const firstNameErrId = `${firstNameId}-error`;
  const emailErrId = `${emailId}-error`;
  const cguErrId = `${cguId}-error`;

  const villaErr = fieldErrors?.villa?.[0];
  const trancheErr = fieldErrors?.tranche?.[0];
  const firstNameErr = fieldErrors?.first_name?.[0];
  const emailErr = fieldErrors?.email?.[0];
  const cguErr = fieldErrors?.cgu_accepted?.[0];

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5" aria-busy={isPending}>
      {duplicate && (
        <div role="alert" className="rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-neutral-700">
          {tErrors('duplicate_pending')}
        </div>
      )}
      {rateLimited && (
        <div role="alert" className="rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-neutral-700">
          {tRate('exceeded')}
        </div>
      )}

      <label htmlFor={villaId} className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-neutral-900">{t('villaLabel')}</span>
        <input
          id={villaId}
          type="number"
          name="villa"
          min={1}
          max={150}
          inputMode="numeric"
          required
          placeholder={t('villaPlaceholder')}
          aria-invalid={villaErr ? true : undefined}
          aria-describedby={villaErr ? villaErrId : undefined}
          className="min-h-touch rounded-[14px] border border-neutral-300 bg-bg-card px-4 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 aria-[invalid=true]:border-danger"
        />
        {villaErr && (
          <span id={villaErrId} role="alert" className="text-sm text-danger">
            {errorMessage(tErrors, villaErr, tErrors('villa_out_of_range'))}
          </span>
        )}
      </label>

      <label htmlFor={trancheId} className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-neutral-900">{t('trancheLabel')}</span>
        <select
          id={trancheId}
          name="tranche"
          required
          defaultValue=""
          aria-invalid={trancheErr ? true : undefined}
          aria-describedby={trancheErr ? trancheErrId : undefined}
          className="min-h-touch rounded-[14px] border border-neutral-300 bg-bg-card px-4 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 aria-[invalid=true]:border-danger"
        >
          <option value="" disabled>
            {t('tranchePlaceholder')}
          </option>
          <option value="A">{t('trancheOptionA')}</option>
          <option value="B">{t('trancheOptionB')}</option>
          <option value="C">{t('trancheOptionC')}</option>
          <option value="D">{t('trancheOptionD')}</option>
          <option value="E">{t('trancheOptionE')}</option>
        </select>
        {trancheErr && (
          <span id={trancheErrId} role="alert" className="text-sm text-danger">
            {errorMessage(tErrors, trancheErr, tErrors('tranche_invalid'))}
          </span>
        )}
      </label>

      <label htmlFor={firstNameId} className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-neutral-900">{t('firstNameLabel')}</span>
        <input
          id={firstNameId}
          type="text"
          name="first_name"
          required
          autoComplete="given-name"
          maxLength={40}
          placeholder={t('firstNamePlaceholder')}
          aria-invalid={firstNameErr ? true : undefined}
          aria-describedby={firstNameErr ? firstNameErrId : undefined}
          className="min-h-touch rounded-[14px] border border-neutral-300 bg-bg-card px-4 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 aria-[invalid=true]:border-danger"
        />
        {firstNameErr && (
          <span id={firstNameErrId} role="alert" className="text-sm text-danger">
            {errorMessage(tErrors, firstNameErr, tErrors('first_name_required'))}
          </span>
        )}
      </label>

      <label htmlFor={emailId} className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-neutral-900">{t('emailLabel')}</span>
        <input
          id={emailId}
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t('emailPlaceholder')}
          aria-invalid={emailErr ? true : undefined}
          aria-describedby={emailErr ? emailErrId : undefined}
          className="min-h-touch rounded-[14px] border border-neutral-300 bg-bg-card px-4 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 aria-[invalid=true]:border-danger"
        />
        {emailErr && (
          <span id={emailErrId} role="alert" className="text-sm text-danger">
            {errorMessage(tErrors, emailErr, tErrors('email_invalid'))}
          </span>
        )}
      </label>

      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-start gap-3">
          <Checkbox
            id={cguId}
            name="cgu_accepted"
            value="on"
            aria-invalid={cguErr ? true : undefined}
            aria-describedby={cguErr ? cguErrId : undefined}
          />
          <label htmlFor={cguId} className="text-sm text-neutral-700">
            {t('cguLabel')}{' '}
            <Link
              href={cguHref}
              className="font-medium text-accent-500 underline-offset-4 hover:underline"
            >
              {t('cguLinkText')}
            </Link>
            .
          </label>
        </div>
        {cguErr && (
          <span id={cguErrId} role="alert" className="text-sm text-danger">
            {errorMessage(tErrors, cguErr, tErrors('cgu_required'))}
          </span>
        )}
      </div>

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
