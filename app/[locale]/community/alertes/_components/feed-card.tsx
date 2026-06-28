import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';
import type { Locale } from '@/lib/i18n/config';
import { timeRemaining } from '@/lib/content/ephemeral';
import type { FeedItem } from '../data';

// Story 4.4 — carte de feed (server component). Badge de type (alerte 🚨 / bon
// plan 🎁), titre localisé, temps restant ("expire dans 18h"), tap-to-detail.

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

export async function FeedCard({ item, locale }: { item: FeedItem; locale: Locale }) {
  const t = await getTranslations('community.alertes');
  const tCat = await getTranslations('community.bonsPlans');
  const isAlert = item.kind === 'alert';
  const href = isAlert
    ? `/${locale}/community/alertes/${item.slug}`
    : `/${locale}/community/bons-plans/${item.slug}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[14px] bg-white p-4 shadow-xs hover:bg-bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 motion-safe:transition-colors"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold ${
              isAlert ? 'bg-danger/10 text-danger' : 'bg-accent-100 text-accent-700'
            }`}
          >
            <span aria-hidden>{isAlert ? '🚨' : '🎁'}</span>
            {isAlert ? t('badge.alert') : t('badge.tip')}
          </span>
          {item.category && (
            <span className="rounded-sm bg-bg-soft px-2 py-0.5 text-xs font-medium text-neutral-600">
              {tCat(`categories.${item.category}`)}
            </span>
          )}
          {item.untranslated && (
            <span className="rounded-sm bg-bg-soft px-2 py-0.5 text-xs font-medium text-neutral-500">
              {t('notTranslatedBadge')}
            </span>
          )}
        </div>
        <span className="truncate text-base font-semibold text-neutral-900">{item.title}</span>
        <span className="text-sm text-neutral-500">
          {remainingLabel(t, item.expiresAt)}
          {!isAlert && (
            <>
              {' · '}
              {tCat('author.sharedBy', {
                author: item.authorName
                  ? item.authorName
                  : item.authorPseudonymSuffix
                    ? tCat('author.pseudonym', { suffix: item.authorPseudonymSuffix })
                    : tCat('author.deleted'),
              })}
            </>
          )}
        </span>
      </div>
      <ChevronRight className="size-5 shrink-0 text-neutral-400 rtl:rotate-180" aria-hidden />
    </Link>
  );
}
