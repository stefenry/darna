'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { promoteToComod } from '../actions';

// Promotion co_mod : geste à fort impact (le retrait est script-only) → on exige
// une confirmation inline en 2 temps (pas de native confirm). Sur succès, on
// router.refresh() pour que le badge co_mod remplace le bouton, et on affiche le
// rappel « doit se reconnecter ».
export function PromoteButton({ userId, name }: { userId: string; name: string }) {
  const t = useTranslations('comod.residents');
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await promoteToComod(userId);
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else {
        setConfirming(false);
        setError(t(`error.${res.code}`));
      }
    });
  }

  if (done) {
    return <span className="shrink-0 text-sm text-accent-600">{t('promoted')}</span>;
  }

  if (!confirming) {
    return (
      <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-[10px] border border-accent-500 px-3 py-1.5 text-sm font-medium text-accent-600 hover:bg-bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          {t('promote')}
        </button>
        {error && (
          <span role="alert" className="text-xs text-danger">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-sm text-neutral-700">{t('confirmQuestion', { name })}</span>
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className="rounded-[10px] bg-accent-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        {t('confirmCta')}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={isPending}
        className="rounded-[10px] px-2 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
      >
        {t('cancel')}
      </button>
    </div>
  );
}
