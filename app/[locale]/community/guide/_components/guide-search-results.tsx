// Story 3.2 (AC2/AC8) — résultats de recherche : liste plate classée par
// pertinence (ts_rank, tri serveur), chaque item = lien deep-link + snippet
// surligné. État vide « Aucun résultat ».
//
// SÉCURITÉ (D3) — le `snippet` est la sortie de `ts_headline` : Postgres
// HTML-ÉCHAPPE le texte source et n'insère QUE les délimiteurs qu'on lui a passés
// (`StartSel=<mark>,StopSel=</mark>`). Le contenu utilisateur (titre/corps) ne peut
// donc PAS injecter de balise ; seules nos `<mark>` traversent. On rend via
// `dangerouslySetInnerHTML` en connaissance de cause (revue sécurité).

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { GuideSearchHit } from '../data';

export function GuideSearchResults({ locale, hits }: { locale: string; hits: GuideSearchHit[] }) {
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
            <span
              className="text-sm text-neutral-600 [&_mark]:rounded-sm [&_mark]:bg-accent-100 [&_mark]:px-0.5 [&_mark]:text-neutral-900"
              // Sûr : sortie ts_headline échappée par Postgres, seules nos <mark> passent (voir en-tête).
              dangerouslySetInnerHTML={{ __html: hit.snippet }}
            />
          )}
        </Link>
      ))}
    </section>
  );
}
