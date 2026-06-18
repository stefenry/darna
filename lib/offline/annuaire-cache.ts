// Story 2.2 (AC4) — métadonnée de fraîcheur du cache annuaire. Serwist
// (CacheFirst) ne remonte pas l'âge du cache à l'UI → on stocke l'horodatage de
// la dernière lecture réseau réussie dans IndexedDB (`idb`, déjà installé), et
// la bannière offline calcule « mise à jour il y a Xh ».
//
// Le calcul d'ancienneté ({@link stalenessHours}) est PUR → testable sans
// IndexedDB. L'accès `idb` reste minimal (intégration, non unit-testé).

import { openDB } from 'idb';

const DB_NAME = 'darna-offline';
const STORE = 'annuaire-meta';
const KEY = 'last-fetch';

/** Ancienneté en heures pleines (arrondi bas, jamais négatif). Pur. */
export function stalenessHours(fetchedAt: number, now: number): number {
  const ms = Math.max(0, now - fetchedAt);
  return Math.floor(ms / 3_600_000);
}

async function db() {
  return openDB(DB_NAME, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
    },
  });
}

/** Mémorise l'instant de la dernière lecture réseau réussie de l'annuaire. */
export async function setLastFetchedAt(ts: number): Promise<void> {
  const d = await db();
  await d.put(STORE, ts, KEY);
}

/** Lit l'horodatage de la dernière lecture réseau, ou null si jamais mis. */
export async function getLastFetchedAt(): Promise<number | null> {
  const d = await db();
  const v = await d.get(STORE, KEY);
  return typeof v === 'number' ? v : null;
}
