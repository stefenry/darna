import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageContainer } from '@/components/layout/page-container';
import { fetchJournalPage } from '@/lib/transparency/journal';
import { JOURNAL_FILTERS } from '@/lib/transparency/events';
import { JournalFeed } from './_components/journal-feed';

// Story 5.4 — journal public de modération (transparence radicale FR33). RSC,
// route publique (anon + authenticated). Lecture de moderation_log_public.
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string; from?: string; to?: string }>;
};

const FILTER_KEYS = Object.keys(JOURNAL_FILTERS);

function normalizeDate(d: string | undefined, endOfDay = false): string | null {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return endOfDay ? `${d}T23:59:59.999Z` : `${d}T00:00:00.000Z`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'transparency' });
  return { title: t('title') };
}

export default async function TransparencePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('transparency');

  const filter = sp.filter && FILTER_KEYS.includes(sp.filter) ? sp.filter : 'all';
  const filters = {
    filter,
    from: normalizeDate(sp.from),
    to: normalizeDate(sp.to, true),
  };

  const page = await fetchJournalPage(filters);

  return (
    <PageContainer className="py-12" as="main">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('journal.intro')}</p>
      </header>

      {/* Filtres (server-side via GET). */}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{t('journal.filterLabel')}</span>
          <select
            name="filter"
            defaultValue={filter}
            className="min-h-touch rounded-[10px] border border-neutral-200 bg-white px-3 text-sm"
          >
            {FILTER_KEYS.map((k) => (
              <option key={k} value={k}>
                {t(`journal.filters.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{t('journal.fromLabel')}</span>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ''}
            className="min-h-touch rounded-[10px] border border-neutral-200 bg-white px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{t('journal.toLabel')}</span>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ''}
            className="min-h-touch rounded-[10px] border border-neutral-200 bg-white px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white hover:bg-accent-600"
        >
          {t('journal.applyFilter')}
        </button>
      </form>

      <section className="mt-6">
        <JournalFeed
          key={`${filter}-${sp.from ?? ''}-${sp.to ?? ''}`}
          locale={locale}
          initialEntries={page.entries}
          initialCursor={page.nextCursor}
          filters={filters}
        />
      </section>

      {/* Placeholder Story 8.2 — section bilingue « Comment vos données sont protégées ». */}
      <section className="mt-12 rounded-[14px] bg-bg-soft p-5">
        <h2 className="text-lg font-semibold text-neutral-900">{t('dataProtection.title')}</h2>
        <p className="mt-2 text-base text-neutral-700">{t('dataProtection.body')}</p>
      </section>
    </PageContainer>
  );
}
