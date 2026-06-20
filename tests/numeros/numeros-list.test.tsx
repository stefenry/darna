// Story 3.3 (AC1/AC2/AC3/AC6) — rendu carte numéro : label, lien tel:, note
// contextuelle (+ fallback FR géré au data layer), bouton appel ≥ 56px, garde
// E.164. Rendu réel sous NextIntlClientProvider + fr.json.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';
import { NumberCard } from '@/app/[locale]/community/numeros-utiles/_components/number-card';
import { CallButton } from '@/components/content/call-button';
import type { UsefulNumber } from '@/app/[locale]/community/numeros-utiles/data';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const NUMBER: UsefulNumber = {
  id: 'n1',
  categoryKey: 'securite',
  label: 'Poste de garde',
  phoneE164: '+212600000001',
  notes: '24/7',
};

describe('NumberCard', () => {
  it('affiche label, numéro (dir=ltr), note et lien tel:', () => {
    const { container } = wrap(<NumberCard number={NUMBER} />);
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Poste de garde');
    expect(screen.getByText('24/7')).toBeDefined();
    const link = screen.getByRole('link', { name: 'Appeler Poste de garde' });
    expect(link.getAttribute('href')).toBe('tel:+212600000001');
    // Numéro affiché en dir="ltr" même en RTL (D3).
    expect(container.querySelector('[dir="ltr"]')).not.toBeNull();
  });

  it('omet la note quand absente', () => {
    wrap(<NumberCard number={{ ...NUMBER, notes: null }} />);
    expect(screen.queryByText('24/7')).toBeNull();
  });
});

describe('CallButton (partagé, inline)', () => {
  it('cible tactile ≥ 56px (min-h-touch-lg)', () => {
    wrap(
      <CallButton
        phoneE164="+212600000001"
        label="Appeler"
        ariaLabel="Appeler Poste de garde"
        unavailableLabel="Numéro indisponible"
        variant="inline"
      />,
    );
    const link = screen.getByRole('link', { name: 'Appeler Poste de garde' });
    expect(link.className).toContain('min-h-touch-lg');
  });

  it("refuse un numéro non E.164 (DTMF) et affiche l'indisponibilité", () => {
    wrap(
      <CallButton
        phoneE164="+212600000001,1234#"
        label="Appeler"
        unavailableLabel="Numéro indisponible"
        variant="inline"
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Numéro indisponible')).toBeDefined();
  });
});
