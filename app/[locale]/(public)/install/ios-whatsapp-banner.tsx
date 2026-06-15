'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

const POPUP_CHECK_DELAY_MS = 200;

type CopyState = 'idle' | 'copied' | 'failed';

async function tryCopy(url: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function popupOpenedSuccessfully(win: Window | null): Promise<boolean> {
  if (!win) return Promise.resolve(false);
  return new Promise((resolve) => {
    window.setTimeout(() => {
      try {
        resolve(!win.closed);
      } catch {
        resolve(false);
      }
    }, POPUP_CHECK_DELAY_MS);
  });
}

export function IOSWhatsAppBanner() {
  const t = useTranslations('install.ios');
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  async function handleOpenInSafari() {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    const opened = window.open(url, '_blank');
    const isOpen = await popupOpenedSuccessfully(opened);

    if (isOpen) return;

    const copied = await tryCopy(url);
    if (copied) {
      setCopyState('copied');
      setFallbackUrl(null);
      window.setTimeout(() => setCopyState('idle'), 4000);
    } else {
      setCopyState('failed');
      setFallbackUrl(url);
    }
  }

  return (
    <aside
      role="alert"
      className="sticky top-0 z-10 -mx-4 mb-6 flex flex-col gap-3 bg-warning/90 p-4 text-neutral-900 sm:-mx-6"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-neutral-900" aria-hidden="true" />
        <div className="flex flex-col gap-2">
          <p className="text-base font-medium">{t('webviewTitle')}</p>
          <p className="text-sm">{t('webviewBody')}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleOpenInSafari}
        className="inline-flex min-h-touch items-center justify-center self-start rounded-[14px] bg-neutral-900 px-5 text-sm font-semibold text-white"
      >
        {t('openInSafari')}
      </button>
      {copyState === 'copied' && (
        <p className="text-sm" role="status">
          {t('linkCopied')}
        </p>
      )}
      {copyState === 'failed' && fallbackUrl && (
        <div className="flex flex-col gap-1" role="status">
          <p className="text-sm">{t('openFailed')}</p>
          <code className="block break-all rounded-md bg-neutral-900 px-3 py-2 text-xs text-white">
            {fallbackUrl}
          </code>
        </div>
      )}
    </aside>
  );
}
