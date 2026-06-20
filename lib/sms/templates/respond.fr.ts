// Story 2.8 — SMS du droit de réponse artisan (FR ; locale artisan inconnue →
// FR par défaut, AR togglable sur la page /respond). Calque consent.fr.ts :
// sanitize `artisanName` (NFC + strip control/bidi, truncate 40) anti multi-segment
// GSM-7 + injection visuelle.

import { sanitizeUserText } from '@/lib/validation/sanitize';

export type RespondSmsVars = {
  artisanName: string;
  link: string;
};

export function respondSmsTemplate({ artisanName, link }: RespondSmsVars): string {
  const safe = sanitizeUserText(artisanName, { maxLen: 40, fallback: 'voisin' });
  return `Darna : ${safe}, votre droit de reponse. Publiez votre reponse ou demandez rectification (sans compte) : ${link}`;
}
