// Story 2.6 — Zod schema de la notation typée multi-axes. Erreurs mappées sur des
// clés i18n `errors.rating.*` (le path Zod seul est lu, jamais le message natif —
// AR17). Miroir applicatif des contraintes DB : `score_* between 1 and 5`,
// `num_nonnulls(...) >= 1` (`ratings_at_least_one_score_check`), `comment ≤ 500`.

import { z } from 'zod';

export const RATING_VISIBILITY = ['pseudonym', 'named'] as const;

export const RATING_AXIS_FIELDS = [
  'score_depannage',
  'score_petits_travaux',
  'score_travail_soigne',
  'score_urgences',
] as const;
export type RatingAxisField = (typeof RATING_AXIS_FIELDS)[number];

// Un axe « Non applicable » est absent (undefined) → optional court-circuite avant
// coercion. Un axe noté est une string "1".."5" → coerce + borne 1-5.
const zScore = z.coerce.number().int().min(1).max(5).optional();

export const zRatingForm = z
  .object({
    score_depannage: zScore,
    score_petits_travaux: zScore,
    score_travail_soigne: zScore,
    score_urgences: zScore,
    comment: z.string().trim().max(500).optional().or(z.literal('')),
    visibility: z.enum(RATING_VISIBILITY).default('pseudonym'),
  })
  .refine(
    (v) => RATING_AXIS_FIELDS.map((f) => v[f]).filter((s): s is number => s != null).length >= 1,
    { path: ['scores'], message: 'errors.rating.at_least_one_axis' },
  );

export type RatingForm = z.infer<typeof zRatingForm>;
export type RatingFieldKey = RatingAxisField | 'scores' | 'comment' | 'visibility';

export const RATING_FIELD_ERROR_KEYS = [
  'errors.rating.at_least_one_axis',
  'errors.rating.score_invalid',
  'errors.rating.comment_too_long',
  'errors.rating.visibility_invalid',
] as const;
export type RatingFieldErrorKey = (typeof RATING_FIELD_ERROR_KEYS)[number];

export function mapRatingFieldError(field: RatingFieldKey): RatingFieldErrorKey {
  switch (field) {
    case 'scores':
      return 'errors.rating.at_least_one_axis';
    case 'comment':
      return 'errors.rating.comment_too_long';
    case 'visibility':
      return 'errors.rating.visibility_invalid';
    default:
      // score_depannage / score_petits_travaux / score_travail_soigne / score_urgences
      return 'errors.rating.score_invalid';
  }
}
