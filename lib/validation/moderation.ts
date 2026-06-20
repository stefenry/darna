// Story 5.3 — Zod schemas des actions de modération co_mod (retrait / conservation).
// Motif de retrait = liste FERMÉE (sous-ensemble de report_reason, AC 5.3) ; note
// libre optionnelle sanitisée. Clés d'erreur whitelistées (AR17).

import { z } from 'zod';
import { sanitizeUserText } from './sanitize';

// Motifs de retrait proposés au co_mod (AC 5.3 : liste fermée).
export const REMOVAL_MOTIVES = ['diffamation', 'info_erronee', 'hors_charte', 'autre'] as const;
export type RemovalMotive = (typeof REMOVAL_MOTIVES)[number];

export const MODERATION_NOTE_MAXLEN = 2000;

const zNote = z.preprocess(
  (v) =>
    typeof v === 'string' && v.trim()
      ? sanitizeUserText(v, { maxLen: MODERATION_NOTE_MAXLEN, multiline: true })
      : undefined,
  z.string().max(MODERATION_NOTE_MAXLEN).optional(),
);

export const zRemoveContent = z.object({
  report_id: z.string().uuid(),
  motive: z.enum(REMOVAL_MOTIVES),
  note: zNote,
});

export const zKeepContent = z.object({
  report_id: z.string().uuid(),
  note: zNote,
});

export type RemoveContentInput = z.infer<typeof zRemoveContent>;
export type KeepContentInput = z.infer<typeof zKeepContent>;
