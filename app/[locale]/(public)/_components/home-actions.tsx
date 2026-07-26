// Actions de l'accueil — présentation seule, aucune logique de décision (elle vit
// dans lib/auth/home-cta.ts). Server Component : pas de 'use client', donc pas
// d'hydratation pour trois liens.
//
// `next/link` avec la locale explicite plutôt que le <Link> localisé de
// `@/lib/i18n/navigation` : c'est le pattern dominant du reste de l'app (cf.
// artisan-header), et surtout `cta.href` vient de resolveRedirect et contient DÉJÀ
// la locale — mélanger les deux préfixerait deux fois.

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { HomeCta } from '@/lib/auth/home-cta';

const PRIMARY =
  'inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-medium text-white shadow-sm transition-colors hover:bg-accent-600';
const SECONDARY =
  'inline-flex min-h-touch items-center justify-center rounded-[14px] bg-bg-soft px-6 text-base font-medium text-neutral-700 transition-colors hover:bg-neutral-300';
// Masqué quand la PWA tourne en mode installé : à cet endroit le bouton est du
// bruit. CSS pur (variante arbitraire Tailwind), aucun JS.
const HIDE_WHEN_INSTALLED = '[@media(display-mode:standalone)]:hidden';

export function HomeActions({
  locale,
  cta,
  signedIn,
}: {
  locale: string;
  cta: HomeCta;
  signedIn: boolean;
}) {
  const t = useTranslations('home');

  return (
    <div className="mt-10 flex flex-col items-center gap-4">
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:justify-center">
        {cta.kind === 'apply' ? (
          <Link href={`/${locale}/admission`} className={PRIMARY}>
            {t('cta_admission')}
          </Link>
        ) : (
          <Link href={cta.href} className={PRIMARY}>
            {cta.kind === 'enter' ? t('cta_enter') : t('cta_pending')}
          </Link>
        )}

        <Link href={`/${locale}/install`} className={`${SECONDARY} ${HIDE_WHEN_INSTALLED}`}>
          {t('cta_install')}
        </Link>
      </div>

      {/* Le maillon manquant : hors session, la porte de connexion doit être visible
          depuis l'accueil, pas enterrée en bas de /admission. */}
      {!signedIn && (
        <p className="text-sm text-neutral-500">
          {t('login_hint')}{' '}
          <Link
            href={`/${locale}/auth/login`}
            className="font-medium text-accent-500 underline-offset-4 hover:underline"
          >
            {t('login_cta')}
          </Link>
        </p>
      )}
    </div>
  );
}
