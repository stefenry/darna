'use client';

// Story 2.2 (AC3) — barre de chips de filtre : Compétence × Prix × Facture ×
// Note min. Application IMMÉDIATE (pas de bouton « Appliquer ») : chaque toggle
// met à jour l'URL. Chip actif = fond plein accent-500 + badge ✓ ; re-tap = retrait.
//
// 2026-06-22 — refactor v3 (feedback bêta Stephane) :
//   v1 : ligne unique overflow-x-auto (chips de droite cachés)
//   v2 : 4 sections empilées flex-wrap (trop de hauteur pour 16 compétences)
//   v3 : <details>/<summary> natif → replié par défaut, l'user déplie au besoin.
//       Compteur de filtres actifs sur le summary pour signaler "tu filtres déjà".

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

  const activeCount =
    (activeTag ? 1 : 0) + (activePrice ? 1 : 0) + (activeFacture ? 1 : 0) + (activeMin ? 1 : 0);

  return (
    <details
      className="group rounded-[14px] bg-bg-soft"
      {...(activeCount > 0 ? { open: true } : {})}
    >
      <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-2 rounded-[14px] px-4 py-3 text-sm font-medium text-neutral-800 hover:bg-neutral-200/50 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span>{t('toggleLabel')}</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-accent-500 px-2 py-0.5 text-xs font-semibold text-white">
              {activeCount}
            </span>
          )}
        </span>
        <span className="text-xs text-neutral-500 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="flex flex-col gap-4 px-4 pb-4">
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
    </details>
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
