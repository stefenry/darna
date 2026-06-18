// Story 2.2 (AC6) — état vide contributif. Jamais d'écran « 0 résultat » nu :
// icône + titre + description + CTA vers la création de fiche (story 2.4).

import { useTranslations } from 'next-intl';
import { SearchX } from 'lucide-react';

export function EmptyState({ locale }: { locale: string }) {
  const t = useTranslations('community.annuaire.empty');

  return (
    <div className="flex flex-col items-center gap-3 rounded-[14px] bg-bg-soft px-4 py-12 text-center">
      <SearchX className="size-12 text-neutral-300" aria-hidden />
      <h2 className="text-xl font-medium text-neutral-900">{t('title')}</h2>
      <p className="text-base text-neutral-700">{t('description')}</p>
      <a
        href={`/${locale}/community/annuaire/nouveau`}
        className="mt-2 inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white shadow-sm motion-safe:transition-colors hover:bg-accent-600"
      >
        {t('cta')}
      </a>
    </div>
  );
}
