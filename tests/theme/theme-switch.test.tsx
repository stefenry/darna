import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const setTheme = vi.fn();
let theme: string | undefined = 'system';
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme, setTheme }),
}));

import { ThemeSwitch } from '@/components/theme/theme-switch';

const LABELS = {
  legend: 'Apparence',
  hint: 'Ce choix est enregistré sur cet appareil.',
  system: 'Système',
  light: 'Clair',
  dark: 'Sombre',
};

describe('ThemeSwitch', () => {
  beforeEach(() => {
    setTheme.mockClear();
    theme = 'system';
  });

  it('trois options radio, « Système » cochée par défaut', () => {
    render(<ThemeSwitch labels={LABELS} />);
    expect(screen.getByRole('group', { name: 'Apparence' })).toBeDefined();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect((screen.getByRole('radio', { name: 'Système' }) as HTMLInputElement).checked).toBe(true);
  });

  it('choisir « Sombre » appelle setTheme("dark")', () => {
    render(<ThemeSwitch labels={LABELS} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Sombre' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('reflète un thème forcé', () => {
    theme = 'light';
    render(<ThemeSwitch labels={LABELS} />);
    expect((screen.getByRole('radio', { name: 'Clair' }) as HTMLInputElement).checked).toBe(true);
  });
});
