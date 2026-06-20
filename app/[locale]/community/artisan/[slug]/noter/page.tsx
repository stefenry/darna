// Story 2.6 — page dédiée de notation (« Noter {artisan} »). RSC ; auth via
// community/layout. Résout l'artisan + la note existante (pré-remplissage) + la
// visibilité par défaut (profil). Le form POSTe vers le Server Action submitRating.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';
import { fetchArtisanBySlug, fetchMyRating, fetchMyDefaultVisibility } from '../data';
import { RateForm } from './_components/rate-form';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; slug: string }> };

function isValidLocale(locale: string): locale is Locale {
  return (routing.locales as readonly string[]).includes(locale);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isValidLocale(locale) || !slug?.trim()) return {};
  const result = await fetchArtisanBySlug(locale, slug);
  const t = await getTranslations({ locale, namespace: 'community.artisanRate' });
  return result.kind === 'found'
    ? { title: t('pageTitle', { name: result.artisan.displayName }), robots: { index: false } }
    : {};
}

export default async function RateArtisanPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) notFound();
  if (!slug?.trim()) notFound();
  setRequestLocale(locale);

  const result = await fetchArtisanBySlug(locale, slug);
  if (result.kind === 'not-found') notFound();
  const artisan = result.artisan;

  const [existingRating, defaultVisibility, t] = await Promise.all([
    fetchMyRating(artisan.id),
    fetchMyDefaultVisibility(),
    getTranslations({ locale, namespace: 'community.artisanRate' }),
  ]);

  return (
    <section className="flex flex-col gap-6 pb-32">
      <header className="flex flex-col gap-1">
        <Link
          href={`/${locale}/community/artisan/${slug}`}
          className="text-sm font-medium text-accent-600 underline-offset-4 hover:underline"
        >
          {t('back')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          {t('pageTitle', { name: artisan.displayName })}
        </h1>
      </header>
      <RateForm
        locale={locale}
        slug={slug}
        existingRating={existingRating}
        defaultVisibility={existingRating?.visibility ?? defaultVisibility}
      />
    </section>
  );
}
