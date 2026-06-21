// Story 3.2 (AC3/AC4/AC7/AC8) — entrée Guide (deep link, cible canonique Epic 6).
// RSC. `not-found` → notFound() (404, pas de fuite cross-tenant). Corps rendu via
// le renderer Markdown partagé (XSS-safe, skipHtml). Fil d'Ariane « Guide › thème ».

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';
import { MarkdownRender } from '@/components/content/markdown-render';
import { ReportButton } from '@/components/content/report-button';
import { canonicalMetadata } from '@/lib/share/metadata';
import { canonicalUrl } from '@/lib/share/canonical';
import { ShareButton } from '@/components/content/share-button';
import { fetchGuideEntryBySlug } from './data';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; slug: string }> };

// Aligné sur le CHECK DB `guide_entries_slug_format` (review 3.1 P4).
// Court-circuit avant le fetch Supabase pour éviter un round-trip sur slugs
// malformés (anti-DoS / Unicode soup / path traversal `..`).
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

function isValidLocale(locale: string): locale is Locale {
  return (routing.locales as readonly string[]).includes(locale);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isValidLocale(locale) || !SLUG_RE.test(slug ?? '')) return {};
  const result = await fetchGuideEntryBySlug(locale, slug);
  if (result.kind !== 'found') return { robots: { index: false, follow: false } };
  return canonicalMetadata('guide_entry', slug, { title: result.entry.title });
}

export default async function GuideEntryPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) notFound();
  if (!SLUG_RE.test(slug ?? '')) notFound();
  setRequestLocale(locale);

  const result = await fetchGuideEntryBySlug(locale, slug);
  if (result.kind === 'not-found') notFound();
  const { entry } = result;

  const t = await getTranslations('community.guide');

  return (
    <article className="flex flex-col gap-5">
      <Link
        href={`/${locale}/community/guide`}
        aria-label={t('entry.back')}
        className="inline-flex min-h-touch min-w-touch w-fit items-center justify-center rounded-[14px] text-neutral-700 hover:bg-bg-soft"
      >
        <ArrowLeft className="size-5" aria-hidden />
      </Link>

      <nav
        aria-label={t('breadcrumb')}
        className="flex items-center gap-1 text-sm text-neutral-500"
      >
        <Link href={`/${locale}/community/guide`} className="hover:text-neutral-700">
          {t('breadcrumb')}
        </Link>
        <ChevronRight className="size-4" aria-hidden />
        <span className="text-neutral-700">{t(`themes.${entry.themeKey}`)}</span>
      </nav>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 break-words">
          {entry.title}
        </h1>
        {entry.untranslated && (
          <span className="w-fit rounded-sm bg-bg-soft px-2 py-0.5 text-xs font-medium text-neutral-500">
            {t('notTranslatedBadge')}
          </span>
        )}
      </header>

      <MarkdownRender source={entry.body} />

      <ShareButton
        kind="guide_entry"
        id={entry.id}
        url={canonicalUrl('guide_entry', slug)}
        title={entry.title}
      />

      <div className="border-t border-neutral-100 pt-4">
        <ReportButton targetType="guide_entry" targetId={entry.id} />
      </div>
    </article>
  );
}
