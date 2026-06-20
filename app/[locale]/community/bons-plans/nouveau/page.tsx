import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { routing } from '@/lib/i18n/routing';
import { TIP_MAX_EXPIRY_DAYS } from '@/lib/content/ephemeral';
import { TipPublishForm } from './_components/tip-publish-form';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
}

function isoDate(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'community.bonsPlans' });
  return { title: t('new.title') };
}

export default async function NewTipPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('community.bonsPlans');

  return (
    <section className="flex flex-col gap-5">
      <Link
        href={`/${locale}/community/alertes`}
        aria-label={t('new.back')}
        className="inline-flex min-h-touch min-w-touch w-fit items-center justify-center rounded-[14px] text-neutral-700 hover:bg-bg-soft"
      >
        <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{t('new.title')}</h1>
        <p className="text-base text-neutral-700">{t('new.intro')}</p>
      </header>

      <TipPublishForm locale={locale} minDate={isoDate(1)} maxDate={isoDate(TIP_MAX_EXPIRY_DAYS)} />
    </section>
  );
}
