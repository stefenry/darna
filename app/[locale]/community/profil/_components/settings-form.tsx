'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter as useIntlRouter } from '@/lib/i18n/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { updateProfileSettings } from '../actions';

type Tranche = 'A' | 'B' | 'C' | 'D' | 'E';

type Props = {
  initialIdentityMode: 'pseudo' | 'identified';
  initialLanguage: 'fr' | 'ar';
  initialDisplayName: string;
  initialVilla: number | null;
  initialTranche: string | null;
};

const NAME_SAVE_DEBOUNCE_MS = 800;
const VILLA_SAVE_DEBOUNCE_MS = 600;
const TRANCHES: Tranche[] = ['A', 'B', 'C', 'D', 'E'];

function asTranche(v: string | null): Tranche | '' {
  return (TRANCHES as readonly string[]).includes(v ?? '') ? (v as Tranche) : '';
}

export function SettingsForm({
  initialIdentityMode,
  initialLanguage,
  initialDisplayName,
  initialVilla,
  initialTranche,
}: Props) {
  const t = useTranslations('profil.settings');
  const tErr = useTranslations('errors.profil');
  const router = useRouter();
  // Story 7.4 — navigation locale-aware : changer de langue déplace vers le
  // préfixe /fr ou /ar, ce qui re-rend le layout avec le bon dir/lang.
  const intlRouter = useIntlRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();
  const [identified, setIdentified] = useState(initialIdentityMode === 'identified');
  const [language, setLanguage] = useState<'fr' | 'ar'>(initialLanguage);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [savedDisplayName, setSavedDisplayName] = useState(initialDisplayName);
  const [villa, setVilla] = useState<string>(initialVilla != null ? String(initialVilla) : '');
  const [savedVilla, setSavedVilla] = useState<string>(
    initialVilla != null ? String(initialVilla) : '',
  );
  const [tranche, setTranche] = useState<Tranche | ''>(asTranche(initialTranche));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(
    nextIdentified: boolean,
    nextLanguage: 'fr' | 'ar',
    nextDisplayName?: string,
    navigateLocale?: 'fr' | 'ar',
    nextVilla?: number,
    nextTranche?: Tranche,
  ) {
    if (isPending) return;
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const res = await updateProfileSettings({
        identity_mode: nextIdentified ? 'identified' : 'pseudo',
        language: nextLanguage,
        ...(nextDisplayName !== undefined ? { display_name: nextDisplayName } : {}),
        ...(nextVilla !== undefined ? { villa: nextVilla } : {}),
        ...(nextTranche !== undefined ? { tranche: nextTranche } : {}),
      });
      if (res.ok) {
        setSaved(true);
        if (nextDisplayName !== undefined) setSavedDisplayName(nextDisplayName);
        if (nextVilla !== undefined) setSavedVilla(String(nextVilla));
        if (navigateLocale && navigateLocale !== currentLocale) {
          // Bascule de langue → recharge la page dans la nouvelle locale (dir/lang).
          intlRouter.replace(pathname, { locale: navigateLocale });
        } else {
          router.refresh();
        }
      } else {
        const errKey = res.message_key.startsWith('errors.profil.')
          ? res.message_key.replace('errors.profil.', '')
          : 'forbidden';
        setError(tErr(errKey));
      }
    });
  }

  // Debounce auto-save du prénom (le user tape, on ne flood pas le serveur).
  useEffect(() => {
    const trimmed = displayName.trim();
    if (trimmed === savedDisplayName.trim()) return;
    if (trimmed.length === 0) return;
    const timer = setTimeout(() => {
      save(identified, language, trimmed);
    }, NAME_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName]);

  // Debounce auto-save de la villa.
  useEffect(() => {
    if (villa.trim() === savedVilla.trim()) return;
    const n = Number(villa);
    if (!Number.isInteger(n) || n < 1 || n > 150) return;
    const timer = setTimeout(() => {
      save(identified, language, undefined, undefined, n);
    }, VILLA_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villa]);

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-neutral-900">{t('displayNameLabel')}</span>
        <input
          type="text"
          name="display_name"
          value={displayName}
          maxLength={50}
          disabled={isPending}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t('displayNamePlaceholder')}
          className="min-h-touch rounded-[14px] border border-neutral-300 bg-bg-card px-4 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
        />
        <span className="text-xs text-neutral-500">{t('displayNameHint')}</span>
      </label>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-neutral-900">{t('villaLabel')}</span>
          <input
            type="number"
            name="villa"
            min={1}
            max={150}
            inputMode="numeric"
            value={villa}
            disabled={isPending}
            onChange={(e) => setVilla(e.target.value)}
            placeholder="1–150"
            className="min-h-touch rounded-[14px] border border-neutral-300 bg-bg-card px-4 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-neutral-900">{t('trancheLabel')}</span>
          <select
            name="tranche"
            value={tranche}
            disabled={isPending}
            onChange={(e) => {
              const next = e.target.value as Tranche;
              if (TRANCHES.includes(next)) {
                setTranche(next);
                save(identified, language, undefined, undefined, undefined, next);
              }
            }}
            className="min-h-touch rounded-[14px] border border-neutral-300 bg-bg-card px-4 text-base text-neutral-900 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30"
          >
            <option value="" disabled>
              —
            </option>
            {TRANCHES.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>

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
            save(identified, next, undefined, next);
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
