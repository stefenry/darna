'use client';

// Story 3.4 (AC1/AC3/AC5) — bannière Pack accueil (in-page, pas overlay/modal —
// D3). CTA vers le Pack + « Plus tard » / « ✕ » qui posent `pack_accueil_dismissed_at`
// (Server Action). Optimistic : masquage local immédiat puis dismiss en arrière-plan
// (geste WhatsApp, NFR40b). a11y : region, ✕ aria-label, Escape ferme, focusable.

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { dismissPackBanner } from '../_actions/onboarding';

export function PackBanner({ locale }: { locale: string }) {
  const t = useTranslations('community.packAccueil.banner');
  const [hidden, setHidden] = useState(false);
  const [, startTransition] = useTransition();

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true); // optimistic
    startTransition(() => {
      void dismissPackBanner();
    });
  };

  return (
    <section
      role="region"
      aria-label={t('title')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') dismiss();
      }}
      className="relative flex flex-col gap-3 rounded-[14px] border border-accent-200 bg-bg-soft p-4"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('dismiss')}
        className="absolute end-3 top-3 inline-flex size-9 items-center justify-center rounded-[10px] text-neutral-500 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        <X className="size-5" aria-hidden />
      </button>

      <div className="flex flex-col gap-1 pe-9">
        <h2 className="text-lg font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-base text-neutral-700">{t('body')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/${locale}/community/guide/pack-accueil`}
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white hover:bg-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          {t('cta')}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] px-4 text-sm font-medium text-neutral-600 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          {t('later')}
        </button>
      </div>
    </section>
  );
}
