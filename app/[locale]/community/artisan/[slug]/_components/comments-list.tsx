// Story 2.3 (AC1) — liste des avis voisins (10 plus récents). Pseudonyme stable
// (FR16, story 2.6) ou nom selon le `visibility` du contributeur (résolu en amont
// dans data.ts). Scores par axe noté affichés en petit.

import { useTranslations } from 'next-intl';
import type { ArtisanComment } from '../data';
import { ReportButton } from '@/components/content/report-button';
import { ReactionButton } from '@/components/content/reaction-button';
import type { ReactionState } from '../../../_data/reactions';

// FR16 — nommé → display_name ; pseudonyme → « Voisin anonyme #XXXX » stable ;
// contributeur anonymisé (purge RGPD, suffixe null) → « Voisin supprimé ».
function authorLabel(
  comment: ArtisanComment,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  if (comment.authorName) return comment.authorName;
  if (comment.pseudonymSuffix) return t('pseudonym', { suffix: comment.pseudonymSuffix });
  return t('deletedAuthor');
}

function formatDate(s: string, locale: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function CommentsList({
  locale,
  comments,
  reactions,
}: {
  locale: string;
  comments: ArtisanComment[];
  reactions: Map<string, ReactionState>;
}) {
  const t = useTranslations('community.artisan.comments');
  const tAxes = useTranslations('community.annuaire.axes');

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium text-neutral-900">{t('title')}</h2>
      {comments.length === 0 ? (
        <p className="rounded-[14px] bg-bg-soft px-4 py-6 text-center text-base text-neutral-700">
          {t('empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => {
            const formattedDate = formatDate(comment.createdAt, locale);
            return (
              <li
                key={comment.id}
                id={`rating-${comment.id}`}
                className="flex flex-col gap-2 scroll-mt-4 rounded-[14px] bg-bg-card p-4 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-neutral-900">
                    {authorLabel(comment, t)}
                  </span>
                  {formattedDate && (
                    <time dateTime={comment.createdAt} className="text-xs text-neutral-400">
                      {formattedDate}
                    </time>
                  )}
                </div>
                {comment.scores.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                    {comment.scores.map((s) => (
                      <span key={s.axis} className="tabular-nums">
                        {tAxes(s.axis)} {s.value}/5
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-base text-neutral-700">{comment.commentText}</p>
                <div className="flex items-center justify-between gap-2">
                  <ReactionButton
                    targetType="rating"
                    targetId={comment.id}
                    initialCount={reactions.get(comment.id)?.count ?? 0}
                    initialReacted={reactions.get(comment.id)?.reacted ?? false}
                  />
                  <ReportButton targetType="rating" targetId={comment.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
