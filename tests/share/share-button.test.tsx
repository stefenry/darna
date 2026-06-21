// Story 6.2 — ShareButton : partage natif si dispo, sinon presse-papier + toast.
// Compteur incrémenté au succès, JAMAIS si l'utilisateur annule (AbortError).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';

const { recordShareMock } = vi.hoisted(() => ({
  recordShareMock: vi.fn(() => Promise.resolve({ ok: true })),
}));
vi.mock('@/app/actions/record-share', () => ({ recordShare: recordShareMock }));

import { ShareButton } from '@/components/content/share-button';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function setNavigator(props: Record<string, unknown>) {
  for (const [k, v] of Object.entries(props)) {
    Object.defineProperty(navigator, k, { value: v, configurable: true });
  }
}

afterEach(() => {
  recordShareMock.mockClear();
  // Nettoie navigator.share entre les tests.
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
});

const PROPS = {
  kind: 'artisan' as const,
  id: 'art-1',
  url: 'http://localhost:3000/artisan/hassan',
  title: 'Hassan',
  text: 'Plombier',
};

describe('ShareButton', () => {
  it('partage natif : navigator.share appelé + compteur incrémenté', async () => {
    const shareSpy = vi.fn(() => Promise.resolve());
    setNavigator({ share: shareSpy });
    wrap(<ShareButton {...PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: /Partager/ }));

    await waitFor(() =>
      expect(shareSpy).toHaveBeenCalledWith({
        title: 'Hassan',
        text: 'Plombier',
        url: PROPS.url,
      }),
    );
    await waitFor(() => expect(recordShareMock).toHaveBeenCalledWith('artisan', 'art-1'));
  });

  it('repli presse-papier : toast « Lien copié » + compteur incrémenté', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    setNavigator({ share: undefined, clipboard: { writeText } });
    wrap(<ShareButton {...PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: /Partager/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PROPS.url));
    expect(await screen.findByText('Lien copié')).toBeDefined();
    await waitFor(() => expect(recordShareMock).toHaveBeenCalledTimes(1));
  });

  it('annulation native (AbortError) : compteur NON incrémenté', async () => {
    const shareSpy = vi.fn(() =>
      Promise.reject(Object.assign(new Error('cancel'), { name: 'AbortError' })),
    );
    setNavigator({ share: shareSpy });
    wrap(<ShareButton {...PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: /Partager/ }));

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    // Laisse les microtasks se vider, puis vérifie l'absence de comptage.
    await new Promise((r) => setTimeout(r, 0));
    expect(recordShareMock).not.toHaveBeenCalled();
  });
});
