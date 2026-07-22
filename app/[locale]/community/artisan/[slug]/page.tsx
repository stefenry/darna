// Story 2.3 — fiche artisan. RSC ; auth + PageContainer via community/layout.
// Deux issues : `found` (rendu) ou `not-found` (404 via notFound()) — la
// distinction « gone » est différée à Story 6.1 (cf. review 2026-06-17 P21).

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';
import { canonicalMetadata } from '@/lib/share/metadata';
import { canonicalUrl } from '@/lib/share/canonical';
import { ShareButton } from '@/components/content/share-button';
import { fetchReactionStates } from '../../_data/reactions';
import {
  fetchArtisanBySlug,
  fetchArtisanComments,
  fetchMyRating,
  fetchArtisanResponses,
} from './data';
import { ArtisanHeader } from './_components/artisan-header';
import { RatingGaugesFull } from './_components/rating-gauges-full';
import { CommentsList } from './_components/comments-list';
import { ArtisanResponses } from './_components/artisan-responses';
import { CallButton } from './_components/call-button';
import { ContributorPanel } from './_components/contributor-panel';
import { ComodPublishButton } from './_components/comod-publish-button';
import { ReportButton } from '@/components/content/report-button';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; slug: string }> };

function isValidLocale(locale: string): locale is Locale {
  return (routing.locales as readonly string[]).includes(locale);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isValidLocale(locale) || !slug?.trim()) return {};
  const result = await fetchArtisanBySlug(locale, slug);
  if (result.kind !== 'found') return { robots: { index: false, follow: false } };
  const desc = result.artisan.tags.map((t) => t.label).join(' · ') || undefined;
  return canonicalMetadata('artisan', slug, {
    title: result.artisan.displayName,
    description: desc,
  });
}

export default async function ArtisanPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) notFound();
  if (!slug?.trim()) notFound();
  setRequestLocale(locale);

  const result = await fetchArtisanBySlug(locale, slug);
  if (result.kind === 'not-found') notFound();

  const artisan = result.artisan;
  const [comments, myRating, responses, tc] = await Promise.all([
    fetchArtisanComments(artisan.id),
    fetchMyRating(artisan.id),
    fetchArtisanResponses(artisan.id),
    getTranslations({ locale, namespace: 'community.artisan.comments' }),
  ]);
  const commentReactions = await fetchReactionStates(
    'rating',
    comments.map((c) => c.id),
  );

  // Bêta : pas de SMS provider opérationnel, le co_mod peut publier sans
  // attendre le consent. On lit le rôle depuis app_metadata (JWT).
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const isComod = authData.user?.app_metadata?.role === 'co_mod';
  const showComodPublish = isComod && artisan.state === 'pending_consent';

  return (
    <article className="flex flex-col gap-6 pb-32">
      <ArtisanHeader locale={locale} artisan={artisan} />
      {showComodPublish && (
        <ComodPublishButton artisanId={artisan.id} locale={locale as 'fr' | 'ar'} />
      )}
      {artisan.isOwner && <ContributorPanel locale={locale} slug={slug} />}
      <RatingGaugesFull axes={artisan.axes} />
      {/* Review 2.6 P6 — hide CTA "Noter" si l'utilisateur est le créateur
          (self-rating biaiserait les agrégats ; gate déjà côté action). */}
      {!artisan.isOwner && (
        <Link
          href={`/${locale}/community/artisan/${slug}/noter`}
          className="inline-flex min-h-touch w-fit items-center justify-center rounded-[14px] bg-bg-soft px-5 text-sm font-semibold text-accent-600 hover:bg-neutral-300"
        >
          {myRating ? tc('rateUpdate') : tc('rate')}
        </Link>
      )}
      <CommentsList locale={locale} comments={comments} reactions={commentReactions} />
      <ArtisanResponses responses={responses} artisanName={artisan.displayName} locale={locale} />
      <ShareButton
        kind="artisan"
        id={artisan.id}
        url={canonicalUrl('artisan', artisan.slug)}
        title={artisan.displayName}
        text={artisan.tags.map((tg) => tg.label).join(' · ')}
      />
      {/* Feedback bêta 2026-07-22 — « Signaler » AVANT le CTA sticky : placé
          après, il tombait dans la zone morte sous le bouton flottant (les
          derniers px de scroll) et restait introuvable sur téléphone. */}
      {!artisan.isOwner && (
        <div className="border-t border-neutral-100 pt-4">
          <ReportButton targetType="artisan" targetId={artisan.id} />
        </div>
      )}
      <CallButton name={artisan.displayName} phoneE164={artisan.phoneE164} />
    </article>
  );
}
