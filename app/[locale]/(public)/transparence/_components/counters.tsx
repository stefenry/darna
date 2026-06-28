import { getTranslations } from 'next-intl/server';
import { COUNTER_KEYS, type TransparencyCounters } from '@/lib/transparency/counters';

// Story 8.1 — grille de compteurs publics agrégés. RSC. Chiffres larges et
// contrastés (≥ 4.5:1, NFR35/NFR40), libellés en langage clair sans jargon.
// Formatage localisé via Intl.NumberFormat (digits AR en mode arabe).
export async function Counters({
  locale,
  counters,
}: {
  locale: string;
  counters: TransparencyCounters;
}) {
  const t = await getTranslations('transparency.counters');
  const nf = new Intl.NumberFormat(locale);

  return (
    <section aria-labelledby="counters-heading" className="mt-8">
      <h2 id="counters-heading" className="text-lg font-semibold text-neutral-900">
        {t('heading')}
      </h2>
      <p className="mt-1 text-sm text-neutral-600">{t('subtitle')}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {COUNTER_KEYS.map((key) => (
          <div
            key={key}
            className="flex flex-col gap-1 rounded-[14px] border border-neutral-200 bg-white p-4"
          >
            <dd className="text-3xl font-semibold tracking-tight text-neutral-900">
              {nf.format(counters[key])}
            </dd>
            <dt className="text-sm font-medium text-neutral-700">{t(`labels.${key}`)}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
