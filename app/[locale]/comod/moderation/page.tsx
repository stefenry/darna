import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageContainer } from '@/components/layout/page-container';
import { routing } from '@/lib/i18n/routing';
import { fetchOpenReports } from './data';

// Story 5.3 (AR37) — file des signalements ouverts, polling-à-l'ouverture (pas de
// cache SSG). router.refresh() post-décision re-rend cette page.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'comod.moderation' });
  return { title: t('pageTitle') };
}

function ageLabel(createdAt: string, t: (k: string, v?: Record<string, number>) => string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return t('age.lessThanHour');
  if (hours < 24) return t('age.hours', { value: hours });
  return t('age.days', { value: Math.floor(hours / 24) });
}

export default async function ComodModerationPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('comod.moderation');
  const items = await fetchOpenReports(locale as 'fr' | 'ar');

  return (
    <PageContainer className="py-10" as="main">
      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
            {t('pageTitle')}
          </h1>
          <p className="text-base text-neutral-700">{t('intro')}</p>
        </header>

        {items.length === 0 ? (
          <p className="rounded-[14px] bg-bg-soft px-4 py-6 text-center text-base text-neutral-700">
            {t('emptyState')}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/${locale}/comod/moderation/${item.id}`}
                  className="flex flex-col gap-2 rounded-[14px] bg-bg-card p-4 shadow-xs hover:bg-bg-soft"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-sm bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                      {t(`reasons.${item.reason}`)}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {t(`targets.${item.targetType}`)}
                    </span>
                    {item.slaBreached && (
                      <span className="inline-flex items-center rounded-sm bg-danger px-2 py-0.5 text-xs font-semibold text-white">
                        {t('slaBreached')}
                      </span>
                    )}
                  </div>
                  <p className="text-base font-medium text-neutral-900">{item.snippet}</p>
                  {item.note && (
                    <p className="text-sm text-neutral-600">
                      {t('reporterNote')} : {item.note}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <span>{item.reporterPseudonym}</span>
                    <span aria-hidden>·</span>
                    <span>{ageLabel(item.createdAt, t)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
