'use client';

// Story 2.2 (AC4) — au chargement en ligne, sollicite l'endpoint data annuaire
// (`/api/annuaire?r=<residence_id>&loc=<locale>`) pour réchauffer le cache
// Serwist `CacheFirst` et mémorise l'instant de synchro dans idb (lu par la
// bannière offline). Aucun rendu.
//
// Review 2026-06-17 :
//   - F2 : on horodate avec `fetchedAt` retourné par le serveur, pas avec
//     `Date.now()` local (qui mentirait sur une réponse cachée stale).
//   - F29 : `AbortController` pour annuler le fetch si le composant démonte
//     pendant la requête (navigation rapide).
//   - D1 : URL partitionnée par résidence + locale → cache SW distinct par
//     contexte d'authentification.

import { useEffect } from 'react';
import { setLastFetchedAt } from '@/lib/offline/annuaire-cache';

type Props = {
  residenceId: string;
  locale: string;
};

export function CacheStamp({ residenceId, locale }: Props) {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const controller = new AbortController();
    const url = `/api/annuaire?r=${encodeURIComponent(residenceId)}&loc=${encodeURIComponent(
      locale,
    )}`;
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const payload = (await res.json().catch(() => null)) as {
          fetchedAt?: number;
          artisans?: unknown;
        } | null;
        // Ne marque « frais » que si le serveur a vraiment retourné une liste.
        // Une réponse vide non-erreur reste valable (résidence sans artisan),
        // mais on garde la stamp serveur comme source de vérité d'âge.
        if (payload?.artisans !== undefined) {
          const ts = typeof payload.fetchedAt === 'number' ? payload.fetchedAt : Date.now();
          await setLastFetchedAt(ts);
        }
      })
      .catch(() => {
        // AbortError ou hors-ligne / erreur réseau : la bannière retombe sur
        // l'état « inconnu ». Pas de Sentry ici (bruit), la route handler
        // logue déjà les 500.
      });
    return () => controller.abort();
  }, [residenceId, locale]);

  return null;
}
