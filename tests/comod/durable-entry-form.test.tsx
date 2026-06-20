// Story 3.5 (Task 6 / AC2/AC3) — rendu de l'éditeur bilingue générique : champs
// FR/AR + preview Markdown, CTA disabled tant que FR incomplet. Action + router mockés.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/app/[locale]/comod/admin/_actions/durable-content', () => ({
  saveDurableEntry: vi.fn(async () => ({ ok: true })),
  DURABLE_INITIAL: { ok: true },
}));

import { DurableEntryForm } from '@/app/[locale]/comod/admin/_components/durable-entry-form';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('DurableEntryForm — Guide', () => {
  it('rend les éditeurs FR/AR Markdown + sélecteur de thème + preview', () => {
    const { container } = wrap(<DurableEntryForm kind="guide" mode="create" locale="fr" />);
    // 1 textarea FR + 1 textarea AR.
    expect(container.querySelectorAll('textarea').length).toBe(2);
    // Sélecteur de thème (option « Codes portails »).
    expect(screen.getByRole('option', { name: 'Codes portails' })).toBeDefined();
  });

  it('CTA « Enregistrer » disabled tant que FR (titre + corps) incomplet', () => {
    const { container } = wrap(<DurableEntryForm kind="guide" mode="create" locale="fr" />);
    const save = screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    const titleFr = container.querySelector('input[name="title_fr"]') as HTMLInputElement;
    const bodyFr = container.querySelector(
      'textarea[name="body_fr_markdown"]',
    ) as HTMLTextAreaElement;
    fireEvent.change(titleFr, { target: { value: 'Code portail' } });
    fireEvent.change(bodyFr, { target: { value: 'Le code est **1234**.' } });
    expect(save.disabled).toBe(false);
  });

  it('la preview rend le Markdown saisi en FR', () => {
    const { container } = wrap(<DurableEntryForm kind="guide" mode="create" locale="fr" />);
    const bodyFr = container.querySelector(
      'textarea[name="body_fr_markdown"]',
    ) as HTMLTextAreaElement;
    fireEvent.change(bodyFr, { target: { value: '# Titre preview' } });
    expect(screen.getByRole('heading', { name: 'Titre preview' })).toBeDefined();
  });
});

describe('DurableEntryForm — Numéros', () => {
  it('rend le champ téléphone (pas de textarea Markdown)', () => {
    const { container } = wrap(<DurableEntryForm kind="numeros" mode="create" locale="fr" />);
    expect(container.querySelector('input[name="phone_e164"]')).not.toBeNull();
    expect(container.querySelectorAll('textarea').length).toBe(0);
    expect(screen.getByRole('option', { name: 'Sécurité' })).toBeDefined();
  });
});
