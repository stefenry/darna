import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Gift } from 'lucide-react';
import { assertLocale } from '@/lib/i18n/assert-locale';
import type { Locale } from '@/lib/i18n/config';
import { EphemeralFeedPage } from '@/app/[locale]/community/_components/ephemeral-feed-page';
import { fetchTips } from './data';

// Liste des bons plans — jumelle de la page alertes depuis la séparation du flux
// unifié (2026-07-26). Contenu éphémère et RLS-scopé → pas de SSG.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

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
    <EphemeralFeedPage
      locale={locale as Locale}
      title={t('title')}
      intro={t('intro')}
      publish={{ href: `/${locale}/community/bons-plans/nouveau`, label: t('publish') }}
      empty={{ text: t('empty'), cta: t('emptyCta'), Icon: Gift }}
      load={() => fetchTips(locale as Locale)}
      logEvent="tips.feed_fetch_failed"
    />
  );
}
