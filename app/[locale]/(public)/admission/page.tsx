// NOTE — route publique (visiteur anonyme déposant sa demande). Variance avec
// architecture.md:808 qui plaçait admission/ sous (community)/ ; voir story 1.7
// AC4 + Project Structure Notes pour la justification (proxy.ts ne protège pas
// /admission, et resolveRedirect renvoie ici les utilisateurs sans record).
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageContainer } from '@/components/layout/page-container';
import { routing } from '@/lib/i18n/routing';
import { AdmissionForm } from './admission-form';

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
  const t = await getTranslations({ locale, namespace: 'admission.form' });
  return { title: t('pageTitle') };
}

export default async function AdmissionPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('admission.form');

  return (
    <PageContainer className="py-10" as="main">
      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
            {t('pageTitle')}
          </h1>
          <p className="text-base text-neutral-700">{t('intro')}</p>
        </header>

        <AdmissionForm locale={locale} cguHref={`/${locale}/legal/cgu`} />

        <p className="text-sm text-neutral-500">
          {t('alreadyAccessHint')}{' '}
          <Link
            href={`/${locale}/auth/login`}
            className="font-medium text-accent-500 underline-offset-4 hover:underline"
          >
            {t('alreadyAccessCta')}
          </Link>
        </p>
      </section>
    </PageContainer>
  );
}
