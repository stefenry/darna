'use client';

// Story 4.3 (AC4) — bouton « Retirer » affiché à l'AUTEUR sur la page détail de
// sa propre alerte / bon plan. Confirmation inline (pas de modale plein écran),
// Escape pour annuler, focus géré — miroir de retire-confirm.tsx (3.5).

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { retractOwnEphemeral, type RetractKind } from '../../_actions/ephemeral-retract';

export function RetireOwnButton({
  kind,
  id,
  locale,
}: {
  kind: RetractKind;
  id: string;
  locale: string;
}) {
  const t = useTranslations('community.alertes.retire');
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
        className="inline-flex min-h-touch w-fit items-center justify-center rounded-[10px] px-3 text-sm font-medium text-danger hover:bg-bg-soft"
      >
        {t('action')}
      </button>
    );
  }

  const onConfirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await retractOwnEphemeral(kind, id, '');
      if (res.ok) {
        router.push(`/${locale}/community/alertes`);
        router.refresh();
      } else {
        setError(t(`error.${res.code}`));
      }
    });
  };

  return (
    <div
      role="group"
      aria-label={t('confirm')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
      className="flex flex-col gap-2 rounded-[10px] border border-danger/30 bg-bg-soft p-3"
    >
      <p className="text-sm font-medium text-neutral-800">{t('confirm')}</p>
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
          {t('action')}
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
