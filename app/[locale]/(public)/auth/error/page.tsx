import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageContainer } from '@/components/layout/page-container';
import { routing } from '@/lib/i18n/routing';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reason?: string | string[] }>;
};

const ALLOWED_REASONS = ['expired', 'invalid', 'used'] as const;
type Reason = (typeof ALLOWED_REASONS)[number];

function whitelist(value: string | string[] | undefined): Reason | null {
  // Next renders ?reason=a&reason=b as a string[] — pick the first entry then
  // gate it through the allowlist.
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return null;
  return (ALLOWED_REASONS as readonly string[]).includes(candidate) ? (candidate as Reason) : null;
}

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth.error' });
  return { title: t('fallbackTitle') };
}

export default async function ErrorPage({ params, searchParams }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('auth.error');
  const { reason } = await searchParams;
  const safeReason = whitelist(reason);

  const titleKey = safeReason ? `${safeReason}Title` : 'fallbackTitle';
  const bodyKey = safeReason ? `${safeReason}Body` : 'fallbackBody';

  return (
    <PageContainer className="py-10" as="main">
      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
            {t(titleKey as 'expiredTitle' | 'invalidTitle' | 'usedTitle' | 'fallbackTitle')}
          </h1>
          <p className="text-base text-neutral-700">
            {t(bodyKey as 'expiredBody' | 'invalidBody' | 'usedBody' | 'fallbackBody')}
          </p>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/${locale}/auth/login`}
            className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white shadow-sm hover:bg-accent-600"
          >
            {t('backToLogin')}
          </Link>
          <Link
            href={`/${locale}/`}
            className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-bg-soft px-6 text-base font-medium text-neutral-700 hover:bg-neutral-300"
          >
            {t('backHome')}
          </Link>
        </div>
      </section>
    </PageContainer>
  );
}
