'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { updateNotificationPrefs } from '../actions';

// Story 7.1 — 3 toggles indépendants (FR40). UI optimiste : on bascule l'état
// local immédiatement, on persiste en arrière-plan ; en cas d'échec serveur on
// revient à l'état précédent et on affiche l'erreur. Clavier (Radix Checkbox =
// Space pour toggle), RTL (logique flex), reduced-motion (aucune animation).
type Prefs = {
  alerts_urgentes_enabled: boolean;
  nouvelles_entrees_annuaire_enabled: boolean;
  activite_contributions_enabled: boolean;
};

type Category = keyof Prefs;

const CATEGORIES: { key: Category; labelKey: string; descKey: string }[] = [
  { key: 'alerts_urgentes_enabled', labelKey: 'alertsLabel', descKey: 'alertsDesc' },
  {
    key: 'nouvelles_entrees_annuaire_enabled',
    labelKey: 'directoryLabel',
    descKey: 'directoryDesc',
  },
  { key: 'activite_contributions_enabled', labelKey: 'activityLabel', descKey: 'activityDesc' },
];

export function NotificationPrefsForm({ initialPrefs }: { initialPrefs: Prefs }) {
  const t = useTranslations('profil.notifications');
  const tErr = useTranslations('errors.profil');
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(key: Category, value: boolean) {
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    // Optimistic : on reflète tout de suite la bascule.
    setPrefs(next);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const res = await updateNotificationPrefs(next);
      if (res.ok) {
        setSaved(true);
      } else {
        // Rollback : on restaure l'état d'avant la bascule.
        setPrefs(previous);
        const errKey = res.message_key.startsWith('errors.profil.')
          ? res.message_key.replace('errors.profil.', '')
          : 'forbidden';
        setError(tErr(errKey));
      }
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-neutral-900">{t('title')}</h2>
        <p className="text-sm text-neutral-500">{t('intro')}</p>
      </div>

      <ul className="flex flex-col gap-4">
        {CATEGORIES.map(({ key, labelKey, descKey }) => (
          <li key={key} className="flex items-start gap-3">
            <Checkbox
              id={`notif-${key}`}
              checked={prefs[key]}
              disabled={isPending}
              className="mt-0.5"
              onCheckedChange={(value) => toggle(key, value === true)}
            />
            <label htmlFor={`notif-${key}`} className="flex flex-col gap-0.5 text-sm">
              <span className="font-medium text-neutral-900">{t(labelKey)}</span>
              <span className="text-neutral-500">{t(descKey)}</span>
            </label>
          </li>
        ))}
      </ul>

      <div aria-live="polite" className="min-h-5 text-sm">
        {saved && <span className="text-accent-600">{t('saved')}</span>}
        {error && (
          <span role="alert" className="text-danger">
            {error}
          </span>
        )}
      </div>
    </section>
  );
}
