// Story 2.7 — page d'édition de fiche (« Modifier ma fiche »). RSC, force-dynamic.
// Garde résident via community/layout ; ownership via fetchArtisanForEdit (null si
// pas le contributeur → notFound, pas de side-channel). Danger Zone retrait incluse.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';
import { fetchArtisanForEdit } from '../data';
import { fetchTags } from '@/app/[locale]/community/annuaire/data';
import { EditArtisanForm } from './_components/edit-artisan-form';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; slug: string }> };

function isValidLocale(locale: string): locale is Locale {
  return (routing.locales as readonly string[]).includes(locale);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'community.artisanEdit' });
  return { title: t('title'), robots: { index: false } };
}

export default async function EditArtisanPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) notFound();
  if (!slug?.trim()) notFound();
  setRequestLocale(locale);

  const artisan = await fetchArtisanForEdit(slug);
  if (!artisan) notFound();

  const [tags, t] = await Promise.all([
    fetchTags(locale).catch(() => [] as { key: string; label: string }[]),
    getTranslations({ locale, namespace: 'community.artisanEdit' }),
  ]);

  return (
    <section className="flex flex-col gap-6 pb-32">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
      </header>
      <EditArtisanForm locale={locale} slug={slug} tags={tags} artisan={artisan} />
    </section>
  );
}
