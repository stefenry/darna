// Story 2.3 — tests composants fiche artisan : header, jauges full, avis, CTA
// appeler, panel contributeur. Rendu réel sous NextIntlClientProvider + fr.json.
// Étendu 2026-06-17 (review P10) : variantes hasInvoice, jauge NA, CTA tel:
// invalide, date invalide.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

vi.mock('@/app/actions/toggle-reaction', () => ({
  toggleReaction: vi.fn(() => Promise.resolve({ ok: true, reacted: true, count: 1 })),
}));
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';
import { ArtisanHeader } from '@/app/[locale]/community/artisan/[slug]/_components/artisan-header';
import { RatingGaugesFull } from '@/app/[locale]/community/artisan/[slug]/_components/rating-gauges-full';
import { CommentsList } from '@/app/[locale]/community/artisan/[slug]/_components/comments-list';
import { CallButton } from '@/app/[locale]/community/artisan/[slug]/_components/call-button';
import { ContributorPanel } from '@/app/[locale]/community/artisan/[slug]/_components/contributor-panel';
import type { ArtisanDetail, ArtisanComment } from '@/app/[locale]/community/artisan/[slug]/data';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const ARTISAN: ArtisanDetail = {
  id: 'a1',
  slug: 'hassan-plombier',
  displayName: 'Hassan Plombier',
  priceRelative: '$$',
  hasInvoice: 'oui',
  phoneE164: '+212600000001',
  tags: [
    { key: 'plomberie', label: 'Plomberie' },
    { key: 'climatisation', label: 'Climatisation' },
  ],
  axes: [
    { axis: 'depannage', average: 4.5, count: 4 },
    { axis: 'petits-travaux', average: 3, count: 1 },
    { axis: 'travail-soigne', average: 5, count: 2 },
    { axis: 'urgences', average: null, count: 0 },
  ],
  isOwner: false,
};

describe('ArtisanHeader', () => {
  it('affiche nom, prix, tous les tags et badge facture', () => {
    wrap(<ArtisanHeader locale="fr" artisan={ARTISAN} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hassan Plombier');
    expect(screen.getByText('$$')).toBeDefined();
    expect(screen.getByText('Plomberie')).toBeDefined();
    expect(screen.getByText('Climatisation')).toBeDefined();
    expect(screen.getByText('Facture émise')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Retour' }).getAttribute('href')).toBe(
      '/fr/community/annuaire',
    );
  });

  it('affiche le numéro de téléphone formaté MA', () => {
    wrap(<ArtisanHeader locale="fr" artisan={ARTISAN} />);
    expect(screen.getByText('+212 6 00 00 00 01')).toBeDefined();
  });

  it('hasInvoice=sur_demande → "Facture sur demande"', () => {
    wrap(<ArtisanHeader locale="fr" artisan={{ ...ARTISAN, hasInvoice: 'sur_demande' }} />);
    expect(screen.getByText('Facture sur demande')).toBeDefined();
    expect(screen.queryByText('Facture émise')).toBeNull();
  });

  it('hasInvoice=null → aucun badge facture', () => {
    wrap(<ArtisanHeader locale="fr" artisan={{ ...ARTISAN, hasInvoice: null }} />);
    expect(screen.queryByText('Facture émise')).toBeNull();
    expect(screen.queryByText('Facture sur demande')).toBeNull();
  });

  it('priceRelative=null → aucun badge prix', () => {
    wrap(<ArtisanHeader locale="fr" artisan={{ ...ARTISAN, priceRelative: null }} />);
    expect(screen.queryByText('$$')).toBeNull();
  });

  it('tags=[] → pas de section chips', () => {
    wrap(<ArtisanHeader locale="fr" artisan={{ ...ARTISAN, tags: [] }} />);
    expect(screen.queryByText('Plomberie')).toBeNull();
    expect(screen.queryByText('Climatisation')).toBeNull();
  });
});

describe('RatingGaugesFull', () => {
  it('affiche les 4 jauges (role=meter) dans l’ordre canonique', () => {
    wrap(<RatingGaugesFull axes={ARTISAN.axes} />);
    const meters = screen.getAllByRole('meter');
    expect(meters).toHaveLength(4);
    const labels = meters.map(
      (m) => within(m).getByText(/Dépannage|Petits travaux|Travail soigné|Urgences/).textContent,
    );
    expect(labels).toEqual(['Dépannage', 'Petits travaux', 'Travail soigné', 'Urgences']);
  });

  it('jauge `urgences` (count=0) affiche NA', () => {
    wrap(<RatingGaugesFull axes={ARTISAN.axes} />);
    const meters = screen.getAllByRole('meter');
    const urgences = meters.find((m) => within(m).queryByText('Urgences'));
    expect(urgences).toBeDefined();
    expect(within(urgences!).getByText('NA')).toBeDefined();
  });
});

describe('CallButton', () => {
  it('lien tel: direct, CTA ≥56px (min-h-touch-lg), libellé nommé', () => {
    wrap(<CallButton name="Hassan Plombier" phoneE164="+212600000001" />);
    const link = screen.getByRole('link', { name: /Appeler Hassan Plombier/ });
    expect(link.getAttribute('href')).toBe('tel:+212600000001');
    expect(link.className).toContain('min-h-touch-lg');
  });

  it('refuse de rendre un lien tel: pour un numéro invalide (DTMF/format)', () => {
    wrap(<CallButton name="Hassan" phoneE164="+212600000001,1234#" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Numéro indisponible')).toBeDefined();
  });

  it('refuse aussi un numéro vide ou non préfixé +', () => {
    wrap(<CallButton name="Hassan" phoneE164="" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Numéro indisponible')).toBeDefined();
  });
});

describe('CommentsList', () => {
  const NAMED: ArtisanComment = {
    id: 'c1',
    authorName: 'Yassine',
    pseudonymSuffix: null,
    scores: [
      { axis: 'depannage', value: 5 },
      { axis: 'urgences', value: 4 },
    ],
    commentText: 'Rapide et propre',
    createdAt: '2026-06-01T10:00:00Z',
    isOwn: false,
  };
  const ANON: ArtisanComment = {
    id: 'c2',
    authorName: null,
    pseudonymSuffix: 'A3F2',
    scores: [],
    commentText: 'Bon travail',
    createdAt: '2026-05-20T10:00:00Z',
    isOwn: false,
  };
  const DELETED: ArtisanComment = {
    id: 'c4',
    authorName: null,
    pseudonymSuffix: null,
    scores: [],
    commentText: 'Contributeur supprimé',
    createdAt: '2026-05-10T10:00:00Z',
    isOwn: false,
  };

  it('affiche nom si named, pseudonyme stable (FR16) sinon, « Voisin supprimé » si anonymisé', () => {
    wrap(<CommentsList locale="fr" comments={[NAMED, ANON, DELETED]} reactions={new Map()} />);
    expect(screen.getByText('Yassine')).toBeDefined();
    expect(screen.getByText('Voisin anonyme #A3F2')).toBeDefined();
    expect(screen.getByText('Voisin supprimé')).toBeDefined();
    expect(screen.getByText('Rapide et propre')).toBeDefined();
    expect(screen.getByText('Dépannage 5/5')).toBeDefined();
  });

  it('état vide', () => {
    wrap(<CommentsList locale="fr" comments={[]} reactions={new Map()} />);
    expect(screen.getByText('Aucun avis pour l’instant.')).toBeDefined();
  });

  it('createdAt invalide → pas de bloc <time>', () => {
    const BROKEN: ArtisanComment = { ...ANON, id: 'c3', createdAt: 'pas-une-date' };
    const { container } = wrap(
      <CommentsList locale="fr" comments={[BROKEN]} reactions={new Map()} />,
    );
    expect(container.querySelector('time')).toBeNull();
  });
});

describe('ContributorPanel', () => {
  it('rend les liens édition/retrait actifs (Story 2.7)', () => {
    wrap(<ContributorPanel locale="fr" slug="hassan" />);
    const edit = screen.getByRole('link', {
      name: 'Modifier ma contribution',
    }) as HTMLAnchorElement;
    const remove = screen.getByRole('link', { name: 'Retirer' }) as HTMLAnchorElement;
    expect(edit.getAttribute('href')).toBe('/fr/community/artisan/hassan/modifier');
    expect(remove.getAttribute('href')).toBe('/fr/community/artisan/hassan/modifier#retrait');
  });
});
