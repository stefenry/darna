import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BottomNav, type BottomNavItem } from '@/components/layout/bottom-nav';
import { PageContainer } from '@/components/layout/page-container';
import { routing } from '@/lib/i18n/routing';
import { requireResident } from '@/lib/auth/require-resident';

// NOTE — zone communautaire (auth obligatoire). Segment littéral `community`
// (PAS un route group, leçon collision 1.8) → URL /[locale]/community, qui est
// la cible de resolveRedirect pour un résident accepté (story 1.6). Shell :
// contenu + barre d'onglets du bas (refonte 2026-09).

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

  const base = `/${locale}/community`;
  const items: BottomNavItem[] = [
    { key: 'home', href: base, label: t('home'), exact: true },
    { key: 'annuaire', href: `${base}/annuaire`, label: t('annuaire') },
    { key: 'alertes', href: `${base}/alertes`, label: t('alertes') },
    { key: 'profil', href: `${base}/profil`, label: t('profil') },
    ...(isComod ? [{ key: 'comod' as const, href: `/${locale}/comod`, label: t('comod') }] : []),
  ];

  // pb-28 : le contenu ne passe pas sous la barre d'onglets fixe.
  return (
    <>
      <PageContainer id="main-content" className="pb-28 pt-4" as="main">
        {children}
      </PageContainer>
      <BottomNav items={items} label={t('main')} />
    </>
  );
}
