import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Gift, Plus } from 'lucide-react';
import { routing } from '@/lib/i18n/routing';
import { log } from '@/lib/logger';
import type { Locale } from '@/lib/i18n/config';
import { fetchTips } from './data';
import { FeedCard } from '@/app/[locale]/community/_components/feed-card';

// Liste des bons plans — jumelle de la page alertes depuis la séparation du flux
// unifié (2026-07-26). Page authentifiée (RLS-scopée), contenu éphémère → pas de SSG.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'community.bonsPlans.list' });
  return { title: t('title') };
}

export default async function BonsPlansFeedPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('community.bonsPlans.list');

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${locale}/community/bons-plans/nouveau`}
          className="inline-flex min-h-touch items-center gap-2 rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white hover:bg-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          <Plus className="size-4" aria-hidden />
          {t('publish')}
        </Link>
      </div>

      <TipsList locale={locale as Locale} />
    </section>
  );
}

async function TipsList({ locale }: { locale: Locale }) {
  let items;
  try {
    items = await fetchTips(locale);
  } catch (error) {
    log({
      level: 'error',
      event: 'tips.feed_fetch_failed',
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

  const t = await getTranslations('community.bonsPlans.list');
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[14px] bg-bg-soft px-4 py-10 text-center">
        <Gift className="size-8 text-neutral-400" aria-hidden />
        <p className="text-base text-neutral-600">{t('empty')}</p>
        <Link
          href={`/${locale}/community/bons-plans/nouveau`}
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
        <li key={item.id}>
          <FeedCard item={item} locale={locale} />
        </li>
      ))}
    </ul>
  );
}
