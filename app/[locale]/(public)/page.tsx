import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { resolveRedirect } from '@/lib/auth/redirect-by-state';
import { homeCta } from '@/lib/auth/home-cta';
import type { routing } from '@/lib/i18n/routing';
import { HomeActions } from './_components/home-actions';

type Locale = (typeof routing.locales)[number];

type Props = {
  params: Promise<{ locale: string }>;
};

// L'accueil est le `start_url` de la PWA : il doit reconnaître la session à chaque
// lancement, donc rendu dynamique (le proxy résout déjà la session sur cette route).
export const dynamic = 'force-dynamic';

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  // Session : on ne garde que ce qu'il faut pour choisir le bon CTA. Aucune
  // redirection — décision produit : la page de présentation reste montrable même
  // connecté.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const destination = user
    ? await resolveRedirect({ supabase, user, locale: locale as Locale, nextParam: null })
    : null;
  const cta = homeCta(destination, locale);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 sm:px-6">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="mt-3 text-lg text-neutral-500">{t('subtitle')}</p>
        <p className="mt-4 text-base text-neutral-400">{t('description')}</p>

        <HomeActions locale={locale} cta={cta} signedIn={Boolean(user)} />
      </div>
    </main>
  );
}
