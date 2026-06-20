import { describe, it, expect } from 'vitest';
import { zRatingForm, mapRatingFieldError } from './rating';

describe('zRatingForm', () => {
  it('accepte une note avec 1 seul axe + autres absents (Non applicable)', () => {
    const r = zRatingForm.safeParse({ score_depannage: '5' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.score_depannage).toBe(5);
      expect(r.data.score_petits_travaux).toBeUndefined();
      expect(r.data.visibility).toBe('pseudonym'); // défaut
    }
  });

  it('rejette 0 axe noté (miroir CHECK ratings_at_least_one_score_check)', () => {
    const r = zRatingForm.safeParse({ comment: 'rien noté' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path[0]).toBe('scores');
  });

  it('rejette un score hors borne 1-5', () => {
    const r = zRatingForm.safeParse({ score_urgences: '6' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path[0]).toBe('score_urgences');
  });

  it('rejette un commentaire > 500 caractères', () => {
    const r = zRatingForm.safeParse({ score_depannage: '3', comment: 'x'.repeat(501) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path[0]).toBe('comment');
  });

  it('accepte les 4 axes notés + visibility named', () => {
    const r = zRatingForm.safeParse({
      score_depannage: '4',
      score_petits_travaux: '5',
      score_travail_soigne: '3',
      score_urgences: '2',
      visibility: 'named',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.visibility).toBe('named');
  });

  it('rejette une visibility inconnue', () => {
    const r = zRatingForm.safeParse({ score_depannage: '3', visibility: 'public' });
    expect(r.success).toBe(false);
  });
});

describe('mapRatingFieldError', () => {
  it('mappe chaque champ sur sa clé i18n', () => {
    expect(mapRatingFieldError('scores')).toBe('errors.rating.at_least_one_axis');
    expect(mapRatingFieldError('comment')).toBe('errors.rating.comment_too_long');
    expect(mapRatingFieldError('visibility')).toBe('errors.rating.visibility_invalid');
    expect(mapRatingFieldError('score_depannage')).toBe('errors.rating.score_invalid');
  });
});
