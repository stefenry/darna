// Story 2.2 (AC1/AC6/AC7) — tests composants annuaire : carte, jauge, empty.
// Rendu réel sous NextIntlClientProvider + fr.json (ICU pluriels formatés).

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';
import {
  ArtisanCard,
  type ArtisanCardData,
} from '@/app/[locale]/community/annuaire/_components/artisan-card';
import { RatingGauge } from '@/app/[locale]/community/annuaire/_components/rating-gauge';
import { EmptyState } from '@/app/[locale]/community/annuaire/_components/empty-state';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const ARTISAN: ArtisanCardData = {
  slug: 'hassan-plombier',
  displayName: 'Hassan Plombier',
  priceRelative: '$$',
  hasInvoice: 'oui',
  phoneE164: '+212600000001',
  primaryTagKey: 'plomberie',
  primaryTagLabel: 'Plomberie',
  axes: [
    { axis: 'depannage', average: 4.5, count: 4 },
    { axis: 'petits-travaux', average: 3, count: 1 },
    { axis: 'travail-soigne', average: 5, count: 2 },
    { axis: 'urgences', average: null, count: 0 },
  ],
};

describe('ArtisanCard', () => {
  it('affiche nom, prix, tag et badge facture', () => {
    wrap(<ArtisanCard locale="fr" artisan={ARTISAN} />);
    expect(screen.getByText('Hassan Plombier')).toBeDefined();
    expect(screen.getByText('$$')).toBeDefined();
    expect(screen.getByText('Plomberie')).toBeDefined();
    expect(screen.getByText('Facture émise')).toBeDefined();
  });

  it('affiche les 4 axes, ordre canonique, libellés courts (refonte 2026-09)', () => {
    wrap(<ArtisanCard locale="fr" artisan={ARTISAN} />);
    const meters = screen.getAllByRole('meter');
    expect(meters).toHaveLength(4);
    const labels = meters.map(
      (m) => within(m).getByText(/Dépannage|Soigné|Petits trav\.|Urgences/).textContent,
    );
    expect(labels).toEqual(['Dépannage', 'Petits trav.', 'Soigné', 'Urgences']);
    // Le libellé complet et les voix restent dans le nom accessible.
    expect(meters[2]?.getAttribute('aria-valuetext')).toBe(
      '5.0 sur 5 sur Travail soigné, 2 voisins',
    );
  });

  it('nombre d’avis = axe le plus noté (pas de total dans l’agrégat)', () => {
    wrap(<ArtisanCard locale="fr" artisan={ARTISAN} />);
    expect(screen.getByText('4 avis')).toBeDefined();
  });

  it('lien fiche (sans préfixe tel) + lien d’appel tel: séparés', () => {
    wrap(<ArtisanCard locale="fr" artisan={ARTISAN} />);
    const fiche = screen.getByRole('link', { name: 'Voir la fiche de Hassan Plombier' });
    expect(fiche.getAttribute('href')).toBe('/fr/community/artisan/hassan-plombier');
    const call = screen.getByRole('link', { name: 'Appeler Hassan Plombier' });
    expect(call.getAttribute('href')).toBe('tel:+212600000001');
  });

  it('facture sur_demande → libellé dédié, non → rien', () => {
    wrap(<ArtisanCard locale="fr" artisan={{ ...ARTISAN, hasInvoice: 'sur_demande' }} />);
    expect(screen.getByText('Facture sur demande')).toBeDefined();
  });

  it('bouton d’appel dans l’en-tête, à côté du nom', () => {
    wrap(<ArtisanCard locale="fr" artisan={ARTISAN} />);
    const call = screen.getByRole('link', { name: 'Appeler Hassan Plombier' });
    const header = call.closest('header');
    expect(header).not.toBeNull();
    // Le nom et le bouton partagent la même rangée.
    expect(within(header as HTMLElement).getByText('Hassan Plombier')).toBeDefined();
  });

  it('carte compacte : 2 rangées, plus de pied de carte', () => {
    const { container } = wrap(<ArtisanCard locale="fr" artisan={ARTISAN} />);
    const article = container.querySelector('article') as HTMLElement;
    // overlay + header (nom, meta, appel) + bandeau des axes.
    expect(article.querySelector('footer')).toBeNull();
    expect(article.querySelectorAll(':scope > *').length).toBe(3);
  });

  it('les 4 jauges partagent une seule rangée', () => {
    wrap(<ArtisanCard locale="fr" artisan={ARTISAN} />);
    const meters = screen.getAllByRole('meter');
    const row = meters[0]?.parentElement as HTMLElement;
    expect(row.className).toContain('flex');
    for (const m of meters) expect(m.parentElement).toBe(row);
  });

  it('prix et badge facture sur la même ligne meta que le métier', () => {
    wrap(<ArtisanCard locale="fr" artisan={ARTISAN} />);
    const meta = screen.getByText('Plomberie').closest('div') as HTMLElement;
    expect(within(meta).getByText('$$')).toBeDefined();
    expect(within(meta).getByText('Facture émise')).toBeDefined();
  });
});

describe('RatingGauge', () => {
  it('axe noté (fiche) : score + voix, meter renseigné', () => {
    wrap(<RatingGauge axis="depannage" average={4.5} count={4} variant="full" />);
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuenow')).toBe('4.5');
    expect(within(meter).getByText('Dépannage')).toBeDefined();
    expect(meter.textContent).toContain('4.5');
    expect(meter.textContent).toContain('4 voisins');
  });

  it('axe non noté (fiche) : score NA, aria-valuenow 0', () => {
    wrap(<RatingGauge axis="urgences" average={null} count={0} variant="full" />);
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuenow')).toBe('0');
    expect(within(meter).getByText('NA')).toBeDefined();
  });

  it('axe non noté (carte) : un blanc, pas de « NA »', () => {
    wrap(<RatingGauge axis="urgences" average={null} count={0} />);
    const meter = screen.getByRole('meter');
    expect(meter.textContent).not.toContain('NA');
    expect(meter.getAttribute('aria-valuetext')).toBe('Urgences non noté');
  });
});

describe('EmptyState', () => {
  it('titre contributif + CTA vers la création', () => {
    wrap(<EmptyState locale="fr" />);
    expect(screen.getByText('Aucun artisan correspondant')).toBeDefined();
    const cta = screen.getByRole('link', { name: 'Ajouter le tien ?' });
    expect(cta.getAttribute('href')).toBe('/fr/community/annuaire/nouveau');
  });
});
