'use server';

// Story 5.4 — Server Action de pagination du journal public (load-more).
// Lecture publique (vue moderation_log_public) — aucune garde d'auth nécessaire.

import {
  fetchJournalPage,
  type JournalFilters,
  type JournalPage,
} from '@/lib/transparency/journal';

export async function loadMoreJournal(
  filters: JournalFilters,
  cursor: string,
): Promise<JournalPage> {
  return fetchJournalPage(filters, cursor);
}
