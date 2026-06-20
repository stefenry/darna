import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';
import { timeRemaining } from '@/lib/content/ephemeral';
import { canonicalMetadata } from '@/lib/share/metadata';
import { fetchAlertBySlug } from '../data';
import { RetireOwnButton } from '../_components/retire-own-button';
import { ReportButton } from '@/components/content/report-button';

export const dynamic = 'force-dynamic';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

type Props = { params: Promise<{ locale: string; slug: string }> };

function isLocale(locale: string): locale is Locale {
  return (routing.locales as readonly string[]).includes(locale);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !SLUG_RE.test(slug ?? '')) return {};
  const res = await fetchAlertBySlug(locale, slug);
  if (res.kind !== 'found') return { robots: { index: false, follow: false } };
  return canonicalMetadata('alert', slug, { title: res.entry.title });
}

function remainingLabel(
  t: (k: string, v?: Record<string, number>) => string,
  expiresAt: string,
): string {
  const tr = timeRemaining(expiresAt, Date.now());
  switch (tr.state) {
    case 'days':
      return t('remaining.days', { value: tr.value });
    case 'hours':
      return t('remaining.hours', { value: tr.value });
    case 'soon':
      return t('remaining.soon');
    default:
      return t('remaining.expired');
  }
}

export default async function AlertDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  if (!SLUG_RE.test(slug ?? '')) notFound();
  setRequestLocale(locale);

  const res = await fetchAlertBySlug(locale, slug);
  if (res.kind === 'not-found') notFound();
  const { entry } = res;
  const t = await getTranslations('community.alertes');

  return (
    <article className="flex flex-col gap-5">
      <Link
        href={`/${locale}/community/alertes`}
        aria-label={t('detail.back')}
        className="inline-flex min-h-touch min-w-touch w-fit items-center justify-center rounded-[14px] text-neutral-700 hover:bg-bg-soft"
      >
        <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
      </Link>

      <header className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-1 rounded-sm bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
          <span aria-hidden>🚨</span>
          {t('badge.alert')}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 break-words">
          {entry.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
          <span>{remainingLabel(t, entry.expiresAt)}</span>
          <span aria-hidden>·</span>
          <span>{t('detail.author')}</span>
          {entry.untranslated && (
            <span className="rounded-sm bg-bg-soft px-2 py-0.5 text-xs font-medium text-neutral-500">
              {t('notTranslatedBadge')}
            </span>
          )}
        </div>
      </header>

      <p className="whitespace-pre-wrap text-base leading-relaxed text-neutral-800">{entry.body}</p>

      {entry.isOwn ? (
        <div className="border-t border-neutral-200 pt-4">
          <RetireOwnButton kind="alert" id={entry.id} locale={locale} />
        </div>
      ) : (
        <div className="border-t border-neutral-200 pt-4">
          <ReportButton targetType="alert" targetId={entry.id} />
        </div>
      )}
    </article>
  );
}
