// Story 3.4 (AC2/AC4/AC5) — page Pack accueil. Segment STATIQUE sœur de
// `guide/[slug]` (Next.js route le statique en priorité → ne jamais créer
// d'entrée Guide de slug `pack-accueil`). RSC, force-dynamic. Lit `pack_entries`
// (RLS-scopée) ; marque l'onboarding complété au mount (MarkOnboardingComplete).

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';
import { log } from '@/lib/logger';
import { fetchPackEntries } from './data';
import { PackSection } from './_components/pack-section';
import { MarkOnboardingComplete } from './_components/mark-onboarding-complete';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

function assertLocale(locale: string): asserts locale is Locale {
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'community.packAccueil' });
  return { title: t('title') };
}

export default async function PackAccueilPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('community.packAccueil');

  let sections: Awaited<ReturnType<typeof fetchPackEntries>> = [];
  try {
    sections = await fetchPackEntries(locale);
  } catch (error) {
    log({
      level: 'error',
      event: 'pack.fetch_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: (error as { code?: string })?.code ?? 'unknown' },
    });
  }

  return (
    <article className="flex flex-col gap-5">
      <MarkOnboardingComplete />

      <Link
        href={`/${locale}/community`}
        aria-label={t('back')}
        className="inline-flex min-h-touch min-w-touch w-fit items-center justify-center rounded-[14px] text-neutral-700 hover:bg-bg-soft"
      >
        <ArrowLeft className="size-5" aria-hidden />
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>

      {sections.length === 0 ? (
        <p className="rounded-[14px] bg-bg-soft px-4 py-6 text-center text-base text-neutral-600">
          {t('empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sections.map((section, i) => (
            <PackSection key={section.sectionKey} section={section} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </article>
  );
}
