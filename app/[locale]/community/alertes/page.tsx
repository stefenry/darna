import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Bell, Plus } from 'lucide-react';
import { routing } from '@/lib/i18n/routing';
import { log } from '@/lib/logger';
import type { Locale } from '@/lib/i18n/config';
import { fetchFeed } from './data';
import { FeedCard } from './_components/feed-card';

// Page authentifiée (RLS-scopée), feed temps réel → pas de SSG.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'community.alertes' });
  return { title: t('title') };
}

export default async function AlertesFeedPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('community.alertes');

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${locale}/community/alertes/nouveau`}
          className="inline-flex min-h-touch items-center gap-2 rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white hover:bg-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          <Plus className="size-4" aria-hidden />
          {t('publishAlert')}
        </Link>
        <Link
          href={`/${locale}/community/bons-plans/nouveau`}
          className="inline-flex min-h-touch items-center gap-2 rounded-[14px] bg-bg-soft px-5 text-sm font-semibold text-neutral-800 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          <Plus className="size-4" aria-hidden />
          {t('publishTip')}
        </Link>
      </div>

      <FeedList locale={locale as Locale} />
    </section>
  );
}

async function FeedList({ locale }: { locale: Locale }) {
  let items;
  try {
    items = await fetchFeed(locale);
  } catch (error) {
    log({
      level: 'error',
      event: 'alerts.feed_fetch_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: (error as { code?: string })?.code ?? 'unknown' },
    });
    const t = await getTranslations('errors.alertes');
    return (
      <p role="alert" className="rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-danger">
        {t('fetch_failed')}
      </p>
    );
  }

  const t = await getTranslations('community.alertes');
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[14px] bg-bg-soft px-4 py-10 text-center">
        <Bell className="size-8 text-neutral-400" aria-hidden />
        <p className="text-base text-neutral-600">{t('empty')}</p>
        <Link
          href={`/${locale}/community/alertes/nouveau`}
          className="inline-flex min-h-touch items-center gap-2 rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white hover:bg-accent-600"
        >
          <Plus className="size-4" aria-hidden />
          {t('emptyCta')}
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`}>
          <FeedCard item={item} locale={locale} />
        </li>
      ))}
    </ul>
  );
}
