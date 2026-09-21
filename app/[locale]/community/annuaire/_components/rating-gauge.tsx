// Story 2.2 (AC1/AC7) — jauge par axe de notation. `role="meter"` ARIA, libellé
// et score toujours présents. Animation de remplissage sous `motion-safe:`.
//
// Refonte 2026-09 : une seule teinte. La longueur de la barre et le chiffre
// portent l'information — plus de couleur par axe, on s'y perdait.
//   - `cell` (carte annuaire) : libellé court, note, mini-barre. Les 4 axes
//     tiennent sur une rangée ; le nombre de voix n'est pas affiché (il reste
//     dans `aria-valuetext`, et en clair sur la fiche).
//   - `full` (fiche) : une ligne par axe — libellé, barre, note, voix — alignée
//     comme un tableau.

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { RatingAxis } from '@/lib/artisans/rating';

type Props = {
  axis: RatingAxis;
  average: number | null;
  count: number;
  variant?: 'cell' | 'full';
};

export function RatingGauge({ axis, average, count, variant = 'cell' }: Props) {
  const t = useTranslations('community.annuaire.gauge');
  const tAxes = useTranslations('community.annuaire.axes');
  const tShort = useTranslations('community.annuaire.axesShort');

  const label = tAxes(axis);
  const isNa = average === null || count === 0;
  const fillPct = isNa ? 0 : Math.max(0, Math.min(100, (average / 5) * 100));
  const scoreText = isNa ? t('na') : average.toFixed(1);
  const valueText = isNa
    ? t('valueTextNa', { axis: label })
    : t('valueText', { axis: label, average: scoreText, count });

  const meter = {
    role: 'meter',
    'aria-valuemin': 0,
    'aria-valuemax': 5,
    'aria-valuenow': average ?? 0,
    'aria-valuetext': valueText,
  } as const;

  const bar = (height: string) => (
    <div
      className={cn('min-w-0 flex-1 overflow-hidden rounded-full bg-gauge-track', height)}
      aria-hidden
    >
      <div
        className="h-full rounded-full bg-neutral-900 motion-safe:transition-[width] motion-safe:duration-500"
        style={{ width: `${fillPct}%` }}
      />
    </div>
  );

  const score = (
    <span
      className={cn(
        'shrink-0 font-bold tabular-nums',
        isNa ? 'text-neutral-500' : 'text-neutral-900',
      )}
    >
      {scoreText}
    </span>
  );

  if (variant === 'full') {
    return (
      <div {...meter} className="flex items-center gap-2.5 text-[13px]">
        <span className="w-[6.5rem] shrink-0 font-semibold text-neutral-900">{label}</span>
        {bar('h-1')}
        <span className="w-7 shrink-0 text-end">{score}</span>
        <span className="w-16 shrink-0 text-end tabular-nums text-neutral-500">
          {!isNa && t('voters', { count })}
        </span>
      </div>
    );
  }

  return (
    <div {...meter} className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="truncate text-[11px] font-medium leading-tight text-neutral-500">
        {tShort(axis)}
      </span>
      <div className="flex items-center gap-1.5 text-sm leading-tight">
        {score}
        {bar('h-[3px]')}
      </div>
    </div>
  );
}
