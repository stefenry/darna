// Story 2.3 (AC1) — les 4 jauges typées de la fiche (variante `full`). Réutilise
// `RatingGauge` (story 2.2) tel quel ; ordre canonique des axes.

import { RatingGauge } from '@/app/[locale]/community/annuaire/_components/rating-gauge';
import { RATING_AXES, type AxisScore } from '@/lib/artisans/rating';

export function RatingGaugesFull({ axes }: { axes: AxisScore[] }) {
  const byAxis = new Map(axes.map((a) => [a.axis, a]));
  return (
    <div className="flex flex-col gap-3">
      {RATING_AXES.map((axis) => {
        const s = byAxis.get(axis) ?? { axis, average: null, count: 0 };
        return (
          <RatingGauge key={axis} axis={axis} average={s.average} count={s.count} variant="full" />
        );
      })}
    </div>
  );
}
