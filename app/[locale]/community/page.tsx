import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookOpen, Phone, Bell, Gift, Lightbulb, Search, ChevronRight } from 'lucide-react';
import { routing } from '@/lib/i18n/routing';
import { fetchOnboardingState } from './_data/onboarding';
import { PackBanner } from './_components/pack-banner';

// Page authentifiée : pas de SSG. Home = accès aux modules (CTA annuaire, tuiles,
// liste) + bannière Pack accueil (3.4).
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

  const base = `/${locale}/community`;
  // Refonte 2026-09 : l'action principale (trouver un artisan) devient le gros
  // bouton ; deux modules en tuiles, le reste en liste — tout tient sans défiler.
  const tiles = [
    { key: 'alertes', href: `${base}/alertes`, Icon: Bell },
    { key: 'bonsPlans', href: `${base}/bons-plans`, Icon: Gift },
  ] as const;
  const rows = [
    { key: 'guide', href: `${base}/guide`, Icon: BookOpen },
    { key: 'numeros', href: `${base}/numeros-utiles`, Icon: Phone },
    { key: 'suggestions', href: `${base}/profil/parametres/suggestion`, Icon: Lightbulb },
  ] as const;
  const focus =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500';

  return (
    <section data-wide className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="page-title">{t('title')}</h1>
        <p className="text-sm text-neutral-500">{t('body')}</p>
      </header>

      {showPackBanner && <PackBanner locale={locale} />}

      <Link
        href={`${base}/annuaire`}
        className={`flex min-h-[60px] items-center justify-center gap-3 rounded-lg bg-accent-500 px-6 text-lg font-bold text-on-accent motion-safe:transition-colors hover:bg-accent-600 ${focus}`}
      >
        <Search className="size-5" aria-hidden />
        {t('findArtisan')}
      </Link>

      <nav
        className="flex flex-col gap-4 md:grid md:grid-cols-[1fr_1fr_1.4fr] md:items-start md:gap-4"
        aria-label={t('title')}
      >
        <div className="grid grid-cols-2 gap-3 md:col-span-2 md:gap-4">
          {tiles.map(({ key, href, Icon }) => (
            <Link
              key={key}
              href={href}
              className={`flex flex-col gap-4 rounded-lg border border-neutral-200 bg-bg-card p-4 hover:bg-bg-soft ${focus}`}
            >
              <span className="flex size-10 items-center justify-center rounded-sm bg-bg-soft">
                <Icon className="size-5 text-neutral-900" aria-hidden />
              </span>
              <span className="text-base font-semibold text-neutral-900">{t(`tiles.${key}`)}</span>
            </Link>
          ))}
        </div>

        <div className="flex flex-col">
          <h2 className="pb-2 text-xs font-semibold text-neutral-500">{t('practical')}</h2>
          {rows.map(({ key, href, Icon }) => (
            <Link
              key={key}
              href={href}
              className={`flex min-h-[52px] items-center gap-3 border-t border-neutral-200 px-1 text-base font-semibold text-neutral-900 hover:bg-bg-soft ${focus}`}
            >
              <Icon className="size-5 text-neutral-500" aria-hidden />
              <span className="flex-1">{t(`tiles.${key}`)}</span>
              <ChevronRight className="size-5 text-neutral-500 rtl:rotate-180" aria-hidden />
            </Link>
          ))}
        </div>
      </nav>
    </section>
  );
}
