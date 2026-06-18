'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { rejectAdmission } from '../actions';
import { ADMISSION_DECISION_REASONS } from '@/lib/validation/admission-decision';

type Props = {
  admissionRequestId: string;
  onResolved: () => void;
};

// Dialog motif via <dialog> natif (showModal — focus-trap, ESC, backdrop a11y
// natifs ; décision D6, pas de dépendance Radix). Le bouton confirmer reste
// désactivé tant qu'aucun motif n'est sélectionné (fixed-list enum, FR7).
export function DecisionForm({ admissionRequestId, onResolved }: Props) {
  const t = useTranslations('comod.admission');
  const tErr = useTranslations('errors.comod');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleId = useId();
  const [motive, setMotive] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function open() {
    setMotive('');
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function confirm() {
    if (!motive) return;
    setError(null);
    startTransition(async () => {
      const res = await rejectAdmission({ admission_request_id: admissionRequestId, motive });
      if (res.ok) {
        close();
        onResolved();
      } else {
        const errKey = res.message_key.startsWith('errors.comod.')
          ? res.message_key.replace('errors.comod.', '')
          : 'decision_failed';
        setError(tErr(errKey));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-bg-soft px-5 text-sm font-semibold text-danger transition-colors hover:bg-neutral-200"
      >
        {t('rejectCta')}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        className="m-auto w-[min(92vw,440px)] rounded-[18px] bg-bg-card p-6 text-neutral-900 shadow-lg backdrop:bg-neutral-900/40"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={dialogTitleId} className="text-lg font-semibold tracking-tight">
              {t('rejectDialogTitle')}
            </h2>
            <p className="text-sm text-neutral-700">{t('rejectDialogIntro')}</p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{t('rejectDialogTitle')}</legend>
            {ADMISSION_DECISION_REASONS.map((reason) => (
              <label
                key={reason}
                className="flex items-center gap-3 rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-neutral-900"
              >
                <input
                  type="radio"
                  name="motive"
                  value={reason}
                  checked={motive === reason}
                  onChange={() => setMotive(reason)}
                  className="size-4 accent-accent-500"
                />
                {t(`motive_${reason}`)}
              </label>
            ))}
          </fieldset>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              disabled={isPending}
              className="inline-flex min-h-touch items-center justify-center rounded-[14px] px-5 text-sm font-medium text-neutral-700 hover:bg-bg-soft"
            >
              {t('cancelCta')}
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!motive || isPending}
              className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-danger px-5 text-sm font-semibold text-white transition-colors hover:bg-danger/90 disabled:bg-neutral-300 disabled:text-neutral-500"
            >
              {isPending ? t('submitting') : t('confirmRejectCta')}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
