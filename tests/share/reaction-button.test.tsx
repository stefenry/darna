// Story 6.4 — ReactionButton : optimistic toggle, compte 0 masqué, aria-pressed,
// réconciliation serveur. Aucun 👎.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';

const { toggleMock } = vi.hoisted(() => ({ toggleMock: vi.fn() }));
vi.mock('@/app/actions/toggle-reaction', () => ({ toggleReaction: toggleMock }));

import { ReactionButton } from '@/components/content/reaction-button';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

afterEach(() => toggleMock.mockReset());

describe('ReactionButton', () => {
  it('compte 0 → bouton 👍 sans chiffre, aria-pressed=false', () => {
    wrap(
      <ReactionButton targetType="alert" targetId="a1" initialCount={0} initialReacted={false} />,
    );
    const btn = screen.getByRole('button', { name: 'J’aime' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.textContent?.trim()).toBe('');
  });

  it('tap : incrément optimiste puis réconciliation serveur', async () => {
    toggleMock.mockResolvedValue({ ok: true, reacted: true, count: 12 });
    wrap(
      <ReactionButton targetType="tip" targetId="t1" initialCount={11} initialReacted={false} />,
    );
    const btn = screen.getByRole('button', { name: 'J’aime' });
    fireEvent.click(btn);
    // Optimiste immédiat : 12.
    expect(btn.textContent).toContain('12');
    await waitFor(() => expect(toggleMock).toHaveBeenCalledWith('tip', 't1'));
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('toggle off : 2e tap décrémente', async () => {
    toggleMock.mockResolvedValue({ ok: true, reacted: false, count: 2 });
    wrap(<ReactionButton targetType="tip" targetId="t1" initialCount={3} initialReacted={true} />);
    const btn = screen.getByRole('button', { name: 'J’aime' });
    fireEvent.click(btn);
    expect(btn.textContent).toContain('2');
    await waitFor(() => expect(btn.getAttribute('aria-pressed')).toBe('false'));
  });

  it('échec serveur → revert', async () => {
    toggleMock.mockResolvedValue({ ok: false });
    wrap(
      <ReactionButton targetType="alert" targetId="a1" initialCount={5} initialReacted={false} />,
    );
    const btn = screen.getByRole('button', { name: 'J’aime' });
    fireEvent.click(btn);
    await waitFor(() => expect(btn.textContent).toContain('5'));
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });
});
