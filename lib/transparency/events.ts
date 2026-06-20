// Story 5.4 — événements de modération exposés sur /transparence. La vue
// moderation_log_public (5.1) exclut déjà report_opened + actions consent-résidence.
// On restreint en plus aux ACTIONS DE GOUVERNANCE (audit) — le cycle de vie du
// contenu (publication/expiration/retrait-auteur) n'est pas une décision de modé.

// Actions affichées dans le journal public (audit gouvernance).
export const JOURNAL_ACTIONS = [
  'content_removed',
  'rating_removed',
  'comment_removed',
  'content_kept',
  'escalation_triggered',
  'user_deleted',
  'admission_accepted',
  'admission_rejected',
  'purge_completed',
] as const;
export type JournalAction = (typeof JOURNAL_ACTIONS)[number];

export function isJournalAction(a: string | null): a is JournalAction {
  return a !== null && (JOURNAL_ACTIONS as readonly string[]).includes(a);
}

// Catégories de filtre (regroupent plusieurs actions) — UI filtre event type.
export const JOURNAL_FILTERS: Record<string, readonly JournalAction[]> = {
  all: JOURNAL_ACTIONS,
  removals: ['content_removed', 'rating_removed', 'comment_removed'],
  kept: ['content_kept'],
  escalations: ['escalation_triggered'],
  admissions: ['admission_accepted', 'admission_rejected'],
  accounts: ['user_deleted'],
};
export type JournalFilterKey = keyof typeof JOURNAL_FILTERS;

export function actionsForFilter(filter: string | null | undefined): readonly JournalAction[] {
  if (filter && filter in JOURNAL_FILTERS) return JOURNAL_FILTERS[filter] ?? JOURNAL_ACTIONS;
  return JOURNAL_ACTIONS;
}

// Clé i18n `transparency.journal.events.<action>` — libellé en langage clair.
// user_deleted : redaction garantie (la vue masque déjà nom/cible).
export function eventLabelKey(action: JournalAction): string {
  return `events.${action}`;
}
