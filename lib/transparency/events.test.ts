import { describe, it, expect } from 'vitest';
import { JOURNAL_ACTIONS, actionsForFilter, isJournalAction, JOURNAL_FILTERS } from './events';

describe('events whitelist', () => {
  it('exclut report_opened et les actions consent (jamais publiques)', () => {
    expect(isJournalAction('report_opened')).toBe(false);
    expect(isJournalAction('artisan_published')).toBe(false);
    expect(isJournalAction('alert_created')).toBe(false);
    expect(isJournalAction(null)).toBe(false);
  });

  it('inclut les actions de gouvernance', () => {
    expect(isJournalAction('content_removed')).toBe(true);
    expect(isJournalAction('content_kept')).toBe(true);
    expect(isJournalAction('user_deleted')).toBe(true);
    expect(isJournalAction('escalation_triggered')).toBe(true);
  });

  it('actionsForFilter retourne le sous-ensemble de la catégorie', () => {
    expect(actionsForFilter('removals')).toEqual(JOURNAL_FILTERS.removals);
    expect(actionsForFilter('accounts')).toEqual(['user_deleted']);
  });

  it('actionsForFilter fallback sur toutes les actions si filtre inconnu', () => {
    expect(actionsForFilter('zzz')).toEqual(JOURNAL_ACTIONS);
    expect(actionsForFilter(null)).toEqual(JOURNAL_ACTIONS);
    expect(actionsForFilter(undefined)).toEqual(JOURNAL_ACTIONS);
  });
});
