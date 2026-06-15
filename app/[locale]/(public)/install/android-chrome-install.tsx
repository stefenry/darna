'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
  interface Window {
    __darnaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

const FALLBACK_TIMEOUT_MS = 1500;
const DISMISS_RETRY_MS = 30_000;

if (typeof window !== 'undefined' && !window.__darnaInstallPrompt) {
  const earlyCapture = (e: Event) => {
    e.preventDefault();
    window.__darnaInstallPrompt = e as BeforeInstallPromptEvent;
  };
  window.addEventListener('beforeinstallprompt', earlyCapture, { once: false });
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function AndroidChromeInstall() {
  const t = useTranslations('install.android');
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const isPrompting = useRef(false);
  const [ready, setReady] = useState(false);
  const [timeoutFired, setTimeoutFired] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(null);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setInstalled(true);
      return;
    }

    const captured = window.__darnaInstallPrompt;
    if (captured) {
      deferredPrompt.current = captured;
      setReady(true);
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      window.__darnaInstallPrompt = e as BeforeInstallPromptEvent;
      setReady(true);
    }

    function onAppInstalled() {
      setInstalled(true);
      setReady(false);
      deferredPrompt.current = null;
      window.__darnaInstallPrompt = null;
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    const timer = window.setTimeout(() => setTimeoutFired(true), FALLBACK_TIMEOUT_MS);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (dismissedUntil === null) return;
    const remaining = dismissedUntil - Date.now();
    if (remaining <= 0) {
      setDismissedUntil(null);
      return;
    }
    const t = window.setTimeout(() => setDismissedUntil(null), remaining);
    return () => window.clearTimeout(t);
  }, [dismissedUntil]);

  async function handleInstall() {
    if (!deferredPrompt.current || isPrompting.current) return;
    isPrompting.current = true;
    try {
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') {
        deferredPrompt.current = null;
        window.__darnaInstallPrompt = null;
        setReady(false);
      } else {
        setDismissedUntil(Date.now() + DISMISS_RETRY_MS);
      }
    } catch {
      deferredPrompt.current = null;
      window.__darnaInstallPrompt = null;
      setReady(false);
    } finally {
      isPrompting.current = false;
    }
  }

  if (installed) {
    return (
      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
            {t('alreadyInstalledTitle')}
          </h1>
          <p className="text-base text-neutral-500">{t('alreadyInstalledBody')}</p>
        </header>
      </section>
    );
  }

  const dismissedRemaining = dismissedUntil
    ? Math.max(0, Math.ceil((dismissedUntil - Date.now()) / 1000))
    : 0;
  const inCooldown = dismissedUntil !== null && dismissedRemaining > 0;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
          {t('pageTitle')}
        </h1>
        <p className="text-base text-neutral-500">{t('intro')}</p>
      </header>

      {ready && (
        <button
          type="button"
          onClick={handleInstall}
          disabled={inCooldown}
          aria-busy={isPrompting.current}
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white shadow-sm hover:bg-accent-600 disabled:bg-neutral-300 disabled:text-neutral-500"
        >
          {inCooldown ? t('ctaRetry') : t('cta')}
        </button>
      )}

      {ready && inCooldown && (
        <div className="rounded-[14px] bg-bg-soft p-4 text-sm text-neutral-700" role="status">
          <p className="font-medium text-neutral-900">{t('dismissedTitle')}</p>
          <p className="mt-1">{t('dismissedBody')}</p>
        </div>
      )}

      {!ready && timeoutFired && (
        <div className="flex flex-col gap-4 rounded-[14px] bg-bg-card p-4 shadow-xs">
          <h2 className="text-base font-medium text-neutral-900">{t('fallbackTitle')}</h2>
          <p className="text-base text-neutral-700">{t('fallbackBody')}</p>
          <details className="text-sm text-neutral-700">
            <summary className="cursor-pointer font-medium">{t('faqQuestion')}</summary>
            <p className="mt-2">{t('faqAnswer')}</p>
          </details>
        </div>
      )}
    </section>
  );
}
