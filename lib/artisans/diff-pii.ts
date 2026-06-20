// Story 2.7 — détecte si une édition touche une PII (display_name_fr ou phone)
// qui déclenche le re-consent (AC3/AC4). Comparaison après normalisation pour
// éviter un faux re-consent sur un simple reformatage d'espaces/séparateurs.

const PHONE_NORMALIZE = /[\s.\-()]+/g;

function normPhone(p: string): string {
  return p.replace(PHONE_NORMALIZE, '');
}

export function piiChanged(
  current: { display_name_fr: string; phone_e164: string },
  next: { display_name_fr: string; phone_e164: string },
): boolean {
  return (
    current.display_name_fr.trim() !== next.display_name_fr.trim() ||
    normPhone(current.phone_e164) !== normPhone(next.phone_e164)
  );
}
