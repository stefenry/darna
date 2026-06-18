'use client';

// Story 2.2 (AC2/AC3) — état recherche+filtres porté par l'URL (searchParams).
// Le Server Component re-rend à chaque changement → pas d'état client dupliqué,
// retour-arrière préserve les filtres. Navigation via next-intl (préfixe locale
// géré automatiquement).
//
// Review 2026-06-17 (F10/F31) :
//   - On lit `window.location.search` au moment de l'appel (ref + sync) au lieu
//     du `searchParams` capturé dans la closure → deux taps rapides combinent
//     leurs modifs au lieu que le 2e écrase le 1er.
//   - Les clés répétées (`?tag=a&tag=b`) sont préservées : on itère sur
//     `URLSearchParams.entries()` au lieu de `Object.fromEntries` (qui aplatit).

import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/lib/i18n/navigation';

function paramsToQuery(params: URLSearchParams): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    if (values.length === 0) continue;
    out[key] = values.length === 1 ? (values[0] as string) : values;
  }
  return out;
}

export function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Ref vers le dernier `searchParams` observé → utilisé en SSR fallback (pas
  // de `window`) et synchronisé à chaque rendu pour rester à jour.
  const latestParams = useRef(searchParams);
  useEffect(() => {
    latestParams.current = searchParams;
  }, [searchParams]);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      // Source de vérité = URL réelle au moment de l'appel (pas la closure).
      // Permet de composer plusieurs setParam dans la même tick sans collision.
      const source =
        typeof window !== 'undefined'
          ? window.location.search
          : `?${latestParams.current.toString()}`;
      const params = new URLSearchParams(source);
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace({ pathname, query: paramsToQuery(params) });
    },
    [router, pathname],
  );

  const toggleParam = useCallback(
    (key: string, value: string) => {
      const source =
        typeof window !== 'undefined'
          ? window.location.search
          : `?${latestParams.current.toString()}`;
      const current = new URLSearchParams(source).get(key);
      setParam(key, current === value ? null : value);
    },
    [setParam],
  );

  return { searchParams, setParam, toggleParam };
}
