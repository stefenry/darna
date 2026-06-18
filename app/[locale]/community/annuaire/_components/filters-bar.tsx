'use client';

// Story 2.2 (AC3) — barre de chips de filtre : Compétence × Prix × Facture ×
// Note min. Application IMMÉDIATE (pas de bouton « Appliquer ») : chaque toggle
// met à jour l'URL. Chip actif = fond plein accent-500 + badge ✓ ; re-tap = retrait.
//
// Review F8 — le badge ✓ (check inline) sur les chips actifs sert d'indicateur
// "sélectionné" persistant : (1) couleur n'est plus seule porteuse (a11y), (2)
// retap = retrait reste découvrable. Décompte d'artisans par filtre = phase 2
// (perf 4 count queries).
// Review F33 — MIN_RATINGS aligné avec le schema (qui n'accepte plus que 2/3/4).

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useFilterParams } from './use-filter-params';
import { chipClassName } from './chip';
import { MIN_RATING_VALUES, PRICE_VALUES } from '../schema';

type Tag = { key: string; label: string };

export function FiltersBar({ tags }: { tags: Tag[] }) {
  const t = useTranslations('community.annuaire.filters');
  const { searchParams, toggleParam } = useFilterParams();

  const activeTag = searchParams.get('tag');
  const activePrice = searchParams.get('price');
  const activeFacture = searchParams.get('facture');
  const activeMin = searchParams.get('min_rating');

  return (
    <div
      role="group"
      aria-label={t('competence')}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6"
    >
      {tags.map((tag) => (
        <FilterChip
          key={tag.key}
          label={tag.label}
          active={activeTag === tag.key}
          onClick={() => toggleParam('tag', tag.key)}
        />
      ))}
      {PRICE_VALUES.map((price) => (
        <FilterChip
          key={price}
          label={price}
          active={activePrice === price}
          onClick={() => toggleParam('price', price)}
        />
      ))}
      <FilterChip
        label={t('invoice')}
        active={activeFacture === 'oui'}
        onClick={() => toggleParam('facture', 'oui')}
      />
      {MIN_RATING_VALUES.map((stars) => (
        <FilterChip
          key={stars}
          label={t('minRatingValue', { stars })}
          active={activeMin === String(stars)}
          onClick={() => toggleParam('min_rating', String(stars))}
        />
      ))}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const t = useTranslations('community.annuaire.filters');
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(chipClassName({ active, interactive: true }), 'shrink-0 whitespace-nowrap')}
    >
      {active && <Check className="-ms-0.5 size-3.5" aria-label={t('activeBadge')} role="img" />}
      {label}
    </button>
  );
}
