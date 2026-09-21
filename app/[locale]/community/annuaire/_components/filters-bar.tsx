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
//   v4 (refonte 2026-09) : le bandeau « Filtres » pleine largeur devient un
//       bouton-icône à droite de la recherche — une rangée de gagnée. Le panneau
//       reste replié même quand on filtre : les filtres actifs s'affichent en
//       puces retirables sous la recherche (rien si aucun filtre). Pas de rangée
//       défilante de toutes les compétences : la v1 cachait les puces de droite.

import { useId, useState } from 'react';
import { Check, SlidersHorizontal, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useFilterParams } from './use-filter-params';
import { chipClassName } from './chip';
import { SearchInput } from './search-input';
import { MIN_RATING_VALUES, PRICE_VALUES } from '../schema';

type Tag = { key: string; label: string };

export function FiltersBar({ tags }: { tags: Tag[] }) {
  const t = useTranslations('community.annuaire.filters');
  const { searchParams, toggleParam } = useFilterParams();

  const activeTag = searchParams.get('tag');
  const activePrice = searchParams.get('price');
  const activeFacture = searchParams.get('facture');
  const activeMin = searchParams.get('min_rating');

  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Filtres actifs, dans l'ordre des sections du panneau.
  const active = [
    activeTag && {
      key: 'tag',
      value: activeTag,
      label: tags.find((tag) => tag.key === activeTag)?.label ?? activeTag,
    },
    activePrice && { key: 'price', value: activePrice, label: activePrice },
    activeFacture && { key: 'facture', value: activeFacture, label: t('invoice') },
    activeMin && {
      key: 'min_rating',
      value: activeMin,
      label: t('minRatingValue', { stars: activeMin }),
    },
  ].filter((x): x is { key: string; value: string; label: string } => Boolean(x));
  const activeCount = active.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <SearchInput />
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={t('toggleAria', { count: activeCount })}
          className={cn(
            'relative inline-flex size-11 shrink-0 items-center justify-center rounded border text-neutral-900 motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
            open
              ? 'border-neutral-900 bg-bg-soft'
              : 'border-neutral-200 bg-bg-card hover:bg-bg-soft',
          )}
        >
          <SlidersHorizontal className="size-5" aria-hidden />
          {activeCount > 0 && (
            <span
              aria-hidden
              className="absolute -end-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-pop px-1 text-[11px] font-bold leading-[18px] text-on-pop"
            >
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {activeCount > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t('activeList')}>
          {active.map((f) => (
            <li key={f.key}>
              <button
                type="button"
                onClick={() => toggleParam(f.key, f.value)}
                aria-label={t('remove', { label: f.label })}
                className={cn(
                  chipClassName({ active: true, interactive: true }),
                  'whitespace-nowrap',
                )}
              >
                {f.label}
                <X className="-me-0.5 size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        id={panelId}
        hidden={!open}
        className="flex flex-col gap-3 rounded border border-neutral-200 bg-bg-card px-4 py-3"
      >
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
