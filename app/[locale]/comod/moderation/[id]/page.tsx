import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { routing } from '@/lib/i18n/routing';
import { fetchReportDetail } from '../data';
import { ModerationActions } from '../_components/moderation-actions';
import { LegalResolution } from '../_components/legal-resolution';

// Story 5.3 — détail d'un signalement : contexte complet + actions retirer/conserver.
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ locale: string; id: string }> };

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'comod.moderation' });
  return { title: t('detail.title') };
}

export default async function ReportDetailPage({ params }: Props) {
  const { locale, id } = await params;
  assertLocale(locale);
  if (!UUID_RE.test(id ?? '')) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('comod.moderation');
  const report = await fetchReportDetail(locale as 'fr' | 'ar', id);
  if (!report) notFound();

  const pendingLegal = report.state === 'closed_kept_pending_legal';
  const resolved = report.state !== 'open' && !pendingLegal;

  return (
    <PageContainer className="py-10" as="main">
      <article className="flex flex-col gap-5">
        <Link
          href={`/${locale}/comod/moderation`}
          aria-label={t('detail.back')}
          className="inline-flex min-h-touch min-w-touch w-fit items-center justify-center rounded-[14px] text-neutral-700 hover:bg-bg-soft"
        >
          <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
        </Link>

        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-sm bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
              {t(`reasons.${report.reason}`)}
            </span>
            <span className="text-xs text-neutral-500">{t(`targets.${report.targetType}`)}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            {t('detail.title')}
          </h1>
          <p className="text-sm text-neutral-500">
            {report.reporterPseudonym}
            {report.note ? ` · ${t('reporterNote')} : ${report.note}` : ''}
          </p>
        </header>

        {/* Contenu cible (contexte complet). */}
        <section className="flex flex-col gap-2 rounded-[14px] bg-bg-soft p-4">
          <h2 className="text-sm font-semibold text-neutral-700">{t('detail.targetHeading')}</h2>
          {report.target.exists ? (
            <>
              {report.target.removed && (
                <span className="w-fit rounded-sm bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600">
                  {t('detail.alreadyRemoved')}
                </span>
              )}
              <p className="text-base font-medium text-neutral-900">{report.target.title}</p>
              {report.target.body && (
                <p className="whitespace-pre-wrap text-base text-neutral-700">
                  {report.target.body}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-500">{t('detail.targetMissing')}</p>
          )}
        </section>

        {/* Actions antérieures sur cette cible. */}
        {report.priorActions.length > 0 && (
          <section className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-neutral-700">{t('detail.priorHeading')}</h2>
            <ul className="flex flex-col gap-1 text-sm text-neutral-600">
              {report.priorActions.map((p, i) => (
                <li key={`${p.action}-${i}`}>
                  {t(`events.${p.action}`)}
                  {p.reasonCode ? ` — ${p.reasonCode}` : ''}
                </li>
              ))}
            </ul>
          </section>
        )}

        {pendingLegal ? (
          <LegalResolution reportId={report.id} locale={locale} />
        ) : resolved ? (
          <section className="rounded-[14px] border border-neutral-200 p-4">
            <p className="text-sm font-medium text-neutral-700">
              {report.state === 'closed_removed' || report.state === 'closed_removed_legal_advised'
                ? t('detail.resolvedRemoved')
                : t('detail.resolvedKept')}
            </p>
            {report.resolutionMotive && (
              <p className="mt-1 text-sm text-neutral-500">{report.resolutionMotive}</p>
            )}
          </section>
        ) : (
          <ModerationActions reportId={report.id} locale={locale} />
        )}
      </article>
    </PageContainer>
  );
}
