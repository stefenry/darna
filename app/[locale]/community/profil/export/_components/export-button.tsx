'use client';

// Story 8.3 — CTA « Exporter mes données ». Appelle la Server Action exportMyData
// puis, selon le mode :
//   - 'url'    : affiche le lien de téléchargement (URL signée 24h) + e-mail envoyé.
//   - 'inline' : storage indisponible → reconstruit un Blob local et déclenche
//                le téléchargement immédiatement (l'utilisateur récupère tout).
// Pendant la génération (peut dépasser 5s) : bouton désactivé + état « en cours »
// avec aria-busy (AR21).

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { exportMyData, type ExportActionState } from '../actions';

export function ExportButton({ locale }: { locale: 'fr' | 'ar' }) {
  const t = useTranslations('profil.export');
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ExportActionState | null>(null);

  function triggerInlineDownload(content: string, filename: string) {
    const blob = new Blob([content], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  }

  function onClick() {
    setResult(null);
    startTransition(async () => {
      const res = await exportMyData(locale);
      setResult(res);
      if (res.ok && res.mode === 'inline') {
        triggerInlineDownload(res.content, res.filename);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        aria-busy={isPending}
        className="inline-flex min-h-touch-lg w-fit items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
      >
        {isPending ? t('generating') : t('cta')}
      </button>

      <div aria-live="polite" className="min-h-5 text-sm">
        {result?.ok && result.mode === 'url' && (
          <span className="flex flex-col gap-1">
            <span className="font-medium text-accent-600">{t('ready')}</span>
            <a
              href={result.url}
              download={result.filename}
              className="w-fit font-medium text-accent-600 underline underline-offset-2 hover:text-accent-700"
            >
              {t('download')}
            </a>
            <span className="text-neutral-600">{t('urlExpiry')}</span>
          </span>
        )}
        {result?.ok && result.mode === 'inline' && (
          <span className="font-medium text-accent-600">{t('downloaded')}</span>
        )}
        {result && !result.ok && (
          <span role="alert" className="text-danger">
            {t('error')}
          </span>
        )}
      </div>
    </div>
  );
}
