import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/lib/i18n/routing';
import { SettingsForm } from '../_components/settings-form';

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/admission`);

  const { data: profile } = await supabase
    .from('profiles')
    .select('identity_mode, language')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
        {t('pageTitle')}
      </h1>
      <SettingsForm
        initialIdentityMode={profile?.identity_mode === 'identified' ? 'identified' : 'pseudo'}
        initialLanguage={profile?.language === 'ar' ? 'ar' : 'fr'}
      />
    </section>
  );
}
