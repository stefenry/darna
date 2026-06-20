// Story 2.3 (AC5) + Story 2.7 — panel contributeur (visible si
// `created_by = auth.uid()`). Actions actives depuis 2.7 : édition → `…/modifier`,
// retrait → ancre Danger Zone de la page d'édition.

import Link from 'next/link';
import { useTranslations } from 'next-intl';

const ACTION_CLASS =
  'inline-flex min-h-touch items-center rounded-[14px] bg-bg-card px-4 text-sm font-medium text-accent-600 hover:bg-neutral-300';

export function ContributorPanel({ locale, slug }: { locale: string; slug: string }) {
  const t = useTranslations('community.artisan.owner');
  return (
    <section aria-label={t('title')} className="flex flex-col gap-2 rounded-[14px] bg-bg-soft p-4">
      <p className="text-sm font-medium text-neutral-700">{t('title')}</p>
      <div className="flex flex-wrap gap-2">
        <Link href={`/${locale}/community/artisan/${slug}/modifier`} className={ACTION_CLASS}>
          {t('edit')}
        </Link>
        <Link
          href={`/${locale}/community/artisan/${slug}/modifier#retrait`}
          className={ACTION_CLASS}
        >
          {t('remove')}
        </Link>
      </div>
    </section>
  );
}
