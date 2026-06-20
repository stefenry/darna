// Story 2.8 — webhook du droit de réponse artisan. Le form /respond/[token] POSTe
// ici. Calque exact /api/webhook/sms-consent (2.5) : CSRF Origin/Sec-Fetch-Site,
// Content-Length max 4KB, rate-limit IP + token_hash, try/catch formData → 400,
// sanitize NFC+bidi, RPC `process_artisan_response` (SECURITY DEFINER), PRG sans token.
//
// Sécurité : `not_found` → 401 (AR38) ; idempotent (`already_used` → redirect used).

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashConsentToken } from '@/lib/consent/token';
import { sanitizeUserText } from '@/lib/validation/sanitize';
import { checkLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 4096;
const FIELD_TARGETS = new Set([
  'display_name_fr',
  'display_name_ar',
  'phone_e164',
  'competences',
  'price_relative',
  'has_invoice',
]);

function siteOrigin(): string {
  return env.client.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
}

function doneRedirect(
  status: 'published' | 'rectification_pending' | 'expired' | 'used',
): NextResponse {
  return NextResponse.redirect(`${siteOrigin()}/respond/done?status=${status}`, { status: 303 });
}

export async function POST(request: Request) {
  // CSRF (P6) — refuser POST cross-origin.
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  const originOk = origin === siteOrigin() || origin === null;
  const fetchSiteOk = fetchSite === null || fetchSite === 'same-origin' || fetchSite === 'none';
  if (!originOk || !fetchSiteOk) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Content-Length max 4KB (P16).
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return new NextResponse('Payload Too Large', { status: 413 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = await checkLimit(`consent:${ip}`, 20, 600);
  if (!rl.success) return new NextResponse('Too Many Requests', { status: 429 });

  // P19 — body malformé → 400 (pas 500).
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const raw = String(form.get('token') ?? '');
  const kind = String(form.get('kind') ?? '');
  if (!raw || (kind !== 'response' && kind !== 'rectification')) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const tokenHash = hashConsentToken(raw, env.server.CONSENT_TOKEN_SECRET);

  // P17 — rate-limit ciblé par token_hash.
  const rlToken = await checkLimit(`consent-token:${tokenHash.slice(0, 16)}`, 5, 600);
  if (!rlToken.success) return new NextResponse('Too Many Requests', { status: 429 });

  // Construction + validation du payload selon kind (sanitize NFC + strip bidi/control).
  let payload: Record<string, string>;
  if (kind === 'response') {
    const responseText = sanitizeUserText(String(form.get('response_text') ?? ''), {
      maxLen: 500,
      multiline: true,
    });
    let targetKind = String(form.get('target_kind') ?? 'listing');
    if (targetKind !== 'listing' && targetKind !== 'rating') targetKind = 'listing';
    const targetId = String(form.get('target_id') ?? '').trim();
    if (responseText.length < 1) return new NextResponse('Bad Request', { status: 400 });
    payload = {
      response_text: responseText,
      target_kind: targetKind,
      ...(targetKind === 'rating' && targetId ? { target_id: targetId } : {}),
    };
  } else {
    const fieldTarget = String(form.get('field_target') ?? '');
    const requestedValue = sanitizeUserText(String(form.get('requested_value') ?? ''), {
      maxLen: 200,
    });
    const justification = sanitizeUserText(String(form.get('justification_text') ?? ''), {
      maxLen: 500,
      multiline: true,
    });
    if (!FIELD_TARGETS.has(fieldTarget) || requestedValue.length < 1 || justification.length < 1) {
      return new NextResponse('Bad Request', { status: 400 });
    }
    payload = {
      field_target: fieldTarget,
      requested_value: requestedValue,
      justification_text: justification,
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('process_artisan_response', {
    p_token_hash: tokenHash,
    p_kind: kind,
    p_payload: payload,
  });
  if (error) {
    log({
      level: 'error',
      event: 'artisan.response_submitted',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { kind, status: 'rpc_error', errorCode: error.code ?? 'unknown' },
    });
    return new NextResponse('Server Error', { status: 500 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as { status: string } | undefined;
  const status = row?.status ?? 'not_found';

  log({
    level: 'info',
    event: 'artisan.response_submitted',
    user_id: null,
    residence_id: null,
    request_id: null,
    payload: { kind, status },
  });

  // AR38 : token inexistant/cross-purpose/artisan retiré → 401 sans rien révéler.
  if (status === 'not_found') return new NextResponse('Unauthorized', { status: 401 });
  if (status === 'published') return doneRedirect('published');
  if (status === 'rectification_pending') return doneRedirect('rectification_pending');
  if (status === 'expired') return doneRedirect('expired');
  if (status === 'already_used') return doneRedirect('used');
  // invalid_decision ou inattendu → 400.
  return new NextResponse('Bad Request', { status: 400 });
}
