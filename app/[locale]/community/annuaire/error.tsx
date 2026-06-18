'use client';

// Story 2.2 (AC7) — error boundary de l'annuaire : bannière inline + réessai,
// jamais de modale (UX §états).
//
// Review F23 — dedup Sentry sur `error.digest` : Next.js peut remonter une
// nouvelle instance `Error` au remount post-`reset()`, ce qui doublonnait les
// captures. On capture une seule fois par `digest` (set persistant module).

import { useEffect, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useTranslations } from 'next-intl';

const captured = new Set<string>();

export default function AnnuaireError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors.annuaire');
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const key = error.digest ?? `${error.name}:${error.message}`;
    if (seen.current === key) return; // re-render même instance
    seen.current = key;
    if (captured.has(key)) return; // déjà loggué dans cette session
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
