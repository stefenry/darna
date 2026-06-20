'use client';

// Story 5.2 (FR31) — bouton « Signaler » générique, montable sur n'importe quel
// contenu (artisan, avis, alerte, bon plan, entrée guide, numéro utile). Divulgation
// inline (pas de modale plein écran), Escape pour annuler, focus géré — miroir
// retire-own-button.tsx (4.3). Dropdown motif (liste fermée) + note optionnelle 200c.

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  REPORT_REASONS,
  REPORT_NOTE_MAXLEN,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/validation/report';
import { submitReport, type SubmitReportState } from '@/app/actions/report-submit';

type Props = {
  targetType: ReportTargetType;
  targetId: string;
  /** Variante d'affichage : `link` (discret, sous le contenu) ou `button`. */
  variant?: 'link' | 'button';
};

export function ReportButton({ targetType, targetId, variant = 'link' }: Props) {
  const t = useTranslations('community.report');
  const tErr = useTranslations('errors.report');
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (open) selectRef.current?.focus();
  }, [open]);

  if (done) {
    return (
      <p role="status" className="text-sm font-medium text-accent-600">
        {t('success')}
      </p>
    );
  }

  if (!open) {
    const triggerClass =
      variant === 'button'
        ? 'inline-flex min-h-touch w-fit items-center justify-center rounded-[10px] border border-neutral-200 px-3 text-sm font-medium text-neutral-600 hover:bg-bg-soft'
        : 'inline-flex min-h-touch w-fit items-center text-sm font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-700';
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={triggerClass}
      >
        {t('action')}
      </button>
    );
  }

  const onSubmit = () => {
    setError(null);
    if (!reason) {
      setError(tErr('reason_invalid'));
      return;
    }
    startTransition(async () => {
      const res: SubmitReportState = await submitReport({
        target_type: targetType,
        target_id: targetId,
        reason,
        note_text: note.trim() ? note : null,
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      if ('fieldErrors' in res) {
        const firstKey = (Object.values(res.fieldErrors)[0] ?? [])[0];
        setError(firstKey ? tErr(firstKey) : tErr('generic'));
      } else {
        setError(tErr(res.errorCode));
      }
    });
  };

  return (
    <div
      role="group"
      aria-label={t('dialogTitle')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
      className="flex flex-col gap-3 rounded-[10px] border border-neutral-200 bg-bg-soft p-3"
    >
      <p className="text-sm font-semibold text-neutral-800">{t('dialogTitle')}</p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">{t('reasonLabel')}</span>
        <select
          ref={selectRef}
          value={reason}
          onChange={(e) => setReason(e.target.value as ReportReason)}
          className="min-h-touch rounded-[10px] border border-neutral-200 bg-white px-3 text-sm"
        >
          <option value="" disabled>
            {t('reasonPlaceholder')}
          </option>
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {t(`reasons.${r}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">{t('noteLabel')}</span>
        <textarea
          value={note}
          maxLength={REPORT_NOTE_MAXLEN}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="rounded-[10px] border border-neutral-200 bg-white px-3 py-2 text-sm"
          placeholder={t('notePlaceholder')}
        />
        <span className="text-xs text-neutral-400">
          {note.length}/{REPORT_NOTE_MAXLEN}
        </span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending}
          className="inline-flex min-h-touch items-center justify-center rounded-[10px] bg-accent-500 px-4 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
        >
          {isPending ? t('submitting') : t('submit')}
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
