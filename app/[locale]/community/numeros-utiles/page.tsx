// Story 3.3 (AC1/AC5/AC6) — page Numéros utiles. RSC ; auth + PageContainer via
// community/layout. Liste groupée par catégorie (ordre canonique), RLS-scopée
// résidence. Pas de recherche (accès direct par catégorie).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';
import { log } from '@/lib/logger';
import { fetchUsefulNumbers } from './data';
import { NumberCard } from './_components/number-card';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

function assertLocale(locale: string): asserts locale is Locale {
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'community.numerosUtiles' });
  return { title: t('title') };
}

export default async function NumerosUtilesPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('community.numerosUtiles');
  const tErr = await getTranslations('errors.numerosUtiles');

  let groups: Awaited<ReturnType<typeof fetchUsefulNumbers>> = [];
  let failed = false;
  try {
    groups = await fetchUsefulNumbers(locale);
  } catch (error) {
    failed = true;
    log({
      level: 'error',
      event: 'numeros.fetch_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: (error as { code?: string })?.code ?? 'unknown' },
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>

      {failed ? (
        <p role="alert" className="rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-danger">
          {tErr('fetch_failed')}
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-[14px] bg-bg-soft px-4 py-6 text-center text-base text-neutral-600">
          {t('empty')}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.categoryKey} className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-neutral-900">
                {t(`categories.${group.categoryKey}`)}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.numbers.map((number) => (
                  <li key={number.id}>
                    <NumberCard number={number} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
