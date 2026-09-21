import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/fr.json';

const toggleParam = vi.fn();
let query = '';
vi.mock('@/app/[locale]/community/annuaire/_components/use-filter-params', () => ({
  useFilterParams: () => ({
    searchParams: new URLSearchParams(query),
    setParam: vi.fn(),
    toggleParam,
  }),
}));

import { FiltersBar } from '@/app/[locale]/community/annuaire/_components/filters-bar';

const TAGS = [
  { key: 'plomberie', label: 'Plomberie' },
  { key: 'peinture', label: 'Peinture' },
];

function wrap() {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <FiltersBar tags={TAGS} />
    </NextIntlClientProvider>,
  );
}

describe('FiltersBar (bouton-icône, refonte 2026-09)', () => {
  beforeEach(() => {
    toggleParam.mockClear();
    query = '';
  });

  it('sans filtre : panneau replié, aucune puce active', () => {
    wrap();
    const button = screen.getByRole('button', { name: 'Filtres' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'Filtres actifs' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Peinture' })).toBeNull();
  });

  it('le bouton ouvre le panneau et ses puces', () => {
    wrap();
    fireEvent.click(screen.getByRole('button', { name: 'Filtres' }));
    expect(screen.getByRole('button', { name: 'Filtres' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Peinture' }));
    expect(toggleParam).toHaveBeenCalledWith('tag', 'peinture');
  });

  it('filtres actifs : compteur dans le nom accessible + puces retirables, panneau toujours replié', () => {
    query = 'tag=plomberie&facture=oui';
    wrap();
    const button = screen.getByRole('button', { name: 'Filtres, 2 actifs' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le filtre Plomberie' }));
    expect(toggleParam).toHaveBeenCalledWith('tag', 'plomberie');
    expect(screen.getByRole('button', { name: 'Retirer le filtre Facture émise' })).toBeDefined();
  });
});
