// Story 2.4 — test du formulaire de création : champs, gate CNDP.
// Le Server Action est mocké pour éviter d'importer le graphe server.
//
// Note : les états post-soumission (phone_duplicate UI, smsFailed warning,
// missing_residence) sont laissés en deferred — `useActionState` + dispatcher
// React 19 ne s'exercent pas proprement en jsdom sans `userEvent` ; ces flows
// sont validés en E2E (à câbler 1.10c/e2e).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';

vi.mock('@/app/[locale]/community/annuaire/nouveau/actions', () => ({
  createArtisan: vi.fn(async () => ({ ok: false, idle: true })),
  CREATE_ARTISAN_INITIAL: { ok: false, idle: true },
}));

import { CreateArtisanForm } from '@/app/[locale]/community/annuaire/nouveau/_components/create-artisan-form';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const TAGS = [
  { key: 'plomberie', label: 'Plomberie' },
  { key: 'electricite', label: 'Électricité' },
];

describe('CreateArtisanForm', () => {
  it('affiche les champs clés et les compétences', () => {
    wrap(<CreateArtisanForm locale="fr" tags={TAGS} />);
    expect(screen.getByText('Nom de l’artisan')).toBeDefined();
    expect(screen.getByText('Téléphone')).toBeDefined();
    expect(screen.getByText('Plomberie')).toBeDefined();
    expect(screen.getByText('Électricité')).toBeDefined();
  });

  it('gate CNDP : submit désactivé tant que la case n’est pas cochée', () => {
    wrap(<CreateArtisanForm locale="fr" tags={TAGS} />);
    const submit = screen.getByRole('button', { name: 'Envoyer la demande' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const consent = screen.getByLabelText(/Je confirme avoir prévenu l’artisan/);
    fireEvent.click(consent);
    expect(submit.disabled).toBe(false);
  });
});
