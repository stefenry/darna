'use client';

// Story 4.3 — publication d'un bon plan typé expirable. Catégorie + titre + corps
// + date d'expiration explicite (picker, max 30j). Version AR optionnelle repliée.

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TIP_CATEGORY_KEYS } from '@/lib/content/ephemeral';
import { createTip, CREATE_TIP_INITIAL, type CreateTipState } from '../actions';

export function TipPublishForm({
  locale,
  minDate,
  maxDate,
}: {
  locale: string;
  minDate: string;
  maxDate: string;
}) {
  const t = useTranslations('community.bonsPlans');
  const tErr = useTranslations('errors.tip');
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<CreateTipState, FormData>(
    createTip,
    CREATE_TIP_INITIAL,
  );

  useEffect(() => {
    if (state.ok) router.push(`/${locale}/community/alertes`);
  }, [state, router, locale]);

  const fieldError = !state.ok && 'error' in state ? state.error : null;
  const errMsg =
    fieldError && fieldError.code === 'validation'
      ? tErr(fieldError.message_key)
      : fieldError && fieldError.code === 'rate_limited'
        ? tErr('rate_limited')
        : fieldError && (fieldError.code === 'forbidden' || fieldError.code === 'submit_failed')
          ? tErr('submit_failed')
          : null;

  return (
    <form
      action={formAction}
      noValidate
      aria-busy={isPending}
      className="flex flex-col gap-4 pb-28"
    >
      {errMsg && (
        <p
          role="alert"
          className="rounded-[14px] border border-danger/30 bg-bg-soft p-3 text-sm text-danger"
        >
          {errMsg}
        </p>
      )}

      <fieldset className="flex flex-col gap-4" disabled={isPending}>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-neutral-700">{t('new.categoryLabel')}</legend>
          <div className="flex flex-wrap gap-2">
            {TIP_CATEGORY_KEYS.map((key, i) => (
              <label
                key={key}
                className="inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-[10px] bg-bg-soft px-4 text-sm font-medium text-neutral-800 has-[:checked]:bg-accent-100 has-[:checked]:text-accent-700 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-500"
              >
                <input
                  type="radio"
                  name="category_key"
                  value={key}
                  defaultChecked={i === 0}
                  className="size-4 accent-accent-500"
                />
                {t(`categories.${key}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-700">{t('new.titleLabel')}</span>
          <input
            name="title_fr"
            type="text"
            required
            maxLength={200}
            placeholder={t('new.titlePlaceholder')}
            className="min-h-touch rounded-[10px] bg-bg-soft px-3 text-base text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-700">{t('new.bodyLabel')}</span>
          <textarea
            name="body_fr"
            required
            rows={4}
            maxLength={5000}
            placeholder={t('new.bodyPlaceholder')}
            className="rounded-[10px] bg-bg-soft px-3 py-2 text-base text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-neutral-700">{t('new.expiresLabel')}</span>
          <input
            name="expires_on"
            type="date"
            required
            min={minDate}
            max={maxDate}
            defaultValue={maxDate}
            className="min-h-touch w-fit rounded-[10px] bg-bg-soft px-3 text-base text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
          />
          <span className="text-xs text-neutral-500">{t('new.expiresHint')}</span>
        </label>

        <details className="rounded-[10px] bg-bg-soft px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-neutral-600">
            {t('new.addArabic')}
          </summary>
          <div className="mt-3 flex flex-col gap-3" dir="rtl">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-700">{t('new.titleLabelAr')}</span>
              <input
                name="title_ar"
                type="text"
                maxLength={200}
                className="min-h-touch rounded-[10px] bg-white px-3 text-base text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-700">{t('new.bodyLabelAr')}</span>
              <textarea
                name="body_ar"
                rows={4}
                maxLength={5000}
                className="rounded-[10px] bg-white px-3 py-2 text-base text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
              />
            </label>
          </div>
        </details>
      </fieldset>

      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-bg-page/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-touch-lg w-full items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
          >
            {isPending ? t('new.publishing') : t('new.publish')}
          </button>
        </div>
      </div>
    </form>
  );
}
