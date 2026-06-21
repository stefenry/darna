'use client';

// Story 5.4 — feed du journal public : rendu des entrées + chargement incrémental
// (« Charger plus » + auto-trigger IntersectionObserver = infinite-scroll léger).
// A11y : police ≥ 16px, contraste élevé, liste sémantique <ol>. RTL hérité du shell.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { loadMoreJournal } from '../actions';
import type { JournalEntry, JournalFilters } from '@/lib/transparency/journal';

const REMOVAL_ACTIONS = new Set(['content_removed', 'rating_removed', 'comment_removed']);
const KNOWN_TARGETS = new Set([
  'artisan',
  'rating',
  'alert',
  'alert_comment',
  'tip',
  'guide_entry',
  'useful_number',
  'pack_entry', // retrait de contenu durable (RPC retire_durable_entry → target_kind=pack_entry)
]);

export function JournalFeed({
  locale,
  initialEntries,
  initialCursor,
  filters,
}: {
  locale: string;
  initialEntries: JournalEntry[];
  initialCursor: string | null;
  filters: JournalFilters;
}) {
  const t = useTranslations('transparency.journal');
  const [entries, setEntries] = useState<JournalEntry[]>(initialEntries);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const page = await loadMoreJournal(filters, cursor);
      setEntries((prev) => [...prev, ...page.entries]);
      setCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, filters]);

  // Auto-trigger quand la sentinelle entre dans le viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const obs = new IntersectionObserver(
      (es) => {
        if (es[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '200px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, loadMore]);

  function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function describe(e: JournalEntry): string {
    let label = t(`events.${e.action}`);
    if (REMOVAL_ACTIONS.has(e.action) && e.targetKind && KNOWN_TARGETS.has(e.targetKind)) {
      label += ` — ${t(`targets.${e.targetKind}`)}`;
    }
    return label;
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-[14px] bg-bg-soft px-4 py-6 text-center text-base text-neutral-700">
        {t('empty')}
      </p>
    );
  }

  return (
    <>
      <ol className="flex flex-col gap-3">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-col gap-1 rounded-[14px] bg-bg-card p-4 shadow-xs">
            <p className="text-base font-medium text-neutral-900">{describe(e)}</p>
            <div className="flex flex-wrap items-center gap-2 text-base text-neutral-600">
              <time dateTime={e.createdAt}>{formatDate(e.createdAt)}</time>
              {e.actorDisplayName && (
                <>
                  <span aria-hidden>·</span>
                  <span>{t('byActor', { name: e.actorDisplayName })}</span>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>

      {cursor && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="inline-flex min-h-touch items-center justify-center rounded-[14px] bg-bg-soft px-5 text-sm font-semibold text-accent-600 hover:bg-neutral-300 disabled:opacity-50"
          >
            {loading ? t('loading') : t('loadMore')}
          </button>
        </div>
      )}
    </>
  );
}
