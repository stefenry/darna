'use client';

// Story 3.5 (Task 5 / AC5/AC7/D7) — confirmation de retrait inline (pas overlay
// plein écran, cohérent bannissement des modales MVP). Champ `reason` optionnel ;
// appelle `retireDurableEntry` (RPC SECURITY DEFINER). Escape annule. Focus géré.

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { retireDurableEntry } from '../_actions/durable-content';
import type { DurableKind } from '@/lib/content/admin-config';

export function RetireConfirm({ kind, id }: { kind: DurableKind; id: string }) {
  const t = useTranslations('comod.admin');
  const tErr = useTranslations('errors.comod');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="inline-flex min-h-touch items-center justify-center rounded-[10px] px-3 text-sm font-medium text-danger hover:bg-bg-soft"
      >
        {t('retire')}
      </button>
    );
  }

  const onConfirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await retireDurableEntry(kind, id, reason);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(tErr(res.message_key.replace('errors.comod.', '') as never));
      }
    });
  };

  return (
    <div
      role="group"
      aria-label={t('confirmRetire')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
      className="flex flex-col gap-2 rounded-[10px] border border-danger/30 bg-bg-soft p-3"
    >
      <p className="text-sm font-medium text-neutral-800">{t('confirmRetire')}</p>
      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        {t('retireReasonLabel')}
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-touch rounded-[10px] bg-white px-3 text-sm text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className="inline-flex min-h-touch items-center justify-center rounded-[10px] bg-danger px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {t('retire')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-touch items-center justify-center rounded-[10px] px-3 text-sm font-medium text-neutral-600 hover:bg-white"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
