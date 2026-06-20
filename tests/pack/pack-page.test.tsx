// Story 3.4 (AC2/AC5) — section Pack : dépliable (`<details>`), entrées rendues
// en Markdown (deep-links Guide), badge « Non traduit » si AR absent.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';
import { PackSection } from '@/app/[locale]/community/guide/pack-accueil/_components/pack-section';
import type { PackSection as PackSectionData } from '@/app/[locale]/community/guide/pack-accueil/data';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const SECTION: PackSectionData = {
  sectionKey: 'Codes portails',
  entries: [
    {
      title: 'Portail principal',
      body: 'Voir [le code dans le Guide](/fr/community/guide/code-portail).',
      untranslated: false,
    },
    { title: 'Piscine', body: 'Code piscine indisponible.', untranslated: true },
  ],
};

describe('PackSection', () => {
  it('rend le titre de section et les entrées en <details>', () => {
    const { container } = wrap(<PackSection section={SECTION} defaultOpen />);
    expect(container.querySelector('details')).not.toBeNull();
    expect(screen.getByText('Codes portails')).toBeDefined();
    expect(screen.getByRole('heading', { level: 3, name: 'Portail principal' })).toBeDefined();
  });

  it('rend les deep-links Guide du corps Markdown', () => {
    wrap(<PackSection section={SECTION} defaultOpen />);
    const link = screen.getByRole('link', { name: 'le code dans le Guide' });
    expect(link.getAttribute('href')).toBe('/fr/community/guide/code-portail');
  });

  it('affiche le badge « Non traduit » sur une entrée sans corps AR', () => {
    wrap(<PackSection section={SECTION} defaultOpen />);
    expect(screen.getByText('Non traduit')).toBeDefined();
  });
});
