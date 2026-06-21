'use server';

import { headers } from 'next/headers';
import {
  zSubmitAdmissionForm,
  mapAdmissionFieldError,
  type AdmissionFieldKey,
  type AdmissionFieldErrorKey,
} from '@/lib/validation/admission';
import { createAdminClient } from '@/lib/supabase/admin';
import { detectLocaleFromHeaders } from '@/lib/i18n/detect-locale';
import { sendTransactionalEmail } from '@/lib/email/send';
import { buildPkceConfirmUrl } from '@/lib/auth/build-pkce-confirm-url';
import { checkLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { env } from '@/lib/env';
import { isCanonicalEntityPath } from '@/lib/share/safe-next';

// Story 1.7 — Server Action publique (visiteur anonyme).
// Flux : Zod validate → admin.createUser (idempotent via fallback) →
// duplicate-pending check → INSERT admission_requests (strict columns) →
// generateLink + send magic-link → notify all co-mods → Result.ok.
//
// Le Client Component appelle router.push('/${locale}/auth/check-email')
// sur Result.ok pour rester sur le pattern POST-Redirect-Get (`useActionState`
// ne peut pas combiner redirect() server-side et retour de state au form).

const MAGIC_LINK_TTL_MINUTES = 15;
const RESIDENCE_ID_DARNA = '00000000-0000-0000-0000-000000000001';

export type SubmitState =
  | { ok: false }
  | { ok: false; fieldErrors: Partial<Record<AdmissionFieldKey, AdmissionFieldErrorKey[]>> }
  | { ok: false; errorCode: 'duplicate_pending' | 'rate_limited' }
  | { ok: true; locale: 'fr' | 'ar' };

// AR31 — 5 soumissions / jour / IP.
const ADMISSION_RATE_LIMIT = 5;
const ADMISSION_RATE_WINDOW_SECONDS = 86_400;

function clientIp(headerList: Headers): string {
  const fwd = headerList.get('x-forwarded-for');
  return fwd ? fwd.split(',')[0]?.trim() || 'unknown' : 'unknown';
}

function baseUrl(): string {
  return env.client.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
}

function parseFormDataValues(formData: FormData) {
  const villaRaw = formData.get('villa');
  const villaNum = typeof villaRaw === 'string' ? Number(villaRaw) : Number.NaN;
  const cguRaw = formData.get('cgu_accepted');
  return {
    villa: Number.isFinite(villaNum) ? villaNum : villaRaw,
    tranche: formData.get('tranche'),
    first_name:
      typeof formData.get('first_name') === 'string'
        ? String(formData.get('first_name')).trim()
        : formData.get('first_name'),
    email:
      typeof formData.get('email') === 'string'
        ? String(formData.get('email')).trim()
        : formData.get('email'),
    cgu_accepted: cguRaw === 'on' || cguRaw === 'true',
  };
}

function mapZodToFieldErrors(flat: {
  fieldErrors: Partial<Record<string, string[] | undefined>>;
}): Partial<Record<AdmissionFieldKey, AdmissionFieldErrorKey[]>> {
  const out: Partial<Record<AdmissionFieldKey, AdmissionFieldErrorKey[]>> = {};
  const fields: AdmissionFieldKey[] = ['villa', 'tranche', 'first_name', 'email', 'cgu_accepted'];
  for (const field of fields) {
    if (flat.fieldErrors[field] && (flat.fieldErrors[field] as string[]).length > 0) {
      out[field] = [mapAdmissionFieldError(field)];
    }
  }
  return out;
}

export async function submitAdmissionRequest(
  _previous: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const parsed = zSubmitAdmissionForm.safeParse(parseFormDataValues(formData));

  const headerList = await headers();
  const locale = detectLocaleFromHeaders(
    headerList.get('cookie'),
    headerList.get('accept-language'),
  );

  if (!parsed.success) {
    const fieldErrors = mapZodToFieldErrors(parsed.error.flatten());
    return { ok: false, fieldErrors };
  }

  const { villa, tranche, first_name, email } = parsed.data;

  // Story 6.3 — contexte pré-login : chemin canonique d'entité à restituer après
  // acceptation (validé ici, re-CHECK en DB). Null si absent/non canonique.
  const nextRaw = formData.get('next');
  const landingPath =
    typeof nextRaw === 'string' && isCanonicalEntityPath(nextRaw) ? nextRaw : null;

  // AR31 — rate-limit IP (après validation : on ne pénalise pas une saisie
  // invalide, mais on protège le chemin coûteux generateLink + e-mails).
  const ip = clientIp(headerList);
  const rl = await checkLimit(
    `admission:${ip}`,
    ADMISSION_RATE_LIMIT,
    ADMISSION_RATE_WINDOW_SECONDS,
  );
  if (!rl.success) {
    log({
      level: 'info',
      event: 'admission.rate_limited',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { villa, locale },
    });
    return { ok: false, errorCode: 'rate_limited' };
  }

  const admin = createAdminClient();

  // Étape 4-5 : assurer un auth.users via generateLink. Si l'utilisateur
  // n'existe pas, Supabase le crée automatiquement et le trigger
  // handle_new_auth_user provisionne public.users role='demandeur' +
  // notifications_prefs (story 1.3). Si existe, on récupère son id.
  const nextPath = `/${locale}/admission/pending`;
  const redirectTo = `${baseUrl()}/auth/confirm?next=${encodeURIComponent(nextPath)}`;

  let userId: string | null = null;
  let actionLink: string | null = null;

  try {
    const linkResult = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });

    if (linkResult.error || !linkResult.data?.user?.id) {
      log({
        level: 'error',
        event: 'admission.generate_link_failed',
        user_id: null,
        residence_id: null,
        request_id: null,
        payload: {
          errorCode: linkResult.error?.code ?? 'no_user',
          locale,
        },
      });
      // Anti-énumeration on échec inattendu : pas de signal au visiteur.
      // Le formulaire affiche un état "envoyé" optimiste côté UI ; le manque
      // d'e-mail réel devra être détecté par l'utilisateur (rare au MVP).
      return { ok: true, locale };
    }

    userId = linkResult.data.user.id;
    actionLink = buildPkceConfirmUrl({
      baseUrl: baseUrl(),
      hashedToken: linkResult.data.properties?.hashed_token ?? '',
      nextPath,
    });
  } catch (cause) {
    log({
      level: 'error',
      event: 'admission.generate_link_threw',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: {
        errorCode: 'thrown',
        errorName: cause instanceof Error ? cause.name : 'unknown',
        locale,
      },
    });
    return { ok: true, locale };
  }

  // Étape 4b : duplicate-pending detection (anti-spam). Service-role bypass RLS.
  try {
    const existing = await admin
      .from('admission_requests')
      .select('id')
      .eq('user_id', userId)
      .eq('state', 'pending')
      .is('deleted_at', null)
      .limit(1);

    if (existing.error) {
      log({
        level: 'error',
        event: 'admission.duplicate_check_failed',
        user_id: userId,
        residence_id: null,
        request_id: null,
        payload: { errorCode: existing.error.code ?? 'unknown' },
      });
      // En cas d'erreur de check, on continue (préfère un doublon visible
      // au co-mod plutôt qu'un blocage silencieux du demandeur).
    } else if (Array.isArray(existing.data) && existing.data.length > 0) {
      log({
        level: 'info',
        event: 'admission.duplicate_pending',
        user_id: userId,
        residence_id: null,
        request_id: null,
        payload: { villa, locale },
      });
      return { ok: false, errorCode: 'duplicate_pending' };
    }
  } catch (cause) {
    log({
      level: 'error',
      event: 'admission.duplicate_check_threw',
      user_id: userId,
      residence_id: null,
      request_id: null,
      payload: {
        errorCode: 'thrown',
        errorName: cause instanceof Error ? cause.name : 'unknown',
      },
    });
  }

  // Étape 6 : INSERT admission_requests — STRICTEMENT les colonnes autorisées
  // par le column-level grant authenticated (anti-self-validate, double-belt
  // même si service-role bypasse). state/decided_*/timestamps défauts DB.
  try {
    const insert = await admin.from('admission_requests').insert({
      user_id: userId,
      residence_id: RESIDENCE_ID_DARNA,
      villa,
      tranche,
      first_name,
      contact_channel: 'email',
      landing_path: landingPath,
    });

    if (insert.error) {
      // Story 1.10a — l'index unique partiel admission_requests_one_pending_per_user
      // attrape une 2e demande pending concurrente (race que le check étape 4b ne
      // couvre pas). Postgres lève 23505 → on traite comme duplicate_pending.
      if (insert.error.code === '23505') {
        log({
          level: 'info',
          event: 'admission.duplicate_pending',
          user_id: userId,
          residence_id: null,
          request_id: null,
          payload: { villa, locale, via: 'unique_index' },
        });
        return { ok: false, errorCode: 'duplicate_pending' };
      }
      log({
        level: 'error',
        event: 'admission.insert_failed',
        user_id: userId,
        residence_id: null,
        request_id: null,
        payload: { errorCode: insert.error.code ?? 'unknown', villa, locale },
      });
      // Si l'INSERT échoue, on ne renvoie quand même PAS de magic-link
      // (sinon l'utilisateur se connecte et son redirect-by-state ne le voit
      // pas comme `pending` → boucle confusion). On log et on signale via
      // une erreur générique côté form (couvert par anti-énumeration UX).
      return { ok: true, locale };
    }
  } catch (cause) {
    log({
      level: 'error',
      event: 'admission.insert_threw',
      user_id: userId,
      residence_id: null,
      request_id: null,
      payload: {
        errorCode: 'thrown',
        errorName: cause instanceof Error ? cause.name : 'unknown',
      },
    });
    return { ok: true, locale };
  }

  // Étape 7 : envoyer le magic-link au demandeur (boundary AR16).
  if (!actionLink) {
    log({
      level: 'error',
      event: 'admission.action_link_missing',
      user_id: userId,
      residence_id: null,
      request_id: null,
      payload: { locale },
    });
  } else {
    try {
      await sendTransactionalEmail({
        template: 'magic-link',
        to: email,
        locale,
        vars: {
          link: actionLink,
          expiresInMinutes: MAGIC_LINK_TTL_MINUTES,
        },
      });
    } catch (cause) {
      log({
        level: 'error',
        event: 'admission.magic_link_send_threw',
        user_id: userId,
        residence_id: null,
        request_id: null,
        payload: {
          errorCode: 'thrown',
          errorName: cause instanceof Error ? cause.name : 'unknown',
        },
      });
    }
  }

  // Étape 8 : notifier les co-mods (CSV INITIAL_COMOD_EMAILS, story 1.6).
  // try/catch par envoi — un échec côté Brevo ne bloque jamais le flux principal.
  const queueUrl = `${baseUrl()}/fr/comod/admission`;
  for (const comodEmail of env.server.INITIAL_COMOD_EMAILS) {
    try {
      const r = await sendTransactionalEmail({
        template: 'admission-notify-comod',
        to: comodEmail,
        locale: 'fr',
        vars: {
          villa,
          tranche,
          first_name,
          queue_url: queueUrl,
        },
      });
      if (!r.ok) {
        log({
          level: 'error',
          event: 'admission.comod_notify_failed',
          user_id: userId,
          residence_id: null,
          request_id: null,
          payload: { errorCode: r.errorCode, locale },
        });
      }
    } catch (cause) {
      log({
        level: 'error',
        event: 'admission.comod_notify_threw',
        user_id: userId,
        residence_id: null,
        request_id: null,
        payload: {
          errorCode: 'thrown',
          errorName: cause instanceof Error ? cause.name : 'unknown',
        },
      });
    }
  }

  log({
    level: 'info',
    event: 'admission.requested',
    user_id: userId,
    residence_id: null,
    request_id: null,
    payload: {
      villa,
      tranche,
      locale,
      has_email_verified_at: false,
    },
  });

  return { ok: true, locale };
}
