// Story 2.2 (AC4) — endpoint data annuaire JSON, cacheable hors-ligne (règle
// Serwist `CacheFirst` dans sw/index.ts). RLS-scopé via le client SSR session.
// Hors `[locale]` (endpoint machine, ADR 0003).
//
// Review 2026-06-17 — F1/F3/F16/D1 :
//   - Auth gate explicite : 401 si pas de session (le matcher proxy.ts exclut
//     `api/*` → la route doit garder elle-même).
//   - URL partitionnée par résidence + locale (`?r=<residence_id>&loc=<locale>`)
//     pour éviter qu'un cache Serwist soit partagé entre résidences ou locales.
//   - Erreurs amont = 500 logué (jamais un 200 vide caché 24h).
//   - La réponse 200 retourne `fetchedAt` pour que le client horodate le cache
//     avec la vraie date du serveur, pas son `Date.now()` local.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { log } from '@/lib/logger';
import { fetchAnnuaire } from '@/app/[locale]/community/annuaire/data';
import { ACTIVE_LOCALES, defaultLocale, type Locale } from '@/lib/i18n/config';

export const dynamic = 'force-dynamic';

function pickLocale(raw: string | null): Locale {
  if (!raw) return defaultLocale;
  return (ACTIVE_LOCALES as readonly string[]).includes(raw) ? (raw as Locale) : defaultLocale;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileErr } = await supabase
    .from('users')
    .select('residence_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profileErr || !profile?.residence_id) {
    log({
      level: 'error',
      event: 'annuaire_api.profile_lookup_failed',
      user_id: user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: profileErr?.code ?? 'no_profile' },
    });
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const locale = pickLocale(url.searchParams.get('loc'));
  // `r` est purement un identifiant de partition cache côté SW : la donnée
  // servie reste celle de la résidence de session (RLS). On rejette quand même
  // un `?r=` qui ne matche pas la session pour éviter qu'un client confonde
  // ses caches.
  const requestedResidence = url.searchParams.get('r');
  if (requestedResidence && requestedResidence !== profile.residence_id) {
    return NextResponse.json({ error: 'residence_mismatch' }, { status: 409 });
  }

  try {
    const result = await fetchAnnuaire(locale, { sort_by: 'recency' });
    return NextResponse.json({
      artisans: result.artisans,
      hasMore: result.hasMore,
      fetchedAt: Date.now(),
    });
  } catch (error) {
    log({
      level: 'error',
      event: 'annuaire_api.fetch_failed',
      user_id: user.id,
      residence_id: profile.residence_id,
      request_id: null,
      payload: { errorCode: (error as { code?: string })?.code ?? 'unknown' },
    });
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
