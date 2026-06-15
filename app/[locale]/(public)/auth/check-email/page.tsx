import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageContainer } from '@/components/layout/page-container';
import { routing } from '@/lib/i18n/routing';

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
  const t = await getTranslations({ locale, namespace: 'auth.checkEmail' });
  return { title: t('pageTitle') };
}

export default async function CheckEmailPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('auth.checkEmail');

  return (
    <PageContainer className="py-10" as="main">
      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
            {t('pageTitle')}
          </h1>
          <p className="text-base text-neutral-700">{t('body')}</p>
        </header>

        <Link
          href={`/${locale}/auth/login`}
          className="inline-flex min-h-touch items-center justify-center self-start rounded-[14px] bg-bg-soft px-6 text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-300"
        >
          {t('retryCta')}
        </Link>
      </section>
    </PageContainer>
  );
}
