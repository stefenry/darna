// Story 8.4 (FR54) — page co_mod « Export journal de modération » (audit CNDP).
// Garde 403 héritée du comod/layout (requireComod). Sélecteur de période + format.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';
import { ModerationExportForm } from './_components/export-form';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ locale: string }> };

function assertLocale(locale: string): asserts locale is Locale {
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'comod.transparence' });
  return { title: t('pageTitle'), robots: { index: false, follow: false } };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);
  const t = await getTranslations('comod.transparence');

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
          {t('pageTitle')}
        </h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>
      <ModerationExportForm locale={locale === 'ar' ? 'ar' : 'fr'} />
    </section>
  );
}
