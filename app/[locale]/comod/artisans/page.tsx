// Feedback bêta 2026-07-23 — file « Artisans à valider » pour le co_mod. Avec
// l'envoi SMS coupé (SMS_PROVIDER=disabled), toute fiche créée reste en
// pending_consent jusqu'à publication par un co_mod — mais l'annuaire ne liste
// que les fiches publiées : sans cette page, les fiches en attente étaient
// introuvables (URL directe uniquement). Chaque entrée renvoie vers la fiche,
// qui porte déjà le bouton « Publier sans consentement » (ComodPublishButton).
//
// Lecture via le client SESSION (RLS artisans_co_mod_select_residence : tous
// états, résidence du co_mod, hors soft-delete). Garde 403 héritée de
// comod/layout.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { assertLocale } from '@/lib/i18n/assert-locale';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  return {
    title: (await getTranslations({ locale, namespace: 'comod.artisansQueue' }))('title'),
  };
}

export default async function ComodArtisansQueuePage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);
  const t = await getTranslations('comod.artisansQueue');

  const supabase = await createClient();
  const { data: artisans } = await supabase
    .from('artisans')
    .select('id, slug, display_name_fr, phone_e164, created_at')
    .eq('state', 'pending_consent')
    .order('created_at', { ascending: true });

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>

      {!artisans || artisans.length === 0 ? (
        <p className="rounded-[14px] bg-bg-soft px-4 py-6 text-center text-base text-neutral-700">
          {t('empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {artisans.map((artisan) => (
            <li key={artisan.id}>
              <Link
                href={`/${locale}/community/artisan/${artisan.slug}`}
                className="flex flex-col gap-1 rounded-[14px] bg-bg-card p-4 shadow-xs hover:bg-bg-soft"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-base font-semibold text-neutral-900">
                    {artisan.display_name_fr}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {t('submittedOn', { date: dateFormat.format(new Date(artisan.created_at)) })}
                  </span>
                </div>
                <span className="text-sm text-neutral-700" dir="ltr">
                  {artisan.phone_e164}
                </span>
                <span className="mt-1 text-sm font-medium text-accent-600">{t('openCta')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
