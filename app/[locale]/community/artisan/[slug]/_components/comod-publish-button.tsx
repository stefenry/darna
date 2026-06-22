'use client';

// 2026-06-23 — Bouton "Publier sans consentement" pour les co_mods sur la
// fiche artisan en state pending_consent (workaround bêta sans SMS provider).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { publishArtisanWithoutConsent } from '../_actions/publish-no-consent';

type Props = {
  artisanId: string;
  locale: 'fr' | 'ar';
};

export function ComodPublishButton({ artisanId, locale }: Props) {
  const t = useTranslations('comod.artisan');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (isPending) return;
    if (!window.confirm(t('confirm'))) return;
    setError(null);
    startTransition(async () => {
      const res = await publishArtisanWithoutConsent(artisanId, locale);
      if (res.ok) {
        router.refresh();
      } else {
        setError(t(`errors.${res.error}` as 'errors.failed'));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-[14px] bg-warning/10 p-4 shadow-xs">
      <p className="text-sm font-medium text-neutral-900">{t('pendingTitle')}</p>
      <p className="text-xs text-neutral-700">{t('pendingHint')}</p>
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="mt-1 inline-flex min-h-touch w-fit items-center justify-center rounded-[14px] bg-warning px-5 text-sm font-semibold text-white shadow-sm hover:bg-warning/90 disabled:opacity-60"
      >
        {isPending ? t('publishing') : t('publishCta')}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
