// Story 2.2 (AC1) — logique pure de notation 4 axes.

import { describe, it, expect } from 'vitest';
import { toAxisScores, topAxes, RATING_AXES, type RatingAggregateRow } from './rating';

const FULL: RatingAggregateRow = {
  avg_depannage: 4.5,
  n_depannage: 4,
  avg_petits_travaux: 3.0,
  n_petits_travaux: 1,
  avg_travail_soigne: 5.0,
  n_travail_soigne: 2,
  avg_urgences: null,
  n_urgences: 0,
};

describe('toAxisScores', () => {
  it('mappe la ligne d’agrégat sur les 4 axes ordonnés', () => {
    const scores = toAxisScores(FULL);
    expect(scores.map((s) => s.axis)).toEqual([...RATING_AXES]);
    expect(scores[0]).toEqual({ axis: 'depannage', average: 4.5, count: 4 });
    expect(scores[3]).toEqual({ axis: 'urgences', average: null, count: 0 });
  });

  it('ligne absente → 4 axes NA (average null, count 0)', () => {
    const scores = toAxisScores(null);
    expect(scores).toHaveLength(4);
    expect(scores.every((s) => s.average === null && s.count === 0)).toBe(true);
  });
});

describe('topAxes', () => {
  it('trie par nombre de voix décroissant puis moyenne décroissante', () => {
    const top = topAxes(toAxisScores(FULL), 2);
    // depannage (4 voix) puis travail-soigne (2 voix) — pas petits-travaux (1).
    expect(top.map((s) => s.axis)).toEqual(['depannage', 'travail-soigne']);
  });

  it('départage à voix égales par la moyenne la plus haute', () => {
    const tie: RatingAggregateRow = {
      avg_depannage: 3.0,
      n_depannage: 2,
      avg_petits_travaux: 4.8,
      n_petits_travaux: 2,
      avg_travail_soigne: null,
      n_travail_soigne: 0,
      avg_urgences: null,
      n_urgences: 0,
    };
    expect(topAxes(toAxisScores(tie), 1).map((s) => s.axis)).toEqual(['petits-travaux']);
  });

  it('renvoie toujours n axes (les NA restent affichables)', () => {
    expect(topAxes(toAxisScores(null), 2)).toHaveLength(2);
  });

  it('artisan sans vote + tagKey → 2 axes du métier (mapping plomberie)', () => {
    // Review D4 — un artisan plomberie fraîchement publié doit afficher
    // dépannage + urgences (pas dépannage + petits-travaux canoniques).
    const top = topAxes(toAxisScores(null), 2, 'plomberie');
    expect(top.map((s) => s.axis)).toEqual(['depannage', 'urgences']);
    expect(top.every((s) => s.average === null && s.count === 0)).toBe(true);
  });

  it('artisan sans vote + tagKey inconnu → fallback canonique', () => {
    const top = topAxes(toAxisScores(null), 2, 'tag-bidon');
    expect(top).toHaveLength(2);
  });

  it('artisan sans vote sans tagKey → fallback canonique', () => {
    expect(topAxes(toAxisScores(null), 2).map((s) => s.axis)).toEqual([
      'depannage',
      'petits-travaux',
    ]);
  });

  it('artisan AVEC votes : `tagKey` ignoré (le tri par voix prime)', () => {
    const top = topAxes(toAxisScores(FULL), 2, 'peinture');
    expect(top.map((s) => s.axis)).toEqual(['depannage', 'travail-soigne']);
  });
});

describe('toAxisScores — coercion PostgREST', () => {
  it('coerce les valeurs string (PostgREST sérialise numeric/bigint en string)', () => {
    const row = {
      avg_depannage: '4.50',
      n_depannage: '12',
      avg_petits_travaux: '3.0',
      n_petits_travaux: '5',
      avg_travail_soigne: null,
      n_travail_soigne: '0',
      avg_urgences: null,
      n_urgences: null,
    };
    const scores = toAxisScores(row as unknown as RatingAggregateRow);
    expect(scores[0]).toEqual({ axis: 'depannage', average: 4.5, count: 12 });
    expect(scores[1]).toEqual({ axis: 'petits-travaux', average: 3.0, count: 5 });
    expect(scores[2]).toEqual({ axis: 'travail-soigne', average: null, count: 0 });
    expect(scores[3]).toEqual({ axis: 'urgences', average: null, count: 0 });
  });

  it('valeurs non-numériques → null/0 sans crash', () => {
    const row = {
      avg_depannage: 'NaN',
      n_depannage: 'abc',
      avg_petits_travaux: undefined,
      n_petits_travaux: -3,
      avg_travail_soigne: 5,
      n_travail_soigne: 5,
      avg_urgences: null,
      n_urgences: null,
    };
    const scores = toAxisScores(row as unknown as RatingAggregateRow);
    const [depannage, petitsTravaux, travailSoigne] = scores;
    expect(depannage?.average).toBeNull();
    expect(depannage?.count).toBe(0);
    // -3 → 0 (jamais négatif).
    expect(petitsTravaux?.count).toBe(0);
    expect(travailSoigne).toEqual({ axis: 'travail-soigne', average: 5, count: 5 });
  });
});
