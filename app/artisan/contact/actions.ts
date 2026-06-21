'use server';

// Story 2.8 — demande de magic-link « droit de réponse » par l'artisan, depuis
// son téléphone. Publique, SANS session. AR38 indistinguabilité STRICTE : la
// réponse UI est TOUJOURS la même (« generic_sent_message ») quel que soit le
// résultat (phone trouvé/inexistant, rate-limité, format invalide). Écriture via
// `createAdminClient` (RPC `request_artisan_contact_link` est service_role).

import { headers } from 'next/headers';
import { zPhoneMaroc } from '@/lib/validation/phone-e164';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateConsentToken } from '@/lib/consent/token';
import { sendTransactionalSms } from '@/lib/sms/send';
import { checkLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { log } from '@/lib/logger';

const IP_RATE_LIMIT = 10;
const IP_RATE_WINDOW = 3600;
const PHONE_RATE_LIMIT = 3;
const PHONE_RATE_WINDOW = 3600;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TIMING_EQUALIZE_MS = 150;
const PHONE_NORMALIZE = /[\s.\-()]+/g;

export type ContactLinkState = { ok: true } | { ok: false; idle: true };

const GENERIC: ContactLinkState = { ok: true };

function siteOrigin(): string {
  return env.client.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestArtisanContactLink(
  _prev: ContactLinkState,
  formData: FormData,
): Promise<ContactLinkState> {
  const phoneRaw = String(formData.get('phone') ?? '')
    .trim()
    .replace(PHONE_NORMALIZE, '');

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  // Rate-limit IP (10/h). Dépassement → MÊME réponse générique (AR38) + log.
  const rlIp = await checkLimit(`artisan-contact-ip:${ip}`, IP_RATE_LIMIT, IP_RATE_WINDOW);
  if (!rlIp.success) {
    log({
      level: 'warn',
      event: 'artisan.contact_link_requested',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { rate_limit_hit: true, scope: 'ip' },
    });
    return GENERIC;
  }

  // Zod silencieux : un format invalide ne révèle rien (AR38).
  const parsed = zPhoneMaroc.safeParse(phoneRaw);
  if (!parsed.success) {
    await sleep(TIMING_EQUALIZE_MS);
    return GENERIC;
  }
  const phone = parsed.data;

  // Rate-limit par phone normalisé (3/h, anti-flooding SMS cross-IP).
  const rlPhone = await checkLimit(
    `artisan-contact-phone:${phone}`,
    PHONE_RATE_LIMIT,
    PHONE_RATE_WINDOW,
  );
  if (!rlPhone.success) {
    log({
      level: 'warn',
      event: 'artisan.contact_link_requested',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { rate_limit_hit: true, scope: 'phone' },
    });
    return GENERIC;
  }

  const { raw, hash } = generateConsentToken(env.server.CONSENT_TOKEN_SECRET);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('request_artisan_contact_link', {
    p_phone_e164: phone,
    p_token_hash: hash,
    p_expires_at: expiresAt,
  });
  if (error) {
    log({
      level: 'error',
      event: 'artisan.contact_link_requested',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { rate_limit_hit: false, status: 'rpc_error', errorCode: error.code ?? 'unknown' },
    });
    return GENERIC; // AR38 : ne révèle pas l'erreur
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { status: string; sms_target_phone: string | null; sms_artisan_name: string | null }
    | undefined;

  if (row?.status === 'sent' && row.sms_target_phone) {
    // AR38 : un échec SMS (return {ok:false} OU throw du provider Brevo en prod) ne doit
    // JAMAIS révéler côté UI que le phone existe → on absorbe l'exception et on log.
    let smsOk = false;
    try {
      const sms = await sendTransactionalSms({
        template: 'artisan-respond',
        to: row.sms_target_phone,
        vars: {
          artisanName: row.sms_artisan_name ?? '',
          link: `${siteOrigin()}/respond/${raw}`,
        },
      });
      smsOk = sms.ok;
    } catch {
      smsOk = false;
    }
    log({
      level: smsOk ? 'info' : 'error',
      event: 'artisan.contact_link_requested',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { rate_limit_hit: false, status: 'sent', smsOk },
    });
  } else {
    // Phone inexistant : égalise approximativement le timing avec la branche SMS.
    await sleep(TIMING_EQUALIZE_MS);
    log({
      level: 'info',
      event: 'artisan.contact_link_requested',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { rate_limit_hit: false, status: 'not_found' },
    });
  }

  return GENERIC;
}
