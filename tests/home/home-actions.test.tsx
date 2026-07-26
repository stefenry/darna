// Chantier accueil (2026-07-26) — les trois états du CTA principal et la
// visibilité du lien de connexion.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';
import { HomeActions } from '@/app/[locale]/(public)/_components/home-actions';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('HomeActions', () => {
  it('anonyme : demander l’accès + lien de connexion visible', () => {
    wrap(<HomeActions locale="fr" cta={{ kind: 'apply' }} signedIn={false} />);
    expect(screen.getByRole('link', { name: "Demander l'accès" }).getAttribute('href')).toBe(
      '/fr/admission',
    );
    expect(screen.getByRole('link', { name: 'Me connecter' }).getAttribute('href')).toBe(
      '/fr/auth/login',
    );
  });

  it('résident : « Entrer dans Darna » vers sa destination, sans lien de connexion', () => {
    wrap(<HomeActions locale="fr" cta={{ kind: 'enter', href: '/fr/community/' }} signedIn />);
    // next/link normalise le slash final renvoyé par resolveRedirect
    // (`/fr/community/` → `/fr/community`) : une redirection de moins au clic.
    expect(screen.getByRole('link', { name: 'Entrer dans Darna' }).getAttribute('href')).toBe(
      '/fr/community',
    );
    expect(screen.queryByRole('link', { name: 'Me connecter' })).toBeNull();
    expect(screen.queryByRole('link', { name: "Demander l'accès" })).toBeNull();
  });

  it('demande en attente : « Voir ma demande d’accès »', () => {
    wrap(
      <HomeActions locale="fr" cta={{ kind: 'pending', href: '/fr/admission/pending' }} signedIn />,
    );
    expect(screen.getByRole('link', { name: "Voir ma demande d'accès" }).getAttribute('href')).toBe(
      '/fr/admission/pending',
    );
  });

  it('connecté sans demande : demander l’accès, mais pas de lien de connexion', () => {
    wrap(<HomeActions locale="fr" cta={{ kind: 'apply' }} signedIn />);
    expect(screen.getByRole('link', { name: "Demander l'accès" })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Me connecter' })).toBeNull();
  });

  it('bouton d’installation masqué quand l’app tourne en mode installé', () => {
    wrap(<HomeActions locale="fr" cta={{ kind: 'apply' }} signedIn={false} />);
    const install = screen.getByRole('link', { name: "Installer l'app" });
    expect(install.className).toContain('display-mode:standalone');
  });

  it('cibles tactiles : tous les liens d’action ont min-h-touch', () => {
    wrap(<HomeActions locale="fr" cta={{ kind: 'apply' }} signedIn={false} />);
    for (const name of ["Demander l'accès", "Installer l'app"]) {
      expect(screen.getByRole('link', { name }).className).toContain('min-h-touch');
    }
  });
});
