'use client';

// Story 3.3 (AC5) — error boundary Numéros utiles : bannière inline + réessai.
// Dedup Sentry sur `error.digest` (pattern annuaire/error.tsx).

import { useEffect, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useTranslations } from 'next-intl';

const captured = new Set<string>();

export default function NumerosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors.numerosUtiles');
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const key = error.digest ?? `${error.name}:${error.message}`;
    if (seen.current === key) return;
    seen.current = key;
    if (captured.has(key)) return;
    captured.add(key);
    Sentry.captureException(error);
  }, [error]);

  return (
    <section className="flex flex-col gap-3">
      <p role="alert" className="rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-danger">
        {t('fetch_failed')}
      </p>
      <button
        onClick={reset}
        className="inline-flex min-h-touch w-fit items-center justify-center rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white hover:bg-accent-600"
      >
        {t('retry')}
      </button>
    </section>
  );
}
