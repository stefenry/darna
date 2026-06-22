// Story 2.2 (AC1-AC7) — page annuaire. Server Component par défaut ; auth +
// PageContainer fournis par community/layout.tsx (requireResident). Recherche +
// filtres pilotés par l'URL (re-render RSC à chaque param). Lecture RLS-scopée.
//
// Review 2026-06-17 (F6) — Suspense par section (filtres / résultats) pour le
// streaming RSC : les filtres deviennent interactifs avant la fin du fetch des
// artisans, et l'erreur d'une section ne bloque pas l'autre.

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import { ACTIVE_LOCALES, type Locale } from '@/lib/i18n/config';
import { createClient } from '@/lib/supabase/server';
import { log } from '@/lib/logger';
import { parseAnnuaireParams, type AnnuaireSearchParams } from './schema';
import { fetchAnnuaire, fetchTags, PAGE_SIZE } from './data';
import { SearchInput } from './_components/search-input';
import { FiltersBar } from './_components/filters-bar';
import { ArtisanCard } from './_components/artisan-card';
import { EmptyState } from './_components/empty-state';
import { OfflineBanner } from './_components/offline-banner';
import { CacheStamp } from './_components/cache-stamp';
import { ResultsHeader } from './_components/results-header';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function assertLocale(locale: string): asserts locale is Locale {
  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'community.annuaire' });
  return { title: t('title') };
}

export default async function AnnuairePage({ params, searchParams }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('community.annuaire');
  const sp = parseAnnuaireParams(await searchParams);

  // Récupère residence_id de la session pour partitionner le cache SW
  // (D1). Si pas de session valide la page ne devrait pas être atteinte
  // (proxy + layout gate) — fallback null silencieux pour ne pas casser le RSC.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;
  let residenceId: string | null = null;
  if (userId) {
    const { data: profile } = await supabase
      .from('users')
      .select('residence_id')
      .eq('id', userId)
      .maybeSingle();
    residenceId = profile?.residence_id ?? null;
  }

  const safeLocale = (ACTIVE_LOCALES as readonly string[]).includes(locale)
    ? (locale as Locale)
    : ('fr' as Locale);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
              {t('title')}
            </h1>
            <p className="text-base text-neutral-700">{t('intro')}</p>
          </div>
          <a
            href={`/${safeLocale}/community/annuaire/nouveau`}
            className="inline-flex min-h-touch shrink-0 items-center justify-center gap-1 rounded-[14px] bg-accent-500 px-4 text-sm font-semibold text-white shadow-sm motion-safe:transition-colors hover:bg-accent-600"
          >
            <span aria-hidden>+</span>
            <span>{t('addCta')}</span>
          </a>
        </div>
      </header>

      {residenceId && <CacheStamp residenceId={residenceId} locale={safeLocale} />}
      <OfflineBanner />

      <Suspense fallback={<FiltersSkeleton />}>
        <FiltersSection locale={safeLocale} />
      </Suspense>

      <Suspense fallback={<ResultsSkeleton />}>
        <ResultsSection locale={safeLocale} params={sp} />
      </Suspense>
    </section>
  );
}

async function FiltersSection({ locale }: { locale: Locale }) {
  let tags: { key: string; label: string }[] = [];
  try {
    tags = await fetchTags(locale);
  } catch (error) {
    log({
      level: 'error',
      event: 'annuaire.tags_fetch_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: (error as { code?: string })?.code ?? 'unknown' },
    });
  }
  return (
    <div className="flex flex-col gap-4">
      <SearchInput />
      <FiltersBar tags={tags} />
    </div>
  );
}

async function ResultsSection({
  locale,
  params,
}: {
  locale: Locale;
  params: AnnuaireSearchParams;
}) {
  const tErr = await getTranslations('errors.annuaire');
  try {
    const { artisans, hasMore } = await fetchAnnuaire(locale, params);
    if (artisans.length === 0) {
      return (
        <>
          <ResultsHeader count={0} hasMore={false} />
          <EmptyState locale={locale} />
        </>
      );
    }
    return (
      <>
        <ResultsHeader count={artisans.length} hasMore={hasMore} />
        <ul className="grid gap-3">
          {artisans.map((artisan) => (
            <li key={artisan.slug}>
              <ArtisanCard locale={locale} artisan={artisan} />
            </li>
          ))}
        </ul>
      </>
    );
  } catch (error) {
    log({
      level: 'error',
      event: 'annuaire.fetch_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: (error as { code?: string })?.code ?? 'unknown' },
    });
    return (
      <p role="alert" className="rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-danger">
        {tErr('fetch_failed')}
      </p>
    );
  }
}

function FiltersSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-12 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-8 w-20 shrink-0 motion-safe:animate-pulse rounded-full bg-bg-soft"
          />
        ))}
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-5 w-32 motion-safe:animate-pulse rounded bg-bg-soft" />
      {Array.from({ length: PAGE_SIZE / 4 }, (_, i) => (
        <div key={i} className="h-36 motion-safe:animate-pulse rounded-[14px] bg-bg-soft" />
      ))}
    </div>
  );
}
