'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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

// Store externe (react-hooks v6) : le prompt différé et l'état « installé »
// vivent hors React (window.__darnaInstallPrompt + drapeau appinstalled) et
// sont lus via useSyncExternalStore — pas de setState synchrone dans un effet.
const storeListeners = new Set<() => void>();
let appInstalledFired = false;

function emitStoreChange() {
  for (const listener of storeListeners) listener();
}

function setGlobalPrompt(e: BeforeInstallPromptEvent | null) {
  window.__darnaInstallPrompt = e;
  emitStoreChange();
}

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

function subscribeInstallStore(onChange: () => void) {
  storeListeners.add(onChange);
  const onBeforeInstallPrompt = (e: Event) => {
    e.preventDefault();
    setGlobalPrompt(e as BeforeInstallPromptEvent);
  };
  const onAppInstalled = () => {
    appInstalledFired = true;
    setGlobalPrompt(null);
  };
  const mql = window.matchMedia('(display-mode: standalone)');
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  window.addEventListener('appinstalled', onAppInstalled);
  mql.addEventListener('change', emitStoreChange);
  return () => {
    storeListeners.delete(onChange);
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', onAppInstalled);
    mql.removeEventListener('change', emitStoreChange);
  };
}

function getPromptSnapshot(): BeforeInstallPromptEvent | null {
  return window.__darnaInstallPrompt ?? null;
}
const getServerPromptSnapshot = () => null;

function getInstalledSnapshot(): boolean {
  return appInstalledFired || isStandaloneDisplay();
}
const getServerInstalledSnapshot = () => false;

export function AndroidChromeInstall() {
  const t = useTranslations('install.android');
  const isPrompting = useRef(false);
  const [prompting, setPrompting] = useState(false);
  const [timeoutFired, setTimeoutFired] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(null);

  const deferredPrompt = useSyncExternalStore(
    subscribeInstallStore,
    getPromptSnapshot,
    getServerPromptSnapshot,
  );
  const installed = useSyncExternalStore(
    subscribeInstallStore,
    getInstalledSnapshot,
    getServerInstalledSnapshot,
  );
  const ready = deferredPrompt !== null;

  useEffect(() => {
    const timer = window.setTimeout(() => setTimeoutFired(true), FALLBACK_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (dismissedUntil === null) return;
    // Délai ≤ 0 → le timeout tire dès la prochaine tick (jamais de setState
    // synchrone dans le corps de l'effet).
    const remaining = Math.max(0, dismissedUntil - Date.now());
    const timer = window.setTimeout(() => setDismissedUntil(null), remaining);
    return () => window.clearTimeout(timer);
  }, [dismissedUntil]);

  async function handleInstall() {
    if (!deferredPrompt || isPrompting.current) return;
    isPrompting.current = true;
    setPrompting(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setGlobalPrompt(null);
      } else {
        setDismissedUntil(Date.now() + DISMISS_RETRY_MS);
      }
    } catch {
      setGlobalPrompt(null);
    } finally {
      isPrompting.current = false;
      setPrompting(false);
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

  // L'effet ci-dessus remet dismissedUntil à null pile à l'expiration : tant
  // qu'il est non-null, le cooldown est actif (pas de Date.now() au rendu).
  const inCooldown = dismissedUntil !== null;

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
          aria-busy={prompting}
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
