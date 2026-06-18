// Story 2.2 (AC1/AC7) — jauge typée par axe. Composant signature de l'annuaire :
// barre colorée + label + score + nombre de voix. La COULEUR n'est jamais seule
// porteuse d'information (label + score toujours présents — a11y deutéranopie).
// `role="meter"` ARIA. Animation de remplissage sous `motion-safe:` uniquement.
//
// Variante `compact` = carte (liste) ; `full` viendra avec la fiche (story 2.3).

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { RatingAxis } from '@/lib/artisans/rating';

const AXIS_BAR_COLOR: Record<RatingAxis, string> = {
  depannage: 'bg-gauge-depannage',
  'petits-travaux': 'bg-gauge-petits-travaux',
  'travail-soigne': 'bg-gauge-travail-soigne',
  urgences: 'bg-gauge-urgences',
};

type Props = {
  axis: RatingAxis;
  average: number | null;
  count: number;
  variant?: 'compact' | 'full';
};

export function RatingGauge({ axis, average, count, variant = 'compact' }: Props) {
  const t = useTranslations('community.annuaire.gauge');
  const tAxes = useTranslations('community.annuaire.axes');

  const label = tAxes(axis);
  const isNa = average === null || count === 0;
  const fillPct = isNa ? 0 : Math.max(0, Math.min(100, (average / 5) * 100));
  const scoreText = isNa ? t('na') : average.toFixed(1);
  const valueText = isNa
    ? t('valueTextNa', { axis: label })
    : t('valueText', { axis: label, average: scoreText, count });

  const isCompact = variant === 'compact';

  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={average ?? 0}
      aria-valuetext={valueText}
      className="flex flex-col gap-1"
    >
      <div
        className={cn(
          'flex items-baseline justify-between gap-2',
          isCompact ? 'text-xs' : 'text-[13px]',
        )}
      >
        <span className="font-medium text-neutral-700">{label}</span>
        <span className="tabular-nums text-neutral-500">
          {scoreText}
          {!isNa && (
            <span className={cn('ms-1', count === 1 ? 'text-neutral-400' : 'text-neutral-500')}>
              · {t('voters', { count })}
            </span>
          )}
        </span>
      </div>
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-gauge-track',
          isCompact ? 'h-1.5' : 'h-2',
          isNa && 'bg-bg-soft',
        )}
        aria-hidden
      >
        <div
          className={cn(
            'h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500',
            isNa ? 'bg-transparent' : AXIS_BAR_COLOR[axis],
          )}
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </div>
  );
}
