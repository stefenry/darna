// Story 2.2 — chip réutilisable (tags de compétence sur la carte + chips de
// filtre dans la barre). Style borderless v2 : pill `rounded-full`, fond plein
// `accent-500` à l'état actif, `bg-soft` sinon. Aucun `border`.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ChipStyleOptions = {
  active?: boolean;
  interactive?: boolean;
};

/** Classes partagées entre le chip statique (carte) et les boutons-chips de
 *  filtre (barre cliente). `interactive` ajoute la cible tactile ≥48px + hover. */
export function chipClassName({ active = false, interactive = false }: ChipStyleOptions = {}) {
  return cn(
    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium tracking-wide',
    active ? 'bg-accent-500 text-white' : 'bg-bg-soft text-neutral-700',
    interactive && 'min-h-touch transition-colors',
    interactive && !active && 'hover:bg-accent-100',
    interactive &&
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
  );
}

/** Chip présentationnel statique (tag compétence sur la carte). */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn(chipClassName(), className)}>{children}</span>;
}
