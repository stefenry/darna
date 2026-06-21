// Story 6.5 (FR43c) — page résident « Suggérer une évolution » + historique perso
// (mes suggestions seulement, marquées « lue » si un co_mod les a traitées). RLS
// `suggestions_resident_select_own` borne la lecture à l'utilisateur courant.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { routing } from '@/lib/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { requireResident } from '@/lib/auth/require-resident';
import { SuggestionForm } from './_components/suggestion-form';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'suggestion' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function SuggestionPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const guard = await requireResident();
  if (!guard.ok) redirect(`/${locale}/auth/login`);

  const t = await getTranslations('suggestion');
  const supabase = await createClient();
  const { data: mine } = await supabase
    .from('suggestions')
    .select('id, body, state, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <section className="flex flex-col gap-6">
      <Link
        href={`/${locale}/community/profil/parametres`}
        aria-label={t('back')}
        className="inline-flex min-h-touch min-w-touch w-fit items-center justify-center rounded-[14px] text-neutral-700 hover:bg-bg-soft"
      >
        <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>

      <SuggestionForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-neutral-900">{t('history.title')}</h2>
        {(mine ?? []).length === 0 ? (
          <p className="rounded-[14px] bg-bg-soft px-4 py-6 text-center text-base text-neutral-700">
            {t('history.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(mine ?? []).map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-1 rounded-[14px] bg-bg-card p-4 shadow-xs"
              >
                <p className="whitespace-pre-wrap text-base text-neutral-800">{s.body}</p>
                <span
                  className={`w-fit rounded-sm px-2 py-0.5 text-xs font-medium ${
                    s.state === 'reviewed'
                      ? 'bg-accent-100 text-accent-700'
                      : 'bg-bg-soft text-neutral-500'
                  }`}
                >
                  {s.state === 'reviewed' ? t('history.stateReviewed') : t('history.stateNew')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
