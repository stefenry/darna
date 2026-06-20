'use client';

// Story 2.6 — formulaire de notation typée (page dédiée /noter). 4 axes en
// sélecteur étoiles 1-5 ou « Non applicable », commentaire optionnel ≤500 avec
// compteur, choix de visibilité (pseudonyme défaut / nommé opt-in). `useActionState`
// → submitRating. Gate « ≥ 1 axe » côté client (CTA désactivé), re-validé serveur.
// Pré-rempli si note existante (CTA → « Mettre à jour »).
//
// a11y : chaque axe = `<fieldset>`/`<legend>` ; étoiles = `role="radiogroup"` +
// boutons `role="radio"` ; annonce ARIA live au tap ; cibles tactiles ≥ 48px (NFR36).
//
// Review (2026-06-20) :
//   - P8 : surface `visibilityMemorizeFailed` côté UI (warning discret).
//   - P9 : `RetractControls` reset `confirmRating` après échec + display error banner.
//   - P10 : toggle « Réactiver » NA → hint « Choisissez une note ».
//   - P12 : `naToggle` `aria-pressed` + `min-h-touch`.
//   - Pass 1 P3 : CTA sticky bas (cluster 2.3 P5 / 2.4 W3).

import { useActionState, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { RATING_AXES, type RatingAxis } from '@/lib/artisans/rating';
import {
  submitRating,
  retractOwnRating,
  retractOwnComment,
  RATING_INITIAL,
  RETRACT_RATING_INITIAL,
} from '../actions';
import type { MyRating } from '../../data';

const AXIS_FIELD: Record<RatingAxis, keyof MyRating> = {
  depannage: 'score_depannage',
  'petits-travaux': 'score_petits_travaux',
  'travail-soigne': 'score_travail_soigne',
  urgences: 'score_urgences',
};

type Props = {
  locale: string;
  slug: string;
  existingRating: MyRating | null;
  defaultVisibility: 'pseudonym' | 'named';
};

export function RateForm({ locale, slug, existingRating, defaultVisibility }: Props) {
  const t = useTranslations('community.artisanRate');
  const tAxes = useTranslations('community.annuaire.axes');
  const tErr = useTranslations('errors');
  const [state, formAction, isPending] = useActionState(submitRating, RATING_INITIAL);

  const initScores = (): Record<RatingAxis, number | null> =>
    Object.fromEntries(
      RATING_AXES.map((axis) => [
        axis,
        (existingRating?.[AXIS_FIELD[axis]] as number | null) ?? null,
      ]),
    ) as Record<RatingAxis, number | null>;

  const [scores, setScores] = useState<Record<RatingAxis, number | null>>(initScores);
  const [na, setNa] = useState<Record<RatingAxis, boolean>>(
    () =>
      Object.fromEntries(
        RATING_AXES.map((axis) => [
          axis,
          existingRating ? (existingRating[AXIS_FIELD[axis]] as number | null) == null : false,
        ]),
      ) as Record<RatingAxis, boolean>,
  );
  // P10 — axes qui ont été réactivés (NA→pas-NA) sans score choisi encore.
  // Sert à afficher un hint « Choisissez une note ».
  const [reactivatedPending, setReactivatedPending] = useState<Record<RatingAxis, boolean>>(
    () =>
      Object.fromEntries(RATING_AXES.map((axis) => [axis, false])) as Record<RatingAxis, boolean>,
  );
  const [commentLen, setCommentLen] = useState(existingRating?.comment_text?.length ?? 0);
  const [named, setNamed] = useState(defaultVisibility === 'named');
  const [announce, setAnnounce] = useState('');

  const commentId = useId();
  const ratedCount = RATING_AXES.filter((axis) => scores[axis] != null).length;
  const canSubmit = ratedCount >= 1 && !isPending;

  function setStar(axis: RatingAxis, value: number) {
    setScores((s) => ({ ...s, [axis]: value }));
    setNa((n) => ({ ...n, [axis]: false }));
    setReactivatedPending((p) => ({ ...p, [axis]: false }));
    setAnnounce(t('axisStarLabel', { value: String(value), axis: tAxes(axis) }));
  }
  function toggleNa(axis: RatingAxis) {
    setNa((n) => {
      const next = !n[axis];
      if (next) {
        // Activer NA → réinitialise score.
        setScores((s) => ({ ...s, [axis]: null }));
        setReactivatedPending((p) => ({ ...p, [axis]: false }));
      } else if (scores[axis] == null) {
        // Désactiver NA mais pas encore noté → hint.
        setReactivatedPending((p) => ({ ...p, [axis]: true }));
      }
      return { ...n, [axis]: next };
    });
  }

  if (state.ok) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-[14px] bg-accent-50 p-5">
        <p className="text-base text-neutral-900">{t('success')}</p>
        {state.visibilityMemorizeFailed && (
          <p role="alert" className="rounded-[10px] bg-bg-soft px-3 py-2 text-sm text-warning">
            {t('visibilityMemorizeFailedWarning')}
          </p>
        )}
        <Link
          href={`/${locale}/community/artisan/${slug}`}
          className="inline-flex min-h-touch w-fit items-center justify-center rounded-[14px] bg-accent-500 px-5 text-sm font-semibold text-white hover:bg-accent-600"
        >
          {t('back')}
        </Link>
      </div>
    );
  }

  const error = 'error' in state ? state.error : null;
  const errorKey = error?.message_key?.replace(/^errors\./, '') ?? null;

  return (
    <div className="flex flex-col gap-8 pb-24">
      <form action={formAction} noValidate className="flex flex-col gap-6" aria-busy={isPending}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="visibility" value={named ? 'named' : 'pseudonym'} />
        {RATING_AXES.map((axis) => (
          <input key={axis} type="hidden" name={AXIS_FIELD[axis]} value={scores[axis] ?? ''} />
        ))}

        <p className="rounded-[14px] bg-accent-50 px-4 py-3 text-sm text-neutral-700">
          {t('intro')}
        </p>

        {error && (
          <div role="alert" className="rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-danger">
            {errorKey ? tErr(errorKey) : tErr('rating.submit_failed')}
          </div>
        )}

        {RATING_AXES.map((axis) => {
          const isNa = na[axis];
          const current = scores[axis];
          const needsRating = reactivatedPending[axis] && current == null && !isNa;
          return (
            <fieldset
              key={axis}
              className={`flex flex-col gap-3 rounded-[14px] p-4 ${isNa ? 'bg-bg-soft' : 'bg-bg-card shadow-xs'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <legend className="text-sm font-medium text-neutral-900">{tAxes(axis)}</legend>
                <button
                  type="button"
                  onClick={() => toggleNa(axis)}
                  aria-pressed={isNa}
                  className="inline-flex min-h-touch items-center rounded-full bg-bg-soft px-3 text-xs font-medium text-accent-600"
                >
                  {isNa ? t('naReactivate') : t('naToggle')}
                </button>
              </div>
              <div
                role="radiogroup"
                aria-label={t('axisRadiogroupLabel', { axis: tAxes(axis) })}
                className={`flex gap-1 ${isNa ? 'pointer-events-none opacity-40' : ''}`}
              >
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = current != null && n <= current;
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={current === n}
                      aria-label={t('axisStarLabel', { value: String(n), axis: tAxes(axis) })}
                      disabled={isNa}
                      onClick={() => setStar(axis, n)}
                      className={`flex min-h-touch min-w-touch items-center justify-center rounded-[10px] text-2xl ${filled ? 'text-accent-600' : 'text-neutral-300'}`}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
              {needsRating && (
                <p className="text-xs font-medium text-warning">{t('reactivatedHint')}</p>
              )}
            </fieldset>
          );
        })}

        <label htmlFor={commentId} className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-neutral-900">{t('comment')}</span>
          <textarea
            id={commentId}
            name="comment"
            maxLength={500}
            rows={3}
            defaultValue={existingRating?.comment_text ?? ''}
            placeholder={t('commentPlaceholder')}
            onChange={(e) => setCommentLen(e.target.value.length)}
            className="rounded-[14px] border border-neutral-300 bg-bg-card px-4 py-3 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
          />
          <span className="text-end text-xs tabular-nums text-neutral-500">
            {t('charCount', { count: String(commentLen) })}
          </span>
        </label>

        <label className="flex items-center justify-between gap-3 rounded-[14px] bg-bg-card p-4 shadow-xs">
          <span className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-900">{t('visibilityTitle')}</span>
            <span className="text-neutral-500">{t('visibilityDesc')}</span>
          </span>
          <input
            type="checkbox"
            checked={named}
            onChange={(e) => setNamed(e.target.checked)}
            className="min-h-touch min-w-touch accent-accent-500"
            aria-label={t('visibilityTitle')}
          />
        </label>

        {/* Pass 1 P3 — CTA sticky bas (mobile-first ; respecte safe-area). */}
        <div
          className="sticky bottom-0 z-10 -mx-4 mt-2 border-t border-neutral-200 bg-bg-card px-4 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex min-h-touch-lg w-full items-center justify-center rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 disabled:bg-neutral-300 disabled:text-neutral-500"
          >
            {isPending ? t('submitting') : existingRating ? t('submitUpdate') : t('submit')}
          </button>
        </div>

        <span aria-live="polite" className="sr-only">
          {announce}
        </span>
      </form>
      {existingRating && (
        <RetractControls
          locale={locale}
          slug={slug}
          ratingId={existingRating.id}
          hasComment={!!existingRating.comment_text?.trim()}
        />
      )}
    </div>
  );
}

// Story 2.7 — retrait de sa note (soft-delete) ou de son commentaire seul.
// Confirmation 2-taps inline (pas de modal). Deux formulaires distincts.
// Review P9 (2.6 pass 2) : reset `confirmRating` après échec + display error banner.
function RetractControls({
  locale,
  slug,
  ratingId,
  hasComment,
}: {
  locale: string;
  slug: string;
  ratingId: string;
  hasComment: boolean;
}) {
  const t = useTranslations('community.artisanRate');
  const tErr = useTranslations('errors');
  const router = useRouter();
  const [ratingState, retractRatingAction, ratingPending] = useActionState(
    retractOwnRating,
    RETRACT_RATING_INITIAL,
  );
  const [commentState, retractCommentAction, commentPending] = useActionState(
    retractOwnComment,
    RETRACT_RATING_INITIAL,
  );
  const [confirmRating, setConfirmRating] = useState(false);

  useEffect(() => {
    if (ratingState.ok) router.replace(`/${locale}/community/artisan/${slug}`);
  }, [ratingState, router, locale, slug]);
  useEffect(() => {
    if (commentState.ok) router.refresh();
  }, [commentState, router]);

  // P9 — reset l'état confirmation si l'action échoue (sinon user bloqué).
  const ratingError = 'error' in ratingState ? ratingState.error : null;
  const commentError = 'error' in commentState ? commentState.error : null;
  useEffect(() => {
    if (ratingError) setConfirmRating(false);
  }, [ratingError]);

  return (
    <section className="flex flex-col gap-3 border-t border-neutral-300 pt-5">
      {(ratingError || commentError) && (
        <div role="alert" className="rounded-[14px] bg-bg-soft px-4 py-3 text-sm text-danger">
          {tErr('rating.submit_failed')}
        </div>
      )}
      <form action={retractRatingAction} aria-busy={ratingPending} className="flex flex-col gap-2">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="rating_id" value={ratingId} />
        {!confirmRating ? (
          <button
            type="button"
            onClick={() => setConfirmRating(true)}
            className="inline-flex min-h-touch w-fit items-center text-sm font-medium text-danger underline-offset-4 hover:underline"
          >
            {t('retractRating')}
          </button>
        ) : (
          <button
            type="submit"
            disabled={ratingPending}
            className="inline-flex min-h-touch w-fit items-center justify-center rounded-[14px] bg-danger px-5 text-sm font-semibold text-white hover:opacity-90 disabled:bg-neutral-300"
          >
            {t('retractRatingConfirm')}
          </button>
        )}
      </form>

      {hasComment && (
        <form action={retractCommentAction} aria-busy={commentPending}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="rating_id" value={ratingId} />
          <button
            type="submit"
            disabled={commentPending}
            className="inline-flex min-h-touch w-fit items-center text-sm font-medium text-neutral-500 underline-offset-4 hover:underline"
          >
            {t('retractComment')}
          </button>
        </form>
      )}
    </section>
  );
}
