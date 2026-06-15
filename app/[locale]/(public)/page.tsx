import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/lib/i18n/navigation';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 sm:px-6">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="mt-3 text-lg text-neutral-500">{t('subtitle')}</p>
        <p className="mt-4 text-base text-neutral-400">{t('description')}</p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/admission"
            className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-medium text-white shadow-sm transition-colors hover:bg-accent-600"
          >
            {t('cta_admission')}
          </Link>
          <Link
            href="/install"
            className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-bg-soft px-6 text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-300"
          >
            {t('cta_install')}
          </Link>
        </div>
      </div>
    </main>
  );
}
