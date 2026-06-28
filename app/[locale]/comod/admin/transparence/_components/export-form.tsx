'use client';

// Story 8.4 — formulaire d'export du journal de modération (période + format).
// useActionState → state url/inline. En mode inline (storage indispo), reconstruit
// un Blob local et déclenche le téléchargement.

import { useActionState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  exportModerationLog,
  MODERATION_EXPORT_INITIAL,
  type ModerationExportState,
} from '../actions';

export function ModerationExportForm({ locale }: { locale: 'fr' | 'ar' }) {
  const t = useTranslations('comod.transparence');
  const [state, formAction, isPending] = useActionState<ModerationExportState, FormData>(
    exportModerationLog,
    MODERATION_EXPORT_INITIAL,
  );
  const downloaded = useRef<string | null>(null);

  useEffect(() => {
    if (state.ok && state.mode === 'inline' && downloaded.current !== state.filename) {
      downloaded.current = state.filename;
      const blob = new Blob([state.content], { type: state.mime });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = state.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4" aria-busy={isPending}>
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{t('fromLabel')}</span>
          <input
            type="date"
            name="from"
            className="min-h-touch rounded-[10px] border border-neutral-200 bg-white px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{t('toLabel')}</span>
          <input
            type="date"
            name="to"
            className="min-h-touch rounded-[10px] border border-neutral-200 bg-white px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{t('formatLabel')}</span>
          <select
            name="format"
            defaultValue="csv"
            className="min-h-touch rounded-[10px] border border-neutral-200 bg-white px-3 text-sm"
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
        >
          {isPending ? t('generating') : t('cta')}
        </button>
      </div>

      <div aria-live="polite" className="min-h-5 text-sm">
        {state.ok && state.mode === 'url' && (
          <span className="flex flex-col gap-1">
            <span className="font-medium text-accent-600">{t('ready')}</span>
            <a
              href={state.url}
              download={state.filename}
              className="w-fit font-medium text-accent-600 underline underline-offset-2 hover:text-accent-700"
            >
              {t('download')}
            </a>
            <span className="text-neutral-600">{t('urlExpiry')}</span>
          </span>
        )}
        {state.ok && state.mode === 'inline' && (
          <span className="font-medium text-accent-600">{t('downloaded')}</span>
        )}
        {state.ok === false && (
          <span role="alert" className="text-danger">
            {t(state.code === 'forbidden' ? 'forbidden' : 'error')}
          </span>
        )}
      </div>
    </form>
  );
}
