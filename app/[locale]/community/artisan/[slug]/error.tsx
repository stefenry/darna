'use client';

// Story 2.3 (AC7) — error boundary fiche : bannière inline + réessai, jamais de
// modale. Dedup instance-locale (review 2026-06-17 P4) : on évite la double-
// capture d'une même erreur dans CE boundary uniquement, sans Set module-level
// (croissance non bornée + suppression Sentry après reset/retry).

import { useEffect, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useTranslations } from 'next-intl';

export default function ArtisanError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors.artisan');
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    const key = error.digest ?? `${error.name}:${error.message}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
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
