import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Home, Settings, ShieldCheck } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageContainer } from '@/components/layout/page-container';
import { routing } from '@/lib/i18n/routing';
import { requireResident } from '@/lib/auth/require-resident';

// NOTE — zone communautaire (auth obligatoire). Segment littéral `community`
// (PAS un route group, leçon collision 1.8) → URL /[locale]/community, qui est
// la cible de resolveRedirect pour un résident accepté (story 1.6). Shell
// minimal au MVP : les tuiles Annuaire/Alertes/Guide arrivent aux epics 2-4.

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
}

export default async function CommunityLayout({ children, params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const guard = await requireResident();
  if (!guard.ok) {
    // Le proxy redirige déjà ; défense en profondeur si on l'atteint quand même.
    redirect(`/${locale}/admission`);
  }

  const t = await getTranslations('community.nav');
  const isComod = guard.user.app_metadata?.role === 'co_mod';

  return (
    <PageContainer id="main-content" className="py-6" as="main">
      <div className="mb-6 flex items-center justify-between gap-2">
        <Link
          href={`/${locale}/community`}
          aria-label={t('home')}
          className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-[14px] text-neutral-700 hover:bg-bg-soft"
        >
          <Home className="size-5" aria-hidden />
        </Link>
        <div className="flex items-center gap-2">
          {isComod && (
            <Link
              href={`/${locale}/comod`}
              aria-label={t('comod')}
              className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-[14px] text-neutral-700 hover:bg-bg-soft"
            >
              <ShieldCheck className="size-5" aria-hidden />
            </Link>
          )}
          <Link
            href={`/${locale}/community/profil`}
            aria-label={t('settings')}
            className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-[14px] text-neutral-700 hover:bg-bg-soft"
          >
            <Settings className="size-5" aria-hidden />
          </Link>
        </div>
      </div>
      {children}
    </PageContainer>
  );
}
