'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { updateProfileSettings } from '../actions';

type Props = {
  initialIdentityMode: 'pseudo' | 'identified';
  initialLanguage: 'fr' | 'ar';
};

// D7 — pas de @radix-ui/react-switch (non installé) : la visibilité est un
// <Checkbox> Radix existant (coché = identité visible).
export function SettingsForm({ initialIdentityMode, initialLanguage }: Props) {
  const t = useTranslations('profil.settings');
  const tErr = useTranslations('errors.profil');
  const router = useRouter();
  const [identified, setIdentified] = useState(initialIdentityMode === 'identified');
  const [language, setLanguage] = useState<'fr' | 'ar'>(initialLanguage);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(nextIdentified: boolean, nextLanguage: 'fr' | 'ar') {
    if (isPending) return; // Évite 2 appels concurrents si l'user change vite
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const res = await updateProfileSettings({
        identity_mode: nextIdentified ? 'identified' : 'pseudo',
        language: nextLanguage,
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        const errKey = res.message_key.startsWith('errors.profil.')
          ? res.message_key.replace('errors.profil.', '')
          : 'forbidden';
        setError(tErr(errKey));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <Checkbox
          id="identity"
          checked={identified}
          disabled={isPending}
          onCheckedChange={(value) => {
            const next = value === true;
            setIdentified(next);
            save(next, language);
          }}
        />
        <label htmlFor="identity" className="text-sm text-neutral-700">
          {t('visibilityToggleLabel')}
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-neutral-900">{t('languageLabel')}</span>
        <select
          name="language"
          value={language}
          disabled={isPending}
          onChange={(e) => {
            const next = e.target.value === 'ar' ? 'ar' : 'fr';
            setLanguage(next);
            save(identified, next);
          }}
          className="min-h-touch rounded-[14px] border border-neutral-300 bg-bg-card px-4 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
        >
          <option value="fr">Français</option>
          <option value="ar">العربية</option>
        </select>
      </label>

      <div aria-live="polite" className="min-h-5 text-sm">
        {saved && <span className="text-accent-600">{t('saved')}</span>}
        {error && (
          <span role="alert" className="text-danger">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
