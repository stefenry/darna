import { describe, it, expect } from 'vitest';
import { presenceHoursElapsed, isSlaBreached } from './sla';

describe('presenceHoursElapsed', () => {
  it('retourne 0 si now <= start', () => {
    const t = Date.UTC(2026, 0, 1, 10);
    expect(presenceHoursElapsed(t, t)).toBe(0);
    expect(presenceHoursElapsed(t, t - 1000)).toBe(0);
  });

  it('compte 1h pleine dans la fenêtre de présence (10h→11h UTC)', () => {
    expect(presenceHoursElapsed(Date.UTC(2026, 0, 1, 10), Date.UTC(2026, 0, 1, 11))).toBeCloseTo(
      1,
      5,
    );
  });

  it('exclut la nuit (22h→8h le lendemain = 2h de présence)', () => {
    // 22→23 = 1h ; 23→07 = 0 ; 07→08 = 1h.
    expect(presenceHoursElapsed(Date.UTC(2026, 0, 1, 22), Date.UTC(2026, 0, 2, 8))).toBeCloseTo(
      2,
      5,
    );
  });

  it('une plage entièrement nocturne (23h→7h) = 0', () => {
    expect(presenceHoursElapsed(Date.UTC(2026, 0, 1, 23), Date.UTC(2026, 0, 2, 7))).toBe(0);
  });
});

describe('isSlaBreached', () => {
  it('false pour un signalement récent (2h)', () => {
    const now = Date.UTC(2026, 0, 1, 12);
    const created = new Date(Date.UTC(2026, 0, 1, 10)).toISOString();
    expect(isSlaBreached(created, now)).toBe(false);
  });

  it('true au-delà de 24h de présence (créé il y a ~2 jours)', () => {
    const now = Date.UTC(2026, 0, 3, 12);
    const created = new Date(Date.UTC(2026, 0, 1, 8)).toISOString();
    expect(isSlaBreached(created, now)).toBe(true);
  });

  it('false pour une date invalide', () => {
    expect(isSlaBreached('not-a-date', Date.now())).toBe(false);
  });
});
