import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Plus, type LucideIcon } from 'lucide-react';
import type { Locale } from '@/lib/i18n/config';
import { log } from '@/lib/logger';
import { FeedCard, type FeedItem } from './feed-card';

// Coquille commune aux deux listes de contenu éphémère (alertes, bons plans),
// séparées le 2026-07-26. Les deux écrans ont exactement la même anatomie —
// en-tête, bouton de publication, liste ou état vide, message d'erreur — et
// seuls changent les libellés, la source de données et l'icône.
//
// Sans cette factorisation, la seconde page était une copie de la première :
// SonarCloud a retoqué la PR à 14,2 % de duplication sur le code neuf (seuil 3 %).

type Props = {
  locale: Locale;
  title: string;
  intro: string;
  publish: { href: string; label: string };
  empty: { text: string; cta: string; Icon: LucideIcon };
  /** Chargement des items — passé en thunk pour que l'erreur soit gérée ici. */
  load: () => Promise<FeedItem[]>;
  /** Événement de log en cas d'échec de chargement (distinct par surface). */
  logEvent: string;
};

export async function EphemeralFeedPage({
  locale,
  title,
  intro,
  publish,
  empty,
  load,
  logEvent,
}: Props) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900">{title}</h1>
        <p className="text-base text-neutral-700">{intro}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link
          href={publish.href}
          className="inline-flex min-h-touch items-center gap-2 rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white hover:bg-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          <Plus className="size-4" aria-hidden />
          {publish.label}
        </Link>
      </div>

      <FeedList locale={locale} publish={publish} empty={empty} load={load} logEvent={logEvent} />
    </section>
  );
}

async function FeedList({
  locale,
  publish,
  empty,
  load,
  logEvent,
}: Pick<Props, 'locale' | 'publish' | 'empty' | 'load' | 'logEvent'>) {
  let items: FeedItem[];
  try {
    items = await load();
  } catch (error) {
    log({
      level: 'error',
      event: logEvent,
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: (error as { code?: string })?.code ?? 'unknown' },
    });
    const t = await getTranslations('errors.alertes');
    return (
      <p role="alert" className="rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-danger">
        {t('fetch_failed')}
      </p>
    );
  }

  if (items.length === 0) {
    const { Icon } = empty;
    return (
      <div className="flex flex-col items-center gap-4 rounded-[14px] bg-bg-soft px-4 py-10 text-center">
        <Icon className="size-8 text-neutral-400" aria-hidden />
        <p className="text-base text-neutral-600">{empty.text}</p>
        <Link
          href={publish.href}
          className="inline-flex min-h-touch items-center gap-2 rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white hover:bg-accent-600"
        >
          <Plus className="size-4" aria-hidden />
          {empty.cta}
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id}>
          <FeedCard item={item} locale={locale} />
        </li>
      ))}
    </ul>
  );
}
