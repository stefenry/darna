// Story 3.3 (D2) — CTA d'appel `tel:` partagé (fiche artisan 2.3 + numéros utiles
// 3.3). Lien natif OS-level (pas de modal, marche hors-ligne, NFR40b). Deux
// variantes : `sticky` (bas de fiche artisan) et `inline` (carte numéro). Cible
// tactile ≥ 56px (`min-h-touch-lg`).
//
// Garde stricte E.164 (review 2.3 P1) : un `,`/`;`/`#` en valeur composerait des
// DTMF post-décrochage → on refuse le rendu du lien si le numéro n'est pas E.164.

import { Phone, PhoneOff } from 'lucide-react';

const E164 = /^\+[1-9]\d{7,14}$/;

type Variant = 'sticky' | 'inline';

export function CallButton({
  phoneE164,
  label,
  unavailableLabel,
  variant = 'sticky',
  ariaLabel,
}: {
  phoneE164: string;
  /** Texte visible du bouton (ex. « Appeler Hassan » ou « Appeler »). */
  label: string;
  /** Texte affiché si le numéro n'est pas un E.164 valide. */
  unavailableLabel: string;
  variant?: Variant;
  /** Nom accessible si le texte visible ne suffit pas (ex. « Appeler poste de garde »). */
  ariaLabel?: string;
}) {
  const isValid = E164.test(phoneE164);
  const inline = variant === 'inline';

  const linkClass = inline
    ? 'inline-flex min-h-touch-lg items-center justify-center gap-2 rounded-[14px] bg-accent-500 px-5 text-base font-semibold text-white shadow-sm motion-safe:transition-colors hover:bg-accent-600'
    : 'flex min-h-touch-lg items-center justify-center gap-2 rounded-[14px] bg-accent-500 px-6 text-base font-semibold text-white shadow-sm motion-safe:transition-colors hover:bg-accent-600';
  const unavailableClass = inline
    ? 'inline-flex min-h-touch-lg items-center gap-2 rounded-[14px] bg-bg-soft px-5 text-sm font-medium text-neutral-500'
    : 'flex min-h-touch-lg items-center justify-center gap-2 rounded-[14px] bg-bg-soft px-6 text-base font-medium text-neutral-500';

  const inner = isValid ? (
    <a href={`tel:${phoneE164}`} aria-label={ariaLabel} className={linkClass}>
      <Phone className="size-5" aria-hidden />
      {label}
    </a>
  ) : (
    <span role="status" aria-live="polite" className={unavailableClass}>
      <PhoneOff className="size-5" aria-hidden />
      {unavailableLabel}
    </span>
  );

  if (inline) return inner;
  return <div className="sticky bottom-4 z-10 mt-2">{inner}</div>;
}
