import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';

// Page authentifiée : pas de SSG. Home placeholder minimal (résout le 404
// /community vers lequel resolveRedirect 1.6 envoie un résident accepté). Les 3
// tuiles Annuaire/Alertes/Guide sont livrées aux epics 2-4.
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'community.home' });
  return { title: t('title') };
}

export default async function CommunityHomePage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('community.home');

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
      <p className="text-base text-neutral-700">{t('body')}</p>
    </section>
  );
}
