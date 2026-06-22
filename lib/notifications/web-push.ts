// Story 7.2 / FR41 — Web Push est marqué V1.5 (pré-arbitrage architecture).
// Au MVP, l'e-mail (voir `lib/notifications/dispatch.ts`) est l'unique canal de
// notification actif. Ce module est un stub explicite : aucun code VAPID /
// PushSubscription / Service Worker push n'est embarqué tant que la V1.5 n'est
// pas planifiée.
//
// TODO(V1.5) : implémenter Web Push
//   1. générer/stocker les clés VAPID (env `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`) ;
//   2. table `push_subscriptions` (endpoint, keys p256dh/auth, user_id, RLS self) ;
//   3. `self.addEventListener('push', …)` dans `sw/index.ts` ;
//   4. router `notifyResident` vers push+e-mail selon le canal souscrit.

export const WEB_PUSH_ENABLED = false as const;

/**
 * No-op au MVP. Présent pour matérialiser le point d'entrée V1.5 et garder un
 * import stable côté dispatcher quand le canal push sera activé.
 */
export function scheduleWebPush(): { delivered: false; reason: 'web_push_v1_5' } {
  return { delivered: false, reason: 'web_push_v1_5' };
}
