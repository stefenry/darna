'use client';

// Story 3.2 (AC2) — champ recherche Guide : débounce 300ms → param `?q=`.
// Auto-submit (pas de bouton). Feedback « en cours » = pulse subtil (jamais
// spinner, AR21). Sync input ← URL externe (back/forward, deep link). Pattern
// calqué sur `annuaire/_components/search-input.tsx`, auto-contenu (next/navigation).

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEBOUNCE_MS = 300;

export function GuideSearch() {
  const t = useTranslations('community.guide.search');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const [value, setValue] = useState(urlQ);
  const [isPending, startTransition] = useTransition();
  const skipFirst = useRef(true);
  const lastExternalQ = useRef(urlQ);

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
      const next = value.trim();
      const params = new URLSearchParams(searchParams);
      if (next) params.set('q', next);
      else params.delete('q');
      lastExternalQ.current = next;
      const qs = params.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [value, pathname, router, searchParams]);

  return (
    <div role="search" className="flex flex-col gap-2">
      <label htmlFor="guide-search" className="sr-only">
        {t('label')}
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
          id="guide-search"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('placeholder')}
          className="min-h-touch w-full rounded-[14px] bg-bg-soft pe-4 ps-11 text-base text-neutral-900 placeholder:text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        />
      </div>
    </div>
  );
}
