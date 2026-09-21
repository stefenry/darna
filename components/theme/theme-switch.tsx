'use client';

// Refonte 2026-09 — choix du thème dans le profil : Système / Clair / Sombre.
// Groupe de boutons radio natifs (clavier et lecteur d'écran gratuits), habillé
// en contrôle segmenté. Le choix est local à l'appareil (localStorage), pas au
// compte : un téléphone sombre et un ordinateur clair restent possibles.

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';

const OPTIONS: { value: 'system' | 'light' | 'dark'; Icon: LucideIcon }[] = [
  { value: 'system', Icon: Monitor },
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
];

type Labels = { legend: string; hint: string; system: string; light: string; dark: string };

const noop = () => () => {};

export function ThemeSwitch({ labels }: { labels: Labels }) {
  const { theme, setTheme } = useTheme();
  // Le thème choisi n'est connu que côté client (localStorage) : avant
  // l'hydratation, aucune option n'est cochée plutôt qu'une option fausse.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const current = mounted ? (theme ?? 'system') : null;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-neutral-900">{labels.legend}</legend>
      <div className="grid grid-cols-3 gap-1 rounded bg-bg-soft p-1">
        {OPTIONS.map(({ value, Icon }) => (
          <label
            key={value}
            className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-2 text-sm font-semibold text-neutral-500 motion-safe:transition-colors has-[:checked]:bg-bg-card has-[:checked]:text-neutral-900 has-[:checked]:shadow-xs has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-500"
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={current === value}
              onChange={() => setTheme(value)}
              className="sr-only"
            />
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{labels[value]}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-neutral-500">{labels.hint}</p>
    </fieldset>
  );
}
