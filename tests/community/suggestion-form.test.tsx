// Chantier identité — la case « Signer avec mon nom » reflète la préférence de
// profil et part bien dans le FormData sous le nom `signed`.

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/[locale]/community/profil/parametres/suggestion/actions', () => ({
  submitSuggestion: vi.fn(async () => ({ ok: true })),
}));

import { SuggestionForm } from '@/app/[locale]/community/profil/parametres/suggestion/_components/suggestion-form';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('SuggestionForm — choix anonyme/signé', () => {
  it('case décochée par défaut quand le profil est en pseudo', () => {
    wrap(<SuggestionForm defaultSigned={false} />);
    const box = screen.getByRole('checkbox', { name: /Signer avec mon nom/ }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box.name).toBe('signed');
  });

  it('case pré-cochée quand le profil est en identité affichée', () => {
    wrap(<SuggestionForm defaultSigned />);
    const box = screen.getByRole('checkbox', { name: /Signer avec mon nom/ }) as HTMLInputElement;
    expect(box.checked).toBe(true);
  });

  it('explique ce que verront les co-mods', () => {
    wrap(<SuggestionForm defaultSigned={false} />);
    expect(screen.getByText(/Les co-mods verront ton nom et ta villa/)).toBeDefined();
  });
});
