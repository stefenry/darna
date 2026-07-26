import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import type { Locale } from '@/lib/i18n/config';
import { timeRemaining, type TipCategoryKey } from '@/lib/content/ephemeral';

// Story 4.4 — carte de feed (Server Component). Titre localisé, temps restant
// (« expire dans 18 h »), tap-to-detail.
//
// 2026-07-26 : partagée par DEUX listes désormais séparées (alertes / bons plans).
// Le badge de type a disparu — dans une liste homogène il ne distinguait plus rien.
// Le `kind` sert encore à deux choses : la destination du lien, et le fait que les
// alertes n'affichent jamais d'auteur (choix produit : « il se passe X dans la
// résidence », pas « untel signale que »).
//
// Composant SYNCHRONE (`useTranslations`, valable en RSC) et non plus asynchrone :
// c'est ce qui le rend testable par Testing Library, comme `ArtisanCard`.

export type FeedItem = {
  kind: 'alert' | 'tip';
  id: string;
  slug: string;
  title: string;
  untranslated: boolean;
  createdAt: string;
  expiresAt: string;
  category: TipCategoryKey | null;
  authorName: string | null;
  authorPseudonymSuffix: string | null;
};

function remainingLabel(
  t: (k: string, v?: Record<string, number>) => string,
  expiresAt: string,
): string {
  const tr = timeRemaining(expiresAt, Date.now());
  switch (tr.state) {
    case 'days':
      return t('remaining.days', { value: tr.value });
    case 'hours':
      return t('remaining.hours', { value: tr.value });
    case 'soon':
      return t('remaining.soon');
    default:
      return t('remaining.expired');
  }
}

export function FeedCard({ item, locale }: { item: FeedItem; locale: Locale }) {
  const t = useTranslations('community.alertes');
  const tCat = useTranslations('community.bonsPlans');
  const isAlert = item.kind === 'alert';
  const href = isAlert
    ? `/${locale}/community/alertes/${item.slug}`
    : `/${locale}/community/bons-plans/${item.slug}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[14px] bg-white p-4 shadow-xs hover:bg-bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 motion-safe:transition-colors"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {(item.category || item.untranslated) && (
          <div className="flex flex-wrap items-center gap-2">
            {item.category && (
              <span className="rounded-sm bg-bg-soft px-2 py-0.5 text-xs font-medium text-neutral-600">
                {tCat(`categories.${item.category}`)}
              </span>
            )}
            {item.untranslated && (
              <span className="rounded-sm bg-bg-soft px-2 py-0.5 text-xs font-medium text-neutral-500">
                {t('notTranslatedBadge')}
              </span>
            )}
          </div>
        )}
        <span className="truncate text-base font-semibold text-neutral-900">{item.title}</span>
        <span className="text-sm text-neutral-500">
          {remainingLabel(t, item.expiresAt)}
          {!isAlert && (
            <>
              {' · '}
              {tCat('author.sharedBy', {
                author: item.authorName
                  ? item.authorName
                  : item.authorPseudonymSuffix
                    ? tCat('author.pseudonym', { suffix: item.authorPseudonymSuffix })
                    : tCat('author.deleted'),
              })}
            </>
          )}
        </span>
      </div>
      <ChevronRight className="size-5 shrink-0 text-neutral-400 rtl:rotate-180" aria-hidden />
    </Link>
  );
}
