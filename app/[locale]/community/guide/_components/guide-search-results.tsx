// Story 3.2 (AC2/AC8) — résultats de recherche : liste plate classée par
// pertinence (ts_rank, tri serveur), chaque item = lien deep-link + snippet
// surligné. État vide « Aucun résultat ».
//
// SÉCURITÉ (review 3.2 P1) — `ts_headline` Postgres N'HTML-ÉCHAPPE PAS le source
// (vérifié empiriquement : un body contenant `<img onerror=…>` ressort intact
// dans le snippet). On parse donc le `<mark>`/`</mark>` côté JS et rend chaque
// fragment via React (échappement par défaut). Plus de `dangerouslySetInnerHTML`.
//
// Le RPC garde `<mark>` comme délimiteur — nos littéraux à nous, jamais issus
// du texte utilisateur — donc le split est non-ambigu.

import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/lib/i18n/config';
import type { GuideSearchHit } from '../data';

// Parse `ts_headline` snippet : split sur nos délimiteurs littéraux `<mark>` /
// `</mark>` et restitue alternance texte / fragments surlignés. React échappe
// chaque chunk → tout HTML injecté par un co_mod hostile dans body/title est
// inerte (`<img onerror>` apparaît comme texte brut, jamais comme balise DOM).
function renderSnippet(snippet: string): ReactNode {
  const parts = snippet.split(/(<mark>|<\/mark>)/g);
  let inside = false;
  const out: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i];
    if (chunk === '<mark>') {
      inside = true;
      continue;
    }
    if (chunk === '</mark>') {
      inside = false;
      continue;
    }
    if (!chunk) continue;
    out.push(inside ? <mark key={i}>{chunk}</mark> : <Fragment key={i}>{chunk}</Fragment>);
  }
  return out;
}

export function GuideSearchResults({ locale, hits }: { locale: Locale; hits: GuideSearchHit[] }) {
  const t = useTranslations('community.guide.searchResults');

  if (hits.length === 0) {
    return (
      <p className="rounded-[14px] bg-bg-soft px-4 py-6 text-center text-base text-neutral-600">
        {t('empty')}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-2" aria-label={t('title')}>
      {hits.map((hit) => (
        <Link
          key={hit.slug}
          href={`/${locale}/community/guide/${hit.slug}`}
          className="flex flex-col gap-1 rounded-[14px] bg-white px-4 py-3 shadow-xs hover:bg-bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          <span className="font-semibold text-neutral-900">{hit.title}</span>
          {hit.snippet && (
            <span className="text-sm text-neutral-600 [&_mark]:rounded-sm [&_mark]:bg-accent-100 [&_mark]:px-0.5 [&_mark]:text-neutral-900">
              {renderSnippet(hit.snippet)}
            </span>
          )}
        </Link>
      ))}
    </section>
  );
}
