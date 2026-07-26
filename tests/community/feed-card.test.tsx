// Chantier « alertes / bons plans séparés » (2026-07-26) — la carte de flux est
// désormais partagée par deux listes HOMOGÈNES : plus de badge de type, mais un
// href et un pied de carte qui dépendent toujours du `kind`.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';
import { FeedCard, type FeedItem } from '@/app/[locale]/community/_components/feed-card';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const IN_THREE_DAYS = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();

const ALERT: FeedItem = {
  kind: 'alert',
  id: 'a1',
  slug: 'coupure-eau',
  title: 'Coupure d’eau tranche B',
  untranslated: false,
  createdAt: '2026-07-26T08:00:00Z',
  expiresAt: IN_THREE_DAYS,
  category: null,
  authorName: null,
  authorPseudonymSuffix: null,
};

const TIP: FeedItem = {
  kind: 'tip',
  id: 't1',
  slug: 'perceuse-a-preter',
  title: 'Perceuse à prêter',
  untranslated: false,
  createdAt: '2026-07-26T09:00:00Z',
  expiresAt: IN_THREE_DAYS,
  category: 'pret_objet',
  authorName: 'Nora',
  authorPseudonymSuffix: null,
};

describe('FeedCard', () => {
  it('alerte → lien vers la fiche alerte', () => {
    wrap(<FeedCard item={ALERT} locale="fr" />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/fr/community/alertes/coupure-eau');
    expect(screen.getByText('Coupure d’eau tranche B')).toBeDefined();
  });

  it('bon plan → lien vers la fiche bon plan', () => {
    wrap(<FeedCard item={TIP} locale="fr" />);
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      '/fr/community/bons-plans/perceuse-a-preter',
    );
  });

  it('plus de badge de type : les listes sont homogènes', () => {
    wrap(<FeedCard item={ALERT} locale="fr" />);
    expect(screen.queryByText('Alerte')).toBeNull();
    wrap(<FeedCard item={TIP} locale="fr" />);
    expect(screen.queryByText('Bon plan')).toBeNull();
  });

  it('bon plan : badge catégorie et auteur affichés', () => {
    wrap(<FeedCard item={TIP} locale="fr" />);
    expect(screen.getByText("Prêt d'objet")).toBeDefined();
    expect(screen.getByText(/Par Nora/)).toBeDefined();
  });

  it('bon plan sans nom → pseudonyme stable', () => {
    wrap(
      <FeedCard item={{ ...TIP, authorName: null, authorPseudonymSuffix: 'A3F2' }} locale="fr" />,
    );
    expect(screen.getByText(/Voisin anonyme #A3F2/)).toBeDefined();
  });

  it('bon plan dont l’auteur a été purgé → « Voisin supprimé »', () => {
    wrap(<FeedCard item={{ ...TIP, authorName: null, authorPseudonymSuffix: null }} locale="fr" />);
    expect(screen.getByText(/Voisin supprimé/)).toBeDefined();
  });

  it('alerte : jamais d’auteur (choix produit)', () => {
    wrap(<FeedCard item={ALERT} locale="fr" />);
    expect(screen.queryByText(/Par /)).toBeNull();
  });

  it('contenu non traduit → badge dédié', () => {
    wrap(<FeedCard item={{ ...ALERT, untranslated: true }} locale="fr" />);
    expect(screen.getByText('Non traduit')).toBeDefined();
  });
});
