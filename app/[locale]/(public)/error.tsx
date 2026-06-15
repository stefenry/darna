'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useTranslations } from 'next-intl';

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-[50dvh] flex-col items-center justify-center px-4">
      <h1 className="text-xl font-semibold text-neutral-900">{t('generic')}</h1>
      <p className="mt-2 text-base text-neutral-500">{t('generic_description')}</p>
      <button
        onClick={reset}
        className="mt-6 inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-medium text-white hover:bg-accent-600"
      >
        {t('retry')}
      </button>
    </main>
  );
}
