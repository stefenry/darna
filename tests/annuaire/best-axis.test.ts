import { describe, expect, it } from 'vitest';
import { bestAxes } from '@/lib/artisans/best-axis';

describe('bestAxes', () => {
  it('retient l’axe le mieux noté', () => {
    const best = bestAxes([
      { axis: 'depannage', average: 4.5, count: 4 },
      { axis: 'petits-travaux', average: 3, count: 1 },
      { axis: 'travail-soigne', average: 5, count: 2 },
      { axis: 'urgences', average: null, count: 0 },
    ]);
    expect([...best]).toEqual(['travail-soigne']);
  });

  it('garde tous les ex aequo', () => {
    const best = bestAxes([
      { axis: 'depannage', average: 4, count: 2 },
      { axis: 'urgences', average: 4, count: 1 },
    ]);
    expect([...best].sort()).toEqual(['depannage', 'urgences']);
  });

  it('aucune note → aucun axe mis en avant', () => {
    expect(bestAxes([{ axis: 'depannage', average: null, count: 0 }]).size).toBe(0);
    expect(bestAxes([]).size).toBe(0);
  });
});
