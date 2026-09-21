// Story 2.2 — chip réutilisable (tags de compétence sur la carte + chips de
// filtre dans la barre). Pill `rounded-full`, fond plein `accent-500` à l'état
// actif, `bg-soft` sinon.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ChipStyleOptions = {
  active?: boolean;
  interactive?: boolean;
};

/** Classes partagées entre le chip statique (carte) et les boutons-chips de
 *  filtre (barre cliente). `interactive` : 36 px à l'œil, mais le pseudo-élément `after` étend la zone
 *  de clic à 48 px (refonte 2026-09 — condenser sans rogner la cible tactile). */
export function chipClassName({ active = false, interactive = false }: ChipStyleOptions = {}) {
  return cn(
    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium tracking-wide',
    active ? 'bg-accent-500 text-on-accent' : 'bg-bg-soft text-neutral-700',
    interactive &&
      'relative min-h-9 transition-colors after:absolute after:-inset-y-1.5 after:inset-x-0',
    interactive && !active && 'hover:bg-accent-100',
    interactive &&
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
  );
}

/** Chip présentationnel statique (tag compétence sur la carte). */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn(chipClassName(), className)}>{children}</span>;
}
