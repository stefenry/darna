// Story 2.5 (AC2/AC3/AC6) — webhook de consentement artisan. Le form de la page
// /consent/[token] POSTe ici. Valide le token (re-HMAC), applique la décision via
// la RPC transactionnelle `process_artisan_consent` (SECURITY DEFINER), notifie
// le contributeur par e-mail, puis redirige (PRG) vers la page GET.
//
// Sécurité : `not_found` → 401 générique (AR38, ne révèle pas l'existence) ;
// idempotent (`already_used` → simple redirection, pas de double e-mail).
//
// Hardening review 2026-06-19 :
//   P6  CSRF — check Origin === NEXT_PUBLIC_SITE_URL (+ Sec-Fetch-Site).
//   P10 PRG redirect → /consent/done?status=… (URL SANS raw token).
//   P14 Locale-aware display_name (display_name_ar utilisé si locale=ar).
//   P16 Content-Length max 4KB (anti-DoS HMAC + form-data abuse).
//   P17 Rate-limit par token_hash (en plus de IP).
//   P19 try/catch formData() — body malformé → 400 (pas 500, AR38).
//   P20 notifyContributor — gère `{ok:false}` retourné par send (pas que throw).
//   P21 contributeur soft-deleted (RGPD story 1.9) → pas de notif.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashConsentToken } from '@/lib/consent/token';
import { sendTransactionalEmail } from '@/lib/email/send';
import { checkLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;
type ConsentRow = {
  status: string;
  artisan_id: string | null;
  slug: string | null;
  contributor_id: string | null;
  display_name_fr: string | null;
  display_name_ar: string | null;
};

const MAX_BODY_BYTES = 4096;

function siteOrigin(): string {
  return env.client.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
}

function doneRedirect(status: 'accepted' | 'refused' | 'expired' | 'used'): NextResponse {
  return NextResponse.redirect(`${siteOrigin()}/consent/done?status=${status}`, { status: 303 });
}

export async function POST(request: Request) {
  // P6 — CSRF : refuser POST cross-origin (origine ≠ site_url). Sec-Fetch-Site
  // est posé par les browsers modernes ; Origin par tous les browsers post-2017.
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  const expectedOrigin = siteOrigin();
  const originOk = origin === expectedOrigin || origin === null;
  const fetchSiteOk = fetchSite === null || fetchSite === 'same-origin' || fetchSite === 'none';
  if (!originOk || !fetchSiteOk) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // P16 — Content-Length max 4KB (le body attendu est ≤ ~200 chars).
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return new NextResponse('Payload Too Large', { status: 413 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = await checkLimit(`consent:${ip}`, 20, 600);
  if (!rl.success) return new NextResponse('Too Many Requests', { status: 429 });

  // P19 — formData() peut throw sur body malformé ; 400 propre (pas 500).
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const raw = String(form.get('token') ?? '');
  const decision = String(form.get('decision') ?? '');
  if (!raw || (decision !== 'accept' && decision !== 'refuse')) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const tokenHash = hashConsentToken(raw, env.server.CONSENT_TOKEN_SECRET);

  // P17 — rate-limit ciblé par token_hash (en plus de IP) : anti-bruteforce
  // précis ; même IP partagée (CGNAT) peut tenter plusieurs tokens distincts.
  const rlToken = await checkLimit(`consent-token:${tokenHash.slice(0, 16)}`, 5, 600);
  if (!rlToken.success) return new NextResponse('Too Many Requests', { status: 429 });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('process_artisan_consent', {
    p_token_hash: tokenHash,
    p_decision: decision,
  });
  if (error) {
    log({
      level: 'error',
      event: 'consent.rpc_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown' },
    });
    return new NextResponse('Server Error', { status: 500 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as ConsentRow | undefined;
  // AR38 : token inexistant/falsifié → 401 sans rien révéler.
  if (!row || row.status === 'not_found') {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  if (row.status === 'accepted' || row.status === 'refused') {
    await notifyContributor(admin, row).catch((cause) => {
      log({
        level: 'error',
        event: 'consent.email_failed',
        user_id: null,
        residence_id: row.artisan_id ? null : null,
        request_id: null,
        payload: { reason: cause instanceof Error ? cause.name : 'unknown' },
      });
    });
    return doneRedirect(row.status);
  }

  if (row.status === 'expired') return doneRedirect('expired');
  if (row.status === 'already_used') return doneRedirect('used');
  // invalid_decision ou statut inattendu → 400 (jamais atteint si guards en place).
  return new NextResponse('Bad Request', { status: 400 });
}

async function notifyContributor(admin: SupabaseAdmin, row: ConsentRow): Promise<void> {
  if (!row.contributor_id) return;

  // P21 — Contributeur en suppression RGPD (story 1.9) → pas de notif.
  const { data: dbUser } = await admin
    .from('users')
    .select('id, deleted_at')
    .eq('id', row.contributor_id)
    .maybeSingle();
  if (!dbUser || dbUser.deleted_at !== null) return;

  const { data: authUser } = await admin.auth.admin.getUserById(row.contributor_id);
  const email = authUser?.user?.email;
  if (!email) return;

  const { data: profile } = await admin
    .from('profiles')
    .select('language')
    .eq('user_id', row.contributor_id)
    .maybeSingle();
  const locale = profile?.language === 'ar' ? 'ar' : 'fr';

  // P14 — Locale-aware : nom AR si disponible et locale=ar, sinon FR.
  const artisanName =
    locale === 'ar' && row.display_name_ar ? row.display_name_ar : (row.display_name_fr ?? '');

  // P20 — Tester ok:false (send retourne discriminé, ne throw pas toujours).
  let result;
  if (row.status === 'accepted') {
    const ficheUrl = `${siteOrigin()}/${locale}/community/artisan/${row.slug}`;
    result = await sendTransactionalEmail({
      template: 'artisan-consent-accepted',
      to: email,
      locale,
      vars: { artisanName, ficheUrl },
    });
  } else {
    result = await sendTransactionalEmail({
      template: 'artisan-consent-refused',
      to: email,
      locale,
      vars: { artisanName },
    });
  }
  if (!result.ok) {
    log({
      level: 'error',
      event: 'consent.email_failed',
      user_id: row.contributor_id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: result.errorCode ?? 'unknown', template: row.status },
    });
  }
}
