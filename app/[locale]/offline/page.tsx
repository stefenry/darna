import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { WifiOff } from 'lucide-react';
import { routing } from '@/lib/i18n/routing';
import { OfflineRetry } from './_components/offline-retry';

// Story 7.3 — page de repli hors-ligne précachée (next.config additionalPrecache
// + fallback SW). Servie quand une navigation échoue sans cache (1re visite sans
// réseau). 100% statique (aucun accès DB/auth) pour être précachable.
export const dynamic = 'force-static';

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'offline' });
  return { title: t('pageTitle'), robots: { index: false } };
}

export default async function OfflinePage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);
  const t = await getTranslations('offline');

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-bg-soft text-neutral-500">
        <WifiOff className="size-7" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
      <p className="text-base text-neutral-600">{t('body')}</p>
      <p className="text-sm text-neutral-500">{t('hint')}</p>
      <OfflineRetry label={t('retry')} />
    </main>
  );
}
