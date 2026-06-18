// Story 2.3 (AC5) — panel contributeur (visible si `created_by = auth.uid()`).
// Les ACTIONS d'édition/retrait sont implémentées en Story 2.7 → entrées
// présentes mais inactives (`disabled` + tooltip « bientôt »).

import { useTranslations } from 'next-intl';

export function ContributorPanel() {
  const t = useTranslations('community.artisan.owner');
  return (
    <section aria-label={t('title')} className="flex flex-col gap-2 rounded-[14px] bg-bg-soft p-4">
      <p className="text-sm font-medium text-neutral-700">{t('title')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={t('soon')}
          className="inline-flex min-h-touch items-center rounded-[14px] bg-bg-card px-4 text-sm font-medium text-neutral-400"
        >
          {t('edit')}
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={t('soon')}
          className="inline-flex min-h-touch items-center rounded-[14px] bg-bg-card px-4 text-sm font-medium text-neutral-400"
        >
          {t('remove')}
        </button>
      </div>
    </section>
  );
}
