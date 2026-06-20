// Story 2.3 (AC2) — CTA primaire « Appeler » ≥ 56px, sticky bas. Wrapper fin
// autour du `CallButton` partagé (Story 3.3, `components/content/call-button.tsx`)
// qui porte la garde E.164 et le rendu sticky. On conserve ici l'API `{ name,
// phoneE164 }` + l'i18n `community.artisan` (le test fiche 2.3 en dépend).

import { useTranslations } from 'next-intl';
import { CallButton as SharedCallButton } from '@/components/content/call-button';

export function CallButton({ name, phoneE164 }: { name: string; phoneE164: string }) {
  const t = useTranslations('community.artisan');
  return (
    <SharedCallButton
      phoneE164={phoneE164}
      label={t('call', { name })}
      unavailableLabel={t('phoneUnavailable')}
      variant="sticky"
    />
  );
}
