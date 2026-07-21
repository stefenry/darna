'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { removeResident } from '../actions';

// Retrait d'un résident : geste à fort impact (soft-delete + purge J+7) → même
// confirmation inline en 2 temps que PromoteButton, avec en plus un motif court
// OBLIGATOIRE (journalisé dans le moderation_log public — pas de PII). Sur
// succès, router.refresh() fait disparaître la carte (la liste filtre deleted_at).
export function RemoveButton({ userId, name }: { userId: string; name: string }) {
  const t = useTranslations('comod.residents.remove');
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reasonValid = reason.trim().length > 0 && reason.trim().length <= 200;

  function run() {
    if (!reasonValid) return;
    setError(null);
    startTransition(async () => {
      const res = await removeResident(userId, reason.trim());
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else {
        setError(t(`error.${res.code}`));
      }
    });
  }

  if (done) {
    return <span className="shrink-0 text-sm text-neutral-500">{t('removed')}</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-[10px] px-3 py-1.5 text-sm font-medium text-danger hover:bg-bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
      >
        {t('cta')}
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-sm text-neutral-700">{t('confirmQuestion', { name })}</span>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500">{t('reasonLabel')}</span>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          placeholder={t('reasonPlaceholder')}
          className="min-h-touch rounded-[10px] bg-card px-3 text-sm shadow-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={isPending || !reasonValid}
          className="rounded-[10px] bg-danger px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
        >
          {t('confirmCta')}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={isPending}
          className="rounded-[10px] px-2 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          {t('cancel')}
        </button>
      </div>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
