// Story 2.3 (AC2) — CTA primaire « Appeler » ≥ 56px, sticky bas. Lien `tel:`
// direct (pas de modal, OS-level → marche hors-ligne).
//
// Garde stricte E.164 (review 2026-06-17 P1) : la DB ne contrainte pas le format
// (cf. deferred-work.md 2.1) ; un `,`/`;`/espace en valeur composerait des DTMF
// post-décrochage. On refuse le rendu si le numéro n'est pas un E.164 strict.

import { useTranslations } from 'next-intl';
import { Phone, PhoneOff } from 'lucide-react';

const E164 = /^\+[1-9]\d{7,14}$/;

export function CallButton({ name, phoneE164 }: { name: string; phoneE164: string }) {
  const t = useTranslations('community.artisan');
  const isValid = E164.test(phoneE164);

  if (!isValid) {
    return (
      <div className="sticky bottom-4 z-10 mt-2">
        <span
          role="status"
          aria-live="polite"
          className="flex min-h-touch-lg items-center justify-center gap-2 rounded-[14px] bg-bg-soft px-6 text-base font-medium text-neutral-500"
        >
          <PhoneOff className="size-5" aria-hidden />
          {t('phoneUnavailable')}
        </span>
      </div>
    );
  }

  return (
    <div className="sticky bottom-4 z-10 mt-2">
      <a
        href={`tel:${phoneE164}`}
        className="flex min-h-touch-lg items-center justify-center gap-2 rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white shadow-sm motion-safe:transition-colors hover:bg-accent-600"
      >
        <Phone className="size-5" aria-hidden />
        {t('call', { name })}
      </a>
    </div>
  );
}
