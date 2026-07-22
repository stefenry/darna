import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookOpen, Phone, Users, Bell, Lightbulb } from 'lucide-react';
import { routing } from '@/lib/i18n/routing';
import { fetchOnboardingState } from './_data/onboarding';
import { PackBanner } from './_components/pack-banner';

// Page authentifiée : pas de SSG. Home = grille de tuiles d'accès aux modules.
// 3.2 ajoute Annuaire + Guide ; 3.3 ajoutera Numéros utiles ; 3.4 la bannière Pack.
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'community.home' });
  return { title: t('title') };
}

export default async function CommunityHomePage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('community.home');
  const { showPackBanner } = await fetchOnboardingState();

  const tiles = [
    { key: 'annuaire', href: `/${locale}/community/annuaire`, Icon: Users },
    { key: 'alertes', href: `/${locale}/community/alertes`, Icon: Bell },
    { key: 'guide', href: `/${locale}/community/guide`, Icon: BookOpen },
    { key: 'numeros', href: `/${locale}/community/numeros-utiles`, Icon: Phone },
    // Grille 2 colonnes → 5e position = sous « Guide de la résidence ».
    {
      key: 'suggestions',
      href: `/${locale}/community/profil/parametres/suggestion`,
      Icon: Lightbulb,
    },
  ] as const;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('body')}</p>
      </header>

      {showPackBanner && <PackBanner locale={locale} />}

      <nav className="grid grid-cols-2 gap-3" aria-label={t('title')}>
        {tiles.map(({ key, href, Icon }) => (
          <Link
            key={key}
            href={href}
            className="flex min-h-32 flex-col justify-between rounded-[14px] bg-white p-4 shadow-xs hover:bg-bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            <Icon className="size-6 text-accent-600" aria-hidden />
            <span className="text-base font-semibold text-neutral-900">{t(`tiles.${key}`)}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
