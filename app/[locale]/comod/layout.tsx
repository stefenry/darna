import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageContainer } from '@/components/layout/page-container';
import { routing } from '@/lib/i18n/routing';
import { requireComod } from '@/lib/auth/require-comod';

// NOTE — route co-mod (rôle co_mod requis). Placement sous [locale]/comod/
// (segment littéral `comod`, PAS un route group : un groupe (comod) entrerait
// en collision avec (public)/admission au chemin /[locale]/admission). Le
// segment `comod` matche le proxy COMOD_PATTERN (/fr/comod/...) et l'URL
// queue_url que la story 1.7 envoie déjà dans l'e-mail de notification co-mod.
// La garde requireComod() double la protection du proxy (NFR21). Variance D2.

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
}

export default async function ComodLayout({ children, params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const guard = await requireComod();
  if (!guard.ok) {
    const t = await getTranslations('comod.forbidden');
    return (
      <PageContainer className="py-10" as="main">
        <section className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
            {t('title')}
          </h1>
          <p className="text-base text-neutral-700">{t('body')}</p>
        </section>
      </PageContainer>
    );
  }

  return children;
}
