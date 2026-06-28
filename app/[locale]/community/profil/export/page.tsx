// Story 8.3 (FR53, RGPD art. 20) — page « Exporter mes données ». Explique le
// périmètre exporté + un unique CTA. L'export est généré server-side (Server
// Action), uploadé en Storage (URL signée 24h) et notifié par e-mail.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { routing } from '@/lib/i18n/routing';
import { requireResident } from '@/lib/auth/require-resident';
import { ExportButton } from './_components/export-button';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'profil.export' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

const ITEM_KEYS = [
  'profile',
  'artisans',
  'ratings',
  'comments',
  'alerts',
  'tips',
  'suggestions',
  'reactions',
  'reports',
  'notifPrefs',
] as const;

export default async function ExportPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const guard = await requireResident();
  if (!guard.ok) redirect(`/${locale}/auth/login`);

  const t = await getTranslations('profil.export');

  return (
    <section className="flex flex-col gap-6">
      <Link
        href={`/${locale}/community/profil/parametres`}
        aria-label={t('back')}
        className="inline-flex min-h-touch min-w-touch w-fit items-center justify-center rounded-[14px] text-neutral-700 hover:bg-bg-soft"
      >
        <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>

      <section className="flex flex-col gap-3 rounded-[14px] bg-bg-soft p-5">
        <h2 className="text-base font-medium text-neutral-900">{t('itemsTitle')}</h2>
        <ul className="list-disc space-y-1 ps-5 text-base text-neutral-700">
          {ITEM_KEYS.map((k) => (
            <li key={k}>{t(`items.${k}`)}</li>
          ))}
        </ul>
      </section>

      <ExportButton locale={locale === 'ar' ? 'ar' : 'fr'} />
    </section>
  );
}
