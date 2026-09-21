// Story 2.3 (AC1) — les 4 jauges de la fiche (variante `full`), ordre canonique
// des axes. Refonte 2026-09 : une carte bordée, lue comme un tableau ; l'action
// « Noter » se loge dans son en-tête au lieu d'occuper un bouton pleine largeur.

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { RatingGauge } from '@/app/[locale]/community/annuaire/_components/rating-gauge';
import { RATING_AXES, type AxisScore } from '@/lib/artisans/rating';

export function RatingGaugesFull({ axes, action }: { axes: AxisScore[]; action?: ReactNode }) {
  const t = useTranslations('community.artisan');
  const byAxis = new Map(axes.map((a) => [a.axis, a]));
  return (
    <section className="flex flex-col gap-2 rounded border border-neutral-200 bg-bg-card px-4 pb-3.5 pt-3">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <h2 className="text-xs font-semibold text-neutral-500">{t('ratings')}</h2>
        {action}
      </div>
      {RATING_AXES.map((axis) => {
        const s = byAxis.get(axis) ?? { axis, average: null, count: 0 };
        return (
          <RatingGauge key={axis} axis={axis} average={s.average} count={s.count} variant="full" />
        );
      })}
    </section>
  );
}
