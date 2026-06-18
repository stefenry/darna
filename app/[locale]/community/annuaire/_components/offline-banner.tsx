'use client';

// Story 2.2 (AC4) — bannière hors-ligne. Pilotée par `navigator.onLine` +
// événements online/offline ; lit l'horodatage de dernière synchro dans idb
// pour afficher « mise à jour il y a Xh ». Persistante (ne s'auto-dismiss
// jamais), style `info`.
//
// Review 2026-06-17 :
//   - F27 : pendant l'offline, `hours` est recalculé périodiquement (toutes les
//     5 minutes) — sinon « il y a 0h » resterait affiché même 4h après le
//     basculement.
//   - F28 : chaque `update()` génère un token incrémenté ; seul le dernier
//     token autorisé peut écrire dans le state → plus de race sur l'alternance
//     online↔offline rapide.

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { WifiOff } from 'lucide-react';
import { getLastFetchedAt, stalenessHours } from '@/lib/offline/annuaire-cache';

const REFRESH_MS = 5 * 60 * 1000;

export function OfflineBanner() {
  const t = useTranslations('community.annuaire.offline');
  const [offline, setOffline] = useState(false);
  const [hours, setHours] = useState<number | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function refreshHours(token: number) {
      getLastFetchedAt()
        .then((ts) => {
          if (tokenRef.current !== token) return;
          setHours(ts == null ? null : stalenessHours(ts, Date.now()));
        })
        .catch(() => {
          if (tokenRef.current !== token) return;
          setHours(null);
        });
    }

    function update() {
      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      // Chaque appel = nouveau token, invalide les promesses encore en vol.
      const token = ++tokenRef.current;
      setOffline(isOffline);
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (isOffline) {
        refreshHours(token);
        timer = setInterval(() => refreshHours(tokenRef.current), REFRESH_MS);
      }
    }

    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      // Invalide le dernier token et arrête le timer.
      tokenRef.current = -1;
      if (timer) clearInterval(timer);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  const message = hours == null ? t('bannerUnknown') : t('banner', { hours });

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-[14px] bg-bg-soft px-4 py-2 text-sm text-info"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
