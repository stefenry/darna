import type { AxisScore, RatingAxis } from './rating';

/** Axe(s) le(s) mieux noté(s) d'un artisan — vide s'il n'a aucune note. Les
 *  ex aequo sont tous retenus : en choisir un seul serait arbitraire. */
export function bestAxes(axes: AxisScore[]): Set<RatingAxis> {
  const rated = axes.filter((a) => a.average !== null && a.count > 0);
  if (rated.length === 0) return new Set();
  const max = Math.max(...rated.map((a) => a.average as number));
  return new Set(rated.filter((a) => a.average === max).map((a) => a.axis));
}
