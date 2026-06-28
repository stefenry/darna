import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/lib/i18n/routing';
import { SettingsForm } from '../_components/settings-form';
import { NotificationPrefsForm } from '../_components/notification-prefs-form';

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
  const t = await getTranslations({ locale, namespace: 'profil.settings' });
  return { title: t('pageTitle') };
}

export default async function ProfilSettingsPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('profil.settings');
  const tSuggestion = await getTranslations('suggestion');
  const tExport = await getTranslations('profil.export');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/admission`);

  const [{ data: profile }, { data: userRow }, { data: prefs }] = await Promise.all([
    supabase
      .from('profiles')
      .select('identity_mode, language, villa, tranche')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('users').select('display_name').eq('id', user.id).maybeSingle(),
    supabase
      .from('notifications_prefs')
      .select(
        'alerts_urgentes_enabled, nouvelles_entrees_annuaire_enabled, activite_contributions_enabled',
      )
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  // Défauts FR40 si la row manque (provisioning trigger 1.3 normalement garant).
  const initialPrefs = {
    alerts_urgentes_enabled: prefs?.alerts_urgentes_enabled ?? true,
    nouvelles_entrees_annuaire_enabled: prefs?.nouvelles_entrees_annuaire_enabled ?? false,
    activite_contributions_enabled: prefs?.activite_contributions_enabled ?? true,
  };

  return (
    <section className="flex flex-col gap-8">
      <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
        {t('pageTitle')}
      </h1>
      <SettingsForm
        initialIdentityMode={profile?.identity_mode === 'identified' ? 'identified' : 'pseudo'}
        initialLanguage={profile?.language === 'ar' ? 'ar' : 'fr'}
        initialDisplayName={userRow?.display_name ?? ''}
        initialVilla={profile?.villa ?? null}
        initialTranche={profile?.tranche ?? null}
      />

      <NotificationPrefsForm initialPrefs={initialPrefs} />

      <Link
        href={`/${locale}/community/profil/parametres/suggestion`}
        className="flex min-h-touch items-center justify-between gap-2 rounded-[14px] bg-bg-card p-4 shadow-xs hover:bg-bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        <span className="text-base font-medium text-neutral-900">{tSuggestion('title')}</span>
        <ChevronRight className="size-5 shrink-0 text-neutral-400 rtl:rotate-180" aria-hidden />
      </Link>

      <Link
        href={`/${locale}/community/profil/export`}
        className="flex min-h-touch items-center justify-between gap-2 rounded-[14px] bg-bg-card p-4 shadow-xs hover:bg-bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        <span className="text-base font-medium text-neutral-900">{tExport('title')}</span>
        <ChevronRight className="size-5 shrink-0 text-neutral-400 rtl:rotate-180" aria-hidden />
      </Link>
    </section>
  );
}
