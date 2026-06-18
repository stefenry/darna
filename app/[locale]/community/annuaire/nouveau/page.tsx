// Story 2.4 — page de création d'artisan. RSC ; auth via community/layout.
// Charge les compétences (tags) pour le multi-select ; le formulaire est client.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';
import { fetchTags } from '../data';
import { CreateArtisanForm } from './_components/create-artisan-form';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

function assertLocale(locale: string): asserts locale is Locale {
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!(routing.locales as readonly string[]).includes(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'community.artisanCreate' });
  return { title: t('title') };
}

export default async function NouveauArtisanPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('community.artisanCreate');

  // Review 2026-06-18 P14 — fallback `tags=[]` si fetch échoue (RLS/réseau).
  // Le form rendra une note explicative plutôt que de crash la page.
  let tags: Awaited<ReturnType<typeof fetchTags>> = [];
  try {
    tags = await fetchTags(locale);
  } catch (cause) {
    log({
      level: 'error',
      event: 'artisan.create_fetch_tags_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { error: cause instanceof Error ? cause.message : 'unknown' },
    });
  }

  return (
    <section className="flex flex-col gap-6 pb-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>
      {tags.length === 0 ? (
        <p role="alert" className="rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-danger">
          {t('tagsUnavailable')}
        </p>
      ) : (
        <CreateArtisanForm locale={locale} tags={tags} />
      )}
    </section>
  );
}
