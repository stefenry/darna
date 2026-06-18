// Story 2.3 — fiche artisan. RSC ; auth + PageContainer via community/layout.
// Deux issues : `found` (rendu) ou `not-found` (404 via notFound()) — la
// distinction « gone » est différée à Story 6.1 (cf. review 2026-06-17 P21).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';
import { fetchArtisanBySlug, fetchArtisanComments } from './data';
import { ArtisanHeader } from './_components/artisan-header';
import { RatingGaugesFull } from './_components/rating-gauges-full';
import { CommentsList } from './_components/comments-list';
import { CallButton } from './_components/call-button';
import { ContributorPanel } from './_components/contributor-panel';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; slug: string }> };

function isValidLocale(locale: string): locale is Locale {
  return (routing.locales as readonly string[]).includes(locale);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isValidLocale(locale) || !slug?.trim()) return {};
  const result = await fetchArtisanBySlug(locale, slug);
  return result.kind === 'found' ? { title: result.artisan.displayName } : {};
}

export default async function ArtisanPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) notFound();
  if (!slug?.trim()) notFound();
  setRequestLocale(locale);

  const result = await fetchArtisanBySlug(locale, slug);
  if (result.kind === 'not-found') notFound();

  const artisan = result.artisan;
  const comments = await fetchArtisanComments(artisan.id);

  return (
    <article className="flex flex-col gap-6 pb-32">
      <ArtisanHeader locale={locale} artisan={artisan} />
      {artisan.isOwner && <ContributorPanel />}
      <RatingGaugesFull axes={artisan.axes} />
      <CommentsList locale={locale} comments={comments} />
      <CallButton name={artisan.displayName} phoneE164={artisan.phoneE164} />
    </article>
  );
}
