// Story 2.2 (AC4) — helper pur d'ancienneté du cache (l'accès idb est intégration).

import { describe, it, expect } from 'vitest';
import { stalenessHours } from './annuaire-cache';

describe('stalenessHours', () => {
  const H = 3_600_000;

  it('0 heure quand la lecture est très récente', () => {
    expect(stalenessHours(1000, 1000 + 60_000)).toBe(0);
  });

  it('arrondit aux heures pleines (bas)', () => {
    expect(stalenessHours(0, 2 * H + 59 * 60_000)).toBe(2);
  });

  it('jamais négatif (horloge en avance)', () => {
    expect(stalenessHours(5000, 1000)).toBe(0);
  });
});
