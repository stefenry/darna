// Story 4.x — helpers purs du contenu éphémère : temps restant + slug.

import { describe, expect, it } from 'vitest';
import { timeRemaining } from '@/lib/content/ephemeral';
import { buildEphemeralSlug } from '@/lib/validation/ephemeral-content';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

describe('timeRemaining', () => {
  const now = 1_000_000_000_000;
  it('expiré si déjà passé', () => {
    expect(timeRemaining(new Date(now - 1000).toISOString(), now)).toEqual({ state: 'expired' });
  });
  it('soon si < 1h', () => {
    expect(timeRemaining(new Date(now + 30 * 60_000).toISOString(), now)).toEqual({
      state: 'soon',
    });
  });
  it('heures si 1h ≤ t < 48h', () => {
    expect(timeRemaining(new Date(now + 18 * 3_600_000).toISOString(), now)).toEqual({
      state: 'hours',
      value: 18,
    });
  });
  it('jours si ≥ 48h', () => {
    expect(timeRemaining(new Date(now + 5 * 86_400_000).toISOString(), now)).toEqual({
      state: 'days',
      value: 5,
    });
  });
  it('arrondit au jour le plus proche (71h → 3 jours, pas 2)', () => {
    expect(timeRemaining(new Date(now + 71 * 3_600_000).toISOString(), now)).toEqual({
      state: 'days',
      value: 3,
    });
  });
});

describe('buildEphemeralSlug', () => {
  it('respecte le format CHECK et préfixe le titre slugifié', () => {
    const slug = buildEphemeralSlug("Coupure d'eau", 'alerte');
    expect(slug).toMatch(SLUG_RE);
    expect(slug.startsWith('coupure-d-eau-')).toBe(true);
  });

  it('retombe sur le fallback si titre non slugifiable', () => {
    const slug = buildEphemeralSlug('***', 'bon-plan');
    expect(slug).toMatch(SLUG_RE);
    expect(slug.startsWith('bon-plan-')).toBe(true);
  });

  it('génère un suffixe différent à chaque appel (anti-collision)', () => {
    const a = buildEphemeralSlug('Test', 'alerte');
    const b = buildEphemeralSlug('Test', 'alerte');
    expect(a).not.toEqual(b);
  });
});
