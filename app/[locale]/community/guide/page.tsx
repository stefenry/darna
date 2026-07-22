// Story 3.2 (AC1/AC2/AC7) — page Guide. RSC ; auth + PageContainer via
// community/layout (requireResident). `?q=` présent → branche recherche FTS
// (RPC security-invoker), sinon liste groupée par thème (RLS-scopée résidence).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';
import { log } from '@/lib/logger';
import { fetchGuideEntries, searchGuide } from './data';
import { GuideSearch } from './_components/guide-search';
import { GuideThemeSection } from './_components/guide-theme-section';
import { GuideSearchResults } from './_components/guide-search-results';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function assertLocale(locale: string): asserts locale is Locale {
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'community.guide' });
  return { title: t('title') };
}

export default async function GuidePage({ params, searchParams }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('community.guide');
  const tErr = await getTranslations('errors.guide');
  const sp = await searchParams;
  const rawQ = typeof sp.q === 'string' ? sp.q : '';
  const isSearching = rawQ.trim().length > 0;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>

      <GuideSearch />

      {isSearching ? (
        <SearchBranch locale={locale} query={rawQ} errorLabel={tErr('fetch_failed')} />
      ) : (
        <ListBranch locale={locale} errorLabel={tErr('fetch_failed')} />
      )}
    </section>
  );
}

// react-hooks/error-boundaries : les try/catch des deux branches capturent la
// donnée, jamais du JSX (React ne rend pas les composants au moment du
// `return`) — le fallback d'erreur est rendu hors bloc.
async function ListBranch({ locale, errorLabel }: { locale: Locale; errorLabel: string }) {
  let groups: Awaited<ReturnType<typeof fetchGuideEntries>> | null = null;
  try {
    groups = await fetchGuideEntries(locale);
  } catch (error) {
    log({
      level: 'error',
      event: 'guide.list_fetch_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: (error as { code?: string })?.code ?? 'unknown' },
    });
  }
  if (groups === null) return <ErrorNote label={errorLabel} />;
  if (groups.length === 0) {
    const t = await getTranslations('community.guide');
    return (
      <p className="rounded-[14px] bg-bg-soft px-4 py-6 text-center text-base text-neutral-600">
        {t('empty')}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group, i) => (
        <GuideThemeSection
          key={group.themeKey}
          locale={locale}
          group={group}
          defaultOpen={i === 0}
        />
      ))}
    </div>
  );
}

async function SearchBranch({
  locale,
  query,
  errorLabel,
}: {
  locale: Locale;
  query: string;
  errorLabel: string;
}) {
  let hits: Awaited<ReturnType<typeof searchGuide>> | null = null;
  try {
    hits = await searchGuide(locale, query);
  } catch (error) {
    log({
      level: 'error',
      event: 'guide.search_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: (error as { code?: string })?.code ?? 'unknown' },
    });
  }
  if (hits === null) return <ErrorNote label={errorLabel} />;
  return <GuideSearchResults locale={locale} hits={hits} />;
}

function ErrorNote({ label }: { label: string }) {
  return (
    <p role="alert" className="rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-danger">
      {label}
    </p>
  );
}
