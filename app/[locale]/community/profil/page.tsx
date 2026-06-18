import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { routing } from '@/lib/i18n/routing';
import { SignoutButtons } from './_components/signout-buttons';

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
  const t = await getTranslations({ locale, namespace: 'profil' });
  return { title: t('pageTitle') };
}

export default async function ProfilPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('profil');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/admission`);

  const [{ data: userRow }, { data: profile }, { data: prefs }] = await Promise.all([
    supabase.from('users').select('display_name').eq('id', user.id).maybeSingle(),
    supabase
      .from('profiles')
      .select('villa, tranche, language, identity_mode')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('notifications_prefs')
      .select(
        'alerts_urgentes_enabled, nouvelles_entrees_annuaire_enabled, activite_contributions_enabled',
      )
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const visibility =
    profile?.identity_mode === 'identified' ? t('visibilityIdentified') : t('visibilityPseudo');

  return (
    <section className="flex flex-col gap-8">
      <header>
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">
          {t('pageTitle')}
        </h1>
      </header>

      <dl className="flex flex-col gap-3">
        <Row label={t('villaLabel')} value={profile?.villa != null ? String(profile.villa) : '—'} />
        <Row label={t('trancheLabel')} value={profile?.tranche ?? '—'} />
        <Row label={t('firstNameLabel')} value={userRow?.display_name ?? '—'} />
        <Row label={t('emailLabel')} value={user.email ?? '—'} hint={t('emailReadonlyHint')} />
        <Row label={t('languageLabel')} value={(profile?.language ?? 'fr').toUpperCase()} />
        <Row label={t('visibilityLabel')} value={visibility} />
      </dl>

      <section className="flex flex-col gap-2 rounded-[14px] bg-bg-soft p-4">
        <h2 className="text-sm font-medium text-neutral-900">{t('notifStubTitle')}</h2>
        <p className="text-sm text-neutral-500">{t('notifStubHint')}</p>
        <ul className="flex flex-col gap-1 text-sm text-neutral-500">
          <NotifStub on={prefs?.alerts_urgentes_enabled ?? true} label={t('notifAlerts')} />
          <NotifStub
            on={prefs?.nouvelles_entrees_annuaire_enabled ?? false}
            label={t('notifDirectory')}
          />
          <NotifStub
            on={prefs?.activite_contributions_enabled ?? true}
            label={t('notifActivity')}
          />
        </ul>
      </section>

      <div className="flex flex-col gap-3">
        <Link
          href={`/${locale}/community/profil/parametres`}
          className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent-600"
        >
          {t('settingsCta')}
        </Link>
        <SignoutButtons />
        <Link
          href={`/${locale}/community/profil/supprimer`}
          className="text-sm text-neutral-500 underline-offset-4 hover:underline"
        >
          {t('deleteCta')}
        </Link>
      </div>
    </section>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-neutral-200 pb-3">
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="text-base text-neutral-900">{value}</dd>
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

function NotifStub({ on, label }: { on: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden>{on ? '☑' : '☐'}</span>
      {label}
    </li>
  );
}
