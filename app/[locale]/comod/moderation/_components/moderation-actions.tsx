'use client';

// Story 5.3 — actions co_mod sur un signalement : « Retirer le contenu » (motif
// fermé + note) ou « Conserver le contenu » (note). Divulgation inline (focus,
// Escape), useTransition, mapping erreurs i18n. Au succès → retour à la file +
// refresh (la décision est atomique côté RPC, anti double-modération).

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { REMOVAL_MOTIVES, type RemovalMotive } from '@/lib/validation/moderation';
import { removeReportedContent, keepReportedContent, escalateReportLegal } from '../actions';

type Mode = null | 'remove' | 'keep' | 'escalate';

export function ModerationActions({ reportId, locale }: { reportId: string; locale: string }) {
  const t = useTranslations('comod.moderation');
  const tErr = useTranslations('errors.moderation');
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [motive, setMotive] = useState<RemovalMotive | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const firstFieldRef = useRef<HTMLSelectElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (mode) firstFieldRef.current?.focus();
  }, [mode]);

  const onDone = () => {
    router.push(`/${locale}/comod/moderation`);
    router.refresh();
  };

  const submitRemove = () => {
    setError(null);
    if (!motive) {
      setError(tErr('motive_required'));
      return;
    }
    startTransition(async () => {
      const res = await removeReportedContent({
        report_id: reportId,
        motive,
        note: note.trim() ? note : null,
      });
      if (res.ok) onDone();
      else setError(tErr(res.code));
    });
  };

  const submitKeep = () => {
    setError(null);
    startTransition(async () => {
      const res = await keepReportedContent({
        report_id: reportId,
        note: note.trim() ? note : null,
      });
      if (res.ok) onDone();
      else setError(tErr(res.code));
    });
  };

  const submitEscalate = () => {
    setError(null);
    if (!note.trim()) {
      setError(tErr('context_required'));
      return;
    }
    startTransition(async () => {
      const res = await escalateReportLegal({ report_id: reportId, context_note: note });
      if (res.ok) onDone();
      else setError(tErr(res.code));
    });
  };

  const submitFor: Record<Exclude<Mode, null>, () => void> = {
    remove: submitRemove,
    keep: submitKeep,
    escalate: submitEscalate,
  };

  if (mode === null) {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setNote('');
            setMode('remove');
          }}
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-danger px-5 text-sm font-semibold text-white hover:opacity-90"
        >
          {t('actions.remove')}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setNote('');
            setMode('keep');
          }}
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-bg-soft px-5 text-sm font-semibold text-accent-600 hover:bg-neutral-300"
        >
          {t('actions.keep')}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setNote('');
            setMode('escalate');
          }}
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] border border-neutral-200 px-5 text-sm font-semibold text-neutral-700 hover:bg-bg-soft"
        >
          {t('actions.escalate')}
        </button>
      </div>
    );
  }

  const formTitle =
    mode === 'remove'
      ? t('removeForm.title')
      : mode === 'escalate'
        ? t('escalateForm.title')
        : t('keepForm.title');
  const noteLabel = mode === 'escalate' ? t('escalateForm.contextLabel') : t('noteLabel');

  return (
    <div
      role="group"
      aria-label={mode === 'remove' ? t('actions.remove') : t('actions.keep')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setMode(null);
      }}
      className="flex flex-col gap-3 rounded-[14px] border border-neutral-200 bg-bg-soft p-4"
    >
      <p className="text-sm font-semibold text-neutral-800">{formTitle}</p>

      {mode === 'remove' && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{t('removeForm.motiveLabel')}</span>
          <select
            ref={firstFieldRef as React.RefObject<HTMLSelectElement>}
            value={motive}
            onChange={(e) => setMotive(e.target.value as RemovalMotive)}
            className="min-h-touch rounded-[10px] border border-neutral-200 bg-white px-3 text-sm"
          >
            <option value="" disabled>
              {t('removeForm.motivePlaceholder')}
            </option>
            {REMOVAL_MOTIVES.map((m) => (
              <option key={m} value={m}>
                {t(`motives.${m}`)}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">{noteLabel}</span>
        <textarea
          ref={
            mode !== 'remove' ? (firstFieldRef as React.RefObject<HTMLTextAreaElement>) : undefined
          }
          value={note}
          maxLength={mode === 'escalate' ? 1000 : 2000}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="rounded-[10px] border border-neutral-200 bg-white px-3 py-2 text-sm"
          placeholder={
            mode === 'escalate' ? t('escalateForm.contextPlaceholder') : t('notePlaceholder')
          }
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submitFor[mode]}
          disabled={isPending}
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-4 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
        >
          {isPending ? t('submitting') : t('confirm')}
        </button>
        <button
          type="button"
          onClick={() => setMode(null)}
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] px-3 text-sm font-medium text-neutral-600 hover:bg-white"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
