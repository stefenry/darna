// Story 2.8 (AC8) — bloc « Réponses de l'artisan » sur la fiche publique. Droit de
// réponse FR22 : signature TOUJOURS le nom de l'artisan (jamais pseudonyme), texte
// simple (whitespace pre-wrap), badge si réponse ciblée sur une note.

import { useTranslations } from 'next-intl';
import type { ArtisanResponseItem } from '../data';

function formatDate(s: string, locale: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
}

export function ArtisanResponses({
  responses,
  artisanName,
  locale,
}: {
  responses: ArtisanResponseItem[];
  artisanName: string;
  locale: string;
}) {
  const t = useTranslations('artisanRespond');
  if (responses.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium text-neutral-900">{t('responsesSectionTitle')}</h2>
      <ul className="flex flex-col gap-3">
        {responses.map((r) => (
          <li key={r.id}>
            <blockquote className="flex flex-col gap-2 rounded-[14px] border-s-4 border-accent-500 bg-accent-50 px-4 py-3">
              <p className="text-xs font-medium text-accent-700">
                {t('signature', { name: artisanName })} · {formatDate(r.createdAt, locale)}
              </p>
              {r.targetKind === 'rating' && (
                <span className="w-fit rounded-full bg-bg-soft px-2 py-0.5 text-xs text-neutral-500">
                  {t('inReplyToRating')}
                </span>
              )}
              <p className="whitespace-pre-wrap text-sm text-neutral-800">{r.responseText}</p>
            </blockquote>
          </li>
        ))}
      </ul>
    </section>
  );
}
