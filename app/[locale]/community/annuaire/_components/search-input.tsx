'use client';

// Story 2.2 (AC2) — champ recherche débounce 300ms → param `?q=`. Pas de bouton
// « Rechercher » (auto-submit). Feedback « recherche en cours » = pulse subtil
// (motion-safe), jamais spinner.
//
// Review 2026-06-17 :
//   - F11 : sync input ← URL externe (back/forward, deep link). Avant,
//     `useState(searchParams.get('q'))` ne lisait que la valeur initiale.
//   - F26 : le compteur de résultats n'est PLUS rendu ici (déménagé dans
//     `<ResultsHeader>` côté Suspense résultats). Le live-region annonce donc
//     uniquement au settle des données, pas à chaque keystroke.

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFilterParams } from './use-filter-params';

const DEBOUNCE_MS = 300;

export function SearchInput() {
  const tSearch = useTranslations('community.annuaire.search');
  const { searchParams, setParam } = useFilterParams();
  const urlQ = searchParams.get('q') ?? '';
  const [value, setValue] = useState(urlQ);
  const [isPending, startTransition] = useTransition();
  const skipFirst = useRef(true);
  const lastExternalQ = useRef(urlQ);

  // F11 — sync input ← URL externe : si l'utilisateur navigue (back/forward,
  // deep link) la `searchParams.q` peut changer sans remontage. On compare la
  // valeur URL à la dernière qu'on a observée venant de l'URL ; si elle a
  // changé, on rebascule le `value` local et on skip le debounce (le re-push
  // serait redondant).
  useEffect(() => {
    if (lastExternalQ.current !== urlQ) {
      lastExternalQ.current = urlQ;
      setValue(urlQ);
      skipFirst.current = true;
    }
  }, [urlQ]);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const handle = setTimeout(() => {
      const next = value.trim() || null;
      startTransition(() => setParam('q', next));
      lastExternalQ.current = next ?? '';
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [value, setParam]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="annuaire-search" className="sr-only">
        {tSearch('label')}
      </label>
      <div className="relative">
        <Search
          className={cn(
            'pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400',
            isPending && 'motion-safe:animate-pulse',
          )}
          aria-hidden
        />
        <input
          id="annuaire-search"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={tSearch('placeholder')}
          className="min-h-touch w-full rounded-[14px] bg-bg-soft pe-4 ps-11 text-base text-neutral-900 placeholder:text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        />
      </div>
    </div>
  );
}
