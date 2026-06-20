// Story 3.4 (AC1/AC3/AC5) — bannière Pack : rendu + dismiss optimiste (masquage
// local + appel Server Action). Action mockée (jsdom n'exécute pas le flux serveur).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';

const dismissMock = vi.fn();
vi.mock('@/app/[locale]/community/_actions/onboarding', () => ({
  dismissPackBanner: () => dismissMock(),
}));

import { PackBanner } from '@/app/[locale]/community/_components/pack-banner';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('PackBanner', () => {
  beforeEach(() => dismissMock.mockReset());

  it('affiche titre, CTA vers le Pack et bouton fermer', () => {
    wrap(<PackBanner locale="fr" />);
    expect(screen.getByText('Bienvenue à Darna !')).toBeDefined();
    const cta = screen.getByRole('link', { name: 'Découvrir le Pack accueil' });
    expect(cta.getAttribute('href')).toBe('/fr/community/guide/pack-accueil');
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeDefined();
  });

  it('le tap ✕ masque la bannière et appelle dismissPackBanner', () => {
    wrap(<PackBanner locale="fr" />);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(dismissMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Bienvenue à Darna !')).toBeNull();
  });

  it("« Plus tard » masque aussi et appelle l'action", () => {
    wrap(<PackBanner locale="fr" />);
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(dismissMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Bienvenue à Darna !')).toBeNull();
  });
});
