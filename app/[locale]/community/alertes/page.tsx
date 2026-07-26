import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Bell } from 'lucide-react';
import { assertLocale } from '@/lib/i18n/assert-locale';
import type { Locale } from '@/lib/i18n/config';
import { EphemeralFeedPage } from '@/app/[locale]/community/_components/ephemeral-feed-page';
import { fetchAlerts } from './data';

// Page authentifiée (RLS-scopée), feed temps réel → pas de SSG.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

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
    <EphemeralFeedPage
      locale={locale as Locale}
      title={t('title')}
      intro={t('intro')}
      publish={{ href: `/${locale}/community/alertes/nouveau`, label: t('publishAlert') }}
      empty={{ text: t('empty'), cta: t('emptyCta'), Icon: Bell }}
      load={() => fetchAlerts(locale as Locale)}
      logEvent="alerts.feed_fetch_failed"
    />
  );
}
