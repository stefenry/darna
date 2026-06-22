'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';

// Story 7.3 (AC4) — mise à jour gracieuse du Service Worker. Le SW utilise
// skipWaiting + clientsClaim : un nouveau SW prend la main immédiatement, mais on
// NE recharge PAS automatiquement (ça perdrait la saisie en cours). On détecte la
// prise de contrôle d'un NOUVEAU SW (controllerchange après qu'un controller
// existait déjà) et on propose un rafraîchissement doux via un toast.
export function ServiceWorkerUpdater() {
  const t = useTranslations('pwa');
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // true si la page est déjà contrôlée par un SW au montage.
    let hadController = Boolean(navigator.serviceWorker.controller);

    function onControllerChange() {
      if (!navigator.serviceWorker.controller) return;
      // Prise de contrôle alors qu'un SW contrôlait déjà → c'est une MAJ.
      if (hadController) setUpdateReady(true);
      hadController = true;
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () =>
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  if (!updateReady) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto mb-4 flex max-w-md items-center justify-between gap-3 rounded-[14px] bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg"
    >
      <span>{t('updateAvailable')}</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex min-h-touch items-center gap-1 rounded-[10px] bg-white/15 px-3 font-medium hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <RefreshCw className="size-4" aria-hidden />
        {t('refresh')}
      </button>
    </div>
  );
}
