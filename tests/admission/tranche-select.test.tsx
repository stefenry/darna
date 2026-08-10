// 2026-08-08 — le `<select>` des tranches, rendu réellement.
//
// L'enjeu n'est pas cosmétique : la tranche de recette s'AFFICHE « T (Test) »
// mais doit se SOUMETTRE `T`. Confondre les deux écrirait « T (Test) » en base et
// violerait le CHECK posé par la migration 20260808120000. Ce test sépare donc
// explicitement `option.value` de `option.textContent`.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import frMessages from '@/messages/fr.json';
import { TRANCHES, TEST_TRANCHE } from '@/lib/validation/admission';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/app/actions/admission-submit', () => ({
  submitAdmissionRequest: vi.fn(async () => ({ ok: false })),
}));

import { AdmissionForm } from '@/app/[locale]/(public)/admission/admission-form';

function wrap(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={frMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function trancheOptions(): HTMLOptionElement[] {
  const select = screen.getByRole('combobox') as HTMLSelectElement;
  return [...select.options].filter((o) => o.value !== '');
}

describe('select des tranches (admission)', () => {
  it('soumet exactement les valeurs de zTranche', () => {
    wrap(<AdmissionForm locale="fr" cguHref="/fr/legal/cgu" />);
    expect(trancheOptions().map((o) => o.value)).toEqual([...TRANCHES]);
  });

  it('affiche « T (Test) » pour la tranche de recette, mais soumet « T »', () => {
    wrap(<AdmissionForm locale="fr" cguHref="/fr/legal/cgu" />);
    const test = trancheOptions().find((o) => o.value === TEST_TRANCHE);
    expect(test, 'la tranche de test doit être proposée').toBeDefined();
    expect(test!.value).toBe('T');
    expect(test!.textContent?.trim()).toBe('T (Test)');
  });

  it('laisse les tranches réelles sans libellé décoratif', () => {
    wrap(<AdmissionForm locale="fr" cguHref="/fr/legal/cgu" />);
    for (const o of trancheOptions().filter((x) => x.value !== TEST_TRANCHE)) {
      expect(o.textContent?.trim()).toBe(o.value);
    }
  });

  it('ne propose plus les anciennes lettres', () => {
    wrap(<AdmissionForm locale="fr" cguHref="/fr/legal/cgu" />);
    const values = trancheOptions().map((o) => o.value);
    for (const ancienne of ['A', 'B', 'C', 'D', 'E']) {
      expect(values).not.toContain(ancienne);
    }
  });
});
