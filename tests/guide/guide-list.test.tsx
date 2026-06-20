// Story 3.2 (AC1/AC2/AC4/AC8) — rendu des composants Guide : sections thèmes
// dépliables (`<details>`), badge « Non traduit » (FR48), résultats de recherche
// (snippet + état vide). Rendu réel sous NextIntlClientProvider + fr.json.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';
import { GuideThemeSection } from '@/app/[locale]/community/guide/_components/guide-theme-section';
import { GuideSearchResults } from '@/app/[locale]/community/guide/_components/guide-search-results';
import type { GuideThemeGroup, GuideSearchHit } from '@/app/[locale]/community/guide/data';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const GROUP: GuideThemeGroup = {
  themeKey: 'codes_portails',
  entries: [
    {
      slug: 'code-portail-principal',
      themeKey: 'codes_portails',
      title: 'Code du portail',
      untranslated: false,
    },
    { slug: 'code-piscine', themeKey: 'codes_portails', title: 'Code piscine', untranslated: true },
  ],
};

describe('GuideThemeSection', () => {
  it('affiche le libellé du thème, le compteur et les entrées en liens deep-link', () => {
    wrap(<GuideThemeSection locale="fr" group={GROUP} defaultOpen />);
    expect(screen.getByText('Codes portails')).toBeDefined();
    expect(screen.getByText('2 entrées')).toBeDefined();
    const link = screen.getByRole('link', { name: /Code du portail/ });
    expect(link.getAttribute('href')).toBe('/fr/community/guide/code-portail-principal');
  });

  it('affiche le badge « Non traduit » sur une entrée sans titre AR', () => {
    wrap(<GuideThemeSection locale="fr" group={GROUP} defaultOpen />);
    expect(screen.getByText('Non traduit')).toBeDefined();
  });

  it('utilise un <details> natif (clavier/Escape gratuits)', () => {
    const { container } = wrap(<GuideThemeSection locale="fr" group={GROUP} />);
    expect(container.querySelector('details')).not.toBeNull();
    expect(container.querySelector('summary')).not.toBeNull();
  });
});

describe('GuideSearchResults', () => {
  const HITS: GuideSearchHit[] = [
    {
      slug: 'code-portail-principal',
      themeKey: 'codes_portails',
      title: 'Code du portail',
      snippet: 'Le <mark>code</mark> du portail principal est 1234',
      rank: 0.8,
    },
  ];

  it('rend les résultats classés avec snippet surligné (<mark>)', () => {
    const { container } = wrap(<GuideSearchResults locale="fr" hits={HITS} />);
    const link = screen.getByRole('link', { name: /Code du portail/ });
    expect(link.getAttribute('href')).toBe('/fr/community/guide/code-portail-principal');
    expect(container.querySelector('mark')?.textContent).toBe('code');
  });

  it('affiche l’état vide quand aucun résultat', () => {
    wrap(<GuideSearchResults locale="fr" hits={[]} />);
    expect(screen.getByText('Aucun résultat. Essaie un autre mot-clé.')).toBeDefined();
  });
});
