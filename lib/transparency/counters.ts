// Story 8.1 — couche données des compteurs publics agrégés (/transparence).
// Appelle la RPC SECURITY DEFINER `transparency_counters` (anon + authenticated),
// qui renvoie un objet d'agrégats no-PII (NFR52). Caché côté serveur 1h via
// `unstable_cache` (tag 'transparence') : suffisamment frais sans marteler la DB
// (NFR-perf). `revalidateTag('transparence')` permet un rafraîchissement manuel.

import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { log } from '@/lib/logger';

// Clés ordonnées = ordre d'affichage des cartes sur /transparence.
export const COUNTER_KEYS = [
  'villas_inscrites',
  'artisans_publies',
  'avis_postes',
  'alertes_emises',
  'bons_plans_publies',
  'actions_moderation',
  'partages_externes',
] as const;

export type CounterKey = (typeof COUNTER_KEYS)[number];
export type TransparencyCounters = Record<CounterKey, number>;

const ZERO: TransparencyCounters = {
  villas_inscrites: 0,
  artisans_publies: 0,
  avis_postes: 0,
  alertes_emises: 0,
  bons_plans_publies: 0,
  actions_moderation: 0,
  partages_externes: 0,
};

function coerce(raw: unknown): TransparencyCounters {
  if (raw === null || typeof raw !== 'object') return ZERO;
  const obj = raw as Record<string, unknown>;
  const out = { ...ZERO };
  for (const key of COUNTER_KEYS) {
    const v = obj[key];
    out[key] = typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0;
  }
  return out;
}

// Le fetch réel (non caché). Client ADMIN (service-role, SANS cookies) : appelé
// depuis unstable_cache, où les API dynamiques (cookies()) sont interdites. La RPC
// est SECURITY DEFINER et n'expose que des agrégats no-PII → aucun besoin de session.
async function fetchCounters(): Promise<TransparencyCounters> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('transparency_counters');
  if (error) {
    log({
      level: 'error',
      event: 'transparency.counters_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown' },
    });
    return ZERO;
  }
  return coerce(data);
}

// Caché 1h, tag 'transparence'. La clé de cache est constante (compteurs globaux
// mono-résidence) → un seul calcul partagé par tous les visiteurs.
export const getTransparencyCounters = unstable_cache(fetchCounters, ['transparency-counters'], {
  revalidate: 3600,
  tags: ['transparence'],
});
