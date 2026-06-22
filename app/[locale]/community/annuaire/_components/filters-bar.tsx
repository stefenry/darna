'use client';

// Story 2.2 (AC3) — barre de chips de filtre : Compétence × Prix × Facture ×
// Note min. Application IMMÉDIATE (pas de bouton « Appliquer ») : chaque toggle
// met à jour l'URL. Chip actif = fond plein accent-500 + badge ✓ ; re-tap = retrait.
//
// 2026-06-22 — refactor sections + flex-wrap (feedback bêta Stephane) : les
// chips étaient tous sur une seule ligne overflow-x-auto, donc les chips de
// droite (notes, facture) restaient invisibles sur mobile à moins de scroller
// horizontalement. Maintenant : 4 sections empilées verticalement, chacune en
// flex-wrap, avec un label en tête. Plus de scroll horizontal silencieux.

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
    <div className="flex flex-col gap-4">
      <FilterSection label={t('competence')}>
        {tags.map((tag) => (
          <FilterChip
            key={tag.key}
            label={tag.label}
            active={activeTag === tag.key}
            onClick={() => toggleParam('tag', tag.key)}
          />
        ))}
      </FilterSection>

      <FilterSection label={t('price')}>
        {PRICE_VALUES.map((price) => (
          <FilterChip
            key={price}
            label={price}
            active={activePrice === price}
            onClick={() => toggleParam('price', price)}
          />
        ))}
      </FilterSection>

      <FilterSection label={t('invoice')}>
        <FilterChip
          label={t('invoice')}
          active={activeFacture === 'oui'}
          onClick={() => toggleParam('facture', 'oui')}
        />
      </FilterSection>

      <FilterSection label={t('minRating')}>
        {MIN_RATING_VALUES.map((stars) => (
          <FilterChip
            key={stars}
            label={t('minRatingValue', { stars })}
            active={activeMin === String(stars)}
            onClick={() => toggleParam('min_rating', String(stars))}
          />
        ))}
      </FilterSection>
    </div>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
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
      className={cn(chipClassName({ active, interactive: true }), 'whitespace-nowrap')}
    >
      {active && <Check className="-ms-0.5 size-3.5" aria-label={t('activeBadge')} role="img" />}
      {label}
    </button>
  );
}
