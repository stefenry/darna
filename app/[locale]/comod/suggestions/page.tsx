// Story 6.5 (FR43c) — espace co_mod « Suggestions ». Toutes les suggestions de la
// résidence (RLS co_mod_select_residence), action « Marquer comme lue ». JAMAIS
// public, aucun vote.
//
// Auteur pseudonymisé par défaut (réduire la pression sociale) — SAUF si le voisin
// a coché « Signer avec mon nom » à l'envoi : `suggestions.signed` figé sur la
// ligne, cf. lib/content/suggestion-author.ts.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { resolveNeighbourLabels } from '@/lib/content/author-label';
import { suggestionAuthorLabel, SUGGESTION_PSEUDONYM_SCOPE } from '@/lib/content/suggestion-author';
import { MarkReviewedButton } from './_components/mark-reviewed-button';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

function assertLocale(locale: string) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  assertLocale(locale);
  const t = await getTranslations({ locale, namespace: 'suggestion.comod' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

function formatDate(s: string, locale: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function ComodSuggestionsPage({ params }: Props) {
  const { locale } = await params;
  assertLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('suggestion.comod');
  const supabase = await createClient();
  const { data } = await supabase
    .from('suggestions')
    .select('id, body, state, created_at, user_id, signed')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  const items = data ?? [];
  // 1 requête admin batch pour tout l'écran ; `user_id` ne quitte pas le serveur,
  // seul le libellé résolu part au client.
  const labels = await resolveNeighbourLabels(
    items.map((s) => s.user_id),
    { scope: SUGGESTION_PSEUDONYM_SCOPE },
  );

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{t('title')}</h1>
        <p className="text-base text-neutral-700">{t('intro')}</p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-[14px] bg-bg-soft px-4 py-10 text-center text-base text-neutral-600">
          {t('empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((s) => {
            const resolved = suggestionAuthorLabel(
              s.signed,
              s.user_id ? labels.get(s.user_id) : undefined,
            );
            const author =
              resolved.kind === 'deleted'
                ? t('authorDeleted')
                : resolved.kind === 'pseudonym'
                  ? t('author', { suffix: resolved.suffix })
                  : resolved.villa === null
                    ? t('authorNamedNoVilla', { name: resolved.name })
                    : t('authorNamed', { name: resolved.name, villa: resolved.villa });
            return (
              <li
                key={s.id}
                className="flex flex-col gap-2 rounded-[14px] bg-bg-card p-4 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-neutral-900">{author}</span>
                  <time dateTime={s.created_at} className="text-xs text-neutral-400">
                    {formatDate(s.created_at, locale)}
                  </time>
                </div>
                <p className="whitespace-pre-wrap text-base text-neutral-800">{s.body}</p>
                {s.state === 'reviewed' ? (
                  <span className="w-fit rounded-sm bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700">
                    {t('stateReviewed')}
                  </span>
                ) : (
                  <MarkReviewedButton id={s.id} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
