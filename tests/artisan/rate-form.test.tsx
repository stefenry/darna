// Story 2.6 — test de rendu du form de notation : 4 axes, gate « ≥ 1 axe ».
// Le Server Action est mocké (le flux post-soumission `useActionState` → E2E).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/app/[locale]/community/artisan/[slug]/noter/actions', () => ({
  submitRating: vi.fn(async () => ({ ok: false, idle: true })),
  retractOwnRating: vi.fn(async () => ({ ok: false, idle: true })),
  retractOwnComment: vi.fn(async () => ({ ok: false, idle: true })),
  RATING_INITIAL: { ok: false, idle: true },
  RETRACT_RATING_INITIAL: { ok: false, idle: true },
}));

import { RateForm } from '@/app/[locale]/community/artisan/[slug]/noter/_components/rate-form';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('RateForm', () => {
  it('affiche les 4 axes typés', () => {
    wrap(
      <RateForm locale="fr" slug="hassan" existingRating={null} defaultVisibility="pseudonym" />,
    );
    expect(screen.getByText('Dépannage')).toBeDefined();
    expect(screen.getByText('Petits travaux')).toBeDefined();
    expect(screen.getByText('Travail soigné')).toBeDefined();
    expect(screen.getByText('Urgences')).toBeDefined();
  });

  it('gate « ≥ 1 axe » : submit désactivé tant qu’aucun axe n’est noté', () => {
    wrap(
      <RateForm locale="fr" slug="hassan" existingRating={null} defaultVisibility="pseudonym" />,
    );
    const submit = screen.getByRole('button', { name: 'Publier ma note' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const stars = screen.getAllByRole('radio');
    fireEvent.click(stars[0]!);
    expect(submit.disabled).toBe(false);
  });

  it('CTA « Mettre à jour » si une note existe déjà', () => {
    wrap(
      <RateForm
        locale="fr"
        slug="hassan"
        existingRating={{
          id: 'r1',
          score_depannage: 4,
          score_petits_travaux: null,
          score_travail_soigne: null,
          score_urgences: null,
          comment_text: null,
          visibility: 'pseudonym',
        }}
        defaultVisibility="pseudonym"
      />,
    );
    expect(screen.getByRole('button', { name: 'Mettre à jour' })).toBeDefined();
  });
});
