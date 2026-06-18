import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import { DeleteAccountForm } from '../_components/delete-account-form';

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
  const t = await getTranslations({ locale, namespace: 'profil.delete' });
  return { title: t('pageTitle') };
}

export default async function ProfilDeletePage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('profil.delete');

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
        {t('pageTitle')}
      </h1>

      <div className="flex flex-col gap-3 rounded-[14px] border border-danger/40 bg-danger/5 p-5">
        <h2 className="text-base font-semibold text-danger">{t('dangerTitle')}</h2>
        <p className="text-sm text-neutral-700">{t('cascadeBody')}</p>
        <DeleteAccountForm locale={locale} />
      </div>

      <Link
        href={`/${locale}/community/profil`}
        className="text-sm text-neutral-500 underline-offset-4 hover:underline"
      >
        {t('cancelCta')}
      </Link>
    </section>
  );
}
