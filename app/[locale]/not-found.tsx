import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('errors');

  return (
    <main className="flex min-h-[50dvh] flex-col items-center justify-center px-4">
      <h1 className="text-xl font-semibold text-neutral-900">{t('not_found')}</h1>
      <p className="mt-2 text-base text-neutral-500">{t('not_found_description')}</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-medium text-white hover:bg-accent-600"
      >
        {t('back_home')}
      </Link>
    </main>
  );
}
