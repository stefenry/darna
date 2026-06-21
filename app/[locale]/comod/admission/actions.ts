'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireComod } from '@/lib/auth/require-comod';
import {
  zValidateAdmission,
  zRejectAdmission,
  type ComodErrorKey,
} from '@/lib/validation/admission-decision';
import { sendTransactionalEmail } from '@/lib/email/send';
import { isSafeActionLink } from '@/lib/auth/safe-action-link';
import { isCanonicalEntityPath } from '@/lib/share/safe-next';
import { log } from '@/lib/logger';
import { env } from '@/lib/env';

// Story 1.8 — Server Actions de décision co-mod (validate / reject).
// Pattern : requireComod() → Zod safeParse → RPC SECURITY DEFINER atomique
// (état + moderation_log [+ role]) → side-effects post-RPC (app_metadata,
// magic-link, e-mail) → Result. La décision DB est committée par la RPC ;
// les side-effects e-mail ne doivent jamais l'annuler (try/catch isolé).

const RESIDENCE_ID_DARNA = '00000000-0000-0000-0000-000000000001';
// D4 — MVP FR-only : la locale du demandeur n'est pas persistée (pas de colonne
// admission_requests.locale, pas de profile pour un demandeur). On envoie en FR.
const DECISION_LOCALE = 'fr' as const;

export type DecisionState =
  | { ok: true }
  | {
      ok: false;
      code: 'forbidden' | 'invalid_input' | 'already_decided' | 'decision_failed';
      message_key: ComodErrorKey;
    };

function baseUrl(): string {
  return env.client.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
}

// Mappe le message d'erreur stable levé par la RPC (init migration 1.8) sur un
// DecisionState. PostgREST surface `RAISE EXCEPTION '<msg>'` dans error.message.
function mapRpcError(message: string | undefined): DecisionState {
  // Story 1.10a — codes distincts (deferred 1.8) : on garde le discriminant
  // `code` du DecisionState mais on porte un message_key dédié par cas RPC.
  switch (message) {
    case 'already_decided':
      return { ok: false, code: 'already_decided', message_key: 'errors.comod.already_decided' };
    case 'not_found':
      return { ok: false, code: 'decision_failed', message_key: 'errors.comod.invalid_id' };
    case 'wrong_residence':
      return { ok: false, code: 'forbidden', message_key: 'errors.comod.wrong_residence' };
    case 'not_co_mod':
      return { ok: false, code: 'forbidden', message_key: 'errors.comod.forbidden' };
    default:
      return { ok: false, code: 'decision_failed', message_key: 'errors.comod.decision_failed' };
  }
}

type DecisionRow = { requester_user_id: string; villa: number; residence_id: string };

export async function validateAdmission(input: {
  admission_request_id: string;
}): Promise<DecisionState> {
  const guard = await requireComod();
  if (!guard.ok) {
    return { ok: false, code: 'forbidden', message_key: 'errors.comod.forbidden' };
  }

  const parsed = zValidateAdmission.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: 'invalid_input', message_key: 'errors.comod.invalid_id' };
  }

  const admin = createAdminClient();

  const { data, error } = await admin.rpc('accept_admission', {
    p_admission_id: parsed.data.admission_request_id,
    p_actor_id: guard.user.id,
  });

  if (error) {
    log({
      level: error.message === 'already_decided' ? 'info' : 'error',
      event: 'admission.accept_rpc_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown', reason: error.message ?? 'unknown' },
    });
    return mapRpcError(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : null) as DecisionRow | null;
  if (!row) {
    return { ok: false, code: 'decision_failed', message_key: 'errors.comod.decision_failed' };
  }

  // Side-effect e-mail/auth : la décision est déjà committée. Tout échec ici est
  // loggé mais NE renvoie PAS d'erreur (recoverable : recours manuel co-mod).
  await sendWelcome(row.requester_user_id, row.villa, guard.user.id);

  log({
    level: 'info',
    event: 'admission.accepted',
    user_id: row.requester_user_id,
    residence_id: row.residence_id,
    request_id: null,
    payload: { villa: row.villa, actor_id: guard.user.id },
  });

  return { ok: true };
}

export async function rejectAdmission(input: {
  admission_request_id: string;
  motive: string;
}): Promise<DecisionState> {
  const guard = await requireComod();
  if (!guard.ok) {
    return { ok: false, code: 'forbidden', message_key: 'errors.comod.forbidden' };
  }

  const parsed = zRejectAdmission.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    if (fieldErrors.admission_request_id) {
      return { ok: false, code: 'invalid_input', message_key: 'errors.comod.invalid_id' };
    }
    // Motif absent (clé manquante) vs motif invalide (hors enum)
    const hasMotive = 'motive' in (input ?? {});
    return hasMotive
      ? { ok: false, code: 'invalid_input', message_key: 'errors.comod.motive_invalid' }
      : { ok: false, code: 'invalid_input', message_key: 'errors.comod.motive_required' };
  }

  const admin = createAdminClient();

  const { data, error } = await admin.rpc('reject_admission', {
    p_admission_id: parsed.data.admission_request_id,
    p_actor_id: guard.user.id,
    p_reason: parsed.data.motive,
  });

  if (error) {
    log({
      level: error.message === 'already_decided' ? 'info' : 'error',
      event: 'admission.reject_rpc_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown', reason: error.message ?? 'unknown' },
    });
    return mapRpcError(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : null) as DecisionRow | null;
  if (!row) {
    return { ok: false, code: 'decision_failed', message_key: 'errors.comod.decision_failed' };
  }

  await sendRejection(row.requester_user_id, row.villa, parsed.data.motive, guard.user.id);

  log({
    level: 'info',
    event: 'admission.rejected',
    user_id: row.requester_user_id,
    residence_id: row.residence_id,
    request_id: null,
    payload: { villa: row.villa, motive: parsed.data.motive, actor_id: guard.user.id },
  });

  return { ok: true };
}

// --- Side effects (post-RPC, non bloquants) -------------------------------

async function sendWelcome(requesterUserId: string, villa: number, actorId: string): Promise<void> {
  const admin = createAdminClient();

  let email: string | null = null;
  let firstName: string | undefined;
  try {
    const { data } = await admin.auth.admin.getUserById(requesterUserId);
    email = data?.user?.email ?? null;
    const meta = data?.user?.user_metadata as Record<string, unknown> | undefined;
    if (typeof meta?.first_name === 'string') firstName = meta.first_name;
  } catch {
    email = null;
  }

  if (!email) {
    log({
      level: 'error',
      event: 'admission.accept_email_missing',
      user_id: requesterUserId,
      residence_id: null,
      request_id: null,
      payload: { actor_id: actorId },
    });
    return;
  }

  // Promotion JWT (D3) — indispensable pour la cohérence app_metadata ↔ role.
  // Drift-visibility : un échec ici laisse users.role='resident' mais JWT
  // 'demandeur' → on log en error (Sentry) sans bloquer.
  try {
    const { error } = await admin.auth.admin.updateUserById(requesterUserId, {
      app_metadata: { role: 'resident', residence_id: RESIDENCE_ID_DARNA },
    });
    if (error) {
      log({
        level: 'error',
        event: 'admission.app_metadata_sync_failed',
        user_id: requesterUserId,
        residence_id: null,
        request_id: null,
        payload: { errorCode: error.code ?? 'unknown', actor_id: actorId },
      });
    }
  } catch (cause) {
    log({
      level: 'error',
      event: 'admission.app_metadata_sync_failed',
      user_id: requesterUserId,
      residence_id: null,
      request_id: null,
      payload: { errorCode: 'thrown', errorName: cause instanceof Error ? cause.name : 'unknown' },
    });
  }

  // Magic-link de bienvenue. Story 6.3 — si la demande portait un `landing_path`
  // (visiteur venu d'une URL canonique d'entité), on le restitue en `next` : le
  // résident fraîchement accepté atterrit directement sur l'entité (FR39). Sans
  // landing_path → resolveRedirect lit state='accepted' → /community/ (story 1.6).
  let landingPath: string | null = null;
  try {
    const { data: req } = await admin
      .from('admission_requests')
      .select('landing_path')
      .eq('user_id', requesterUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    landingPath =
      req?.landing_path && isCanonicalEntityPath(req.landing_path) ? req.landing_path : null;
  } catch {
    landingPath = null;
  }
  const confirmUrl = landingPath
    ? `${baseUrl()}/auth/confirm?next=${encodeURIComponent(landingPath)}`
    : `${baseUrl()}/auth/confirm`;

  let actionLink: string | null = null;
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: confirmUrl },
    });
    if (!error) {
      actionLink = isSafeActionLink(data?.properties?.action_link)
        ? data.properties.action_link
        : null;
    }
  } catch {
    actionLink = null;
  }

  if (!actionLink) {
    log({
      level: 'error',
      event: 'admission.accept_link_missing',
      user_id: requesterUserId,
      residence_id: null,
      request_id: null,
      payload: { actor_id: actorId },
    });
    return;
  }

  try {
    const r = await sendTransactionalEmail({
      template: 'admission-validated',
      to: email,
      locale: DECISION_LOCALE,
      vars: { first_name: firstName, villa, magic_link: actionLink },
    });
    if (!r.ok) {
      log({
        level: 'error',
        event: 'admission.decision_notify_failed',
        user_id: requesterUserId,
        residence_id: null,
        request_id: null,
        payload: { errorCode: r.errorCode, decision: 'accepted' },
      });
    }
  } catch (cause) {
    log({
      level: 'error',
      event: 'admission.decision_notify_threw',
      user_id: requesterUserId,
      residence_id: null,
      request_id: null,
      payload: { errorName: cause instanceof Error ? cause.name : 'unknown', decision: 'accepted' },
    });
  }
}

async function sendRejection(
  requesterUserId: string,
  villa: number,
  motive: 'villa_out_of_range' | 'duplicate' | 'incomplete_info' | 'manual_review_needed',
  actorId: string,
): Promise<void> {
  const admin = createAdminClient();

  let email: string | null = null;
  try {
    const { data } = await admin.auth.admin.getUserById(requesterUserId);
    email = data?.user?.email ?? null;
  } catch {
    email = null;
  }

  if (!email) {
    log({
      level: 'error',
      event: 'admission.reject_email_missing',
      user_id: requesterUserId,
      residence_id: null,
      request_id: null,
      payload: { actor_id: actorId },
    });
    return;
  }

  try {
    const r = await sendTransactionalEmail({
      template: 'admission-rejected',
      to: email,
      locale: DECISION_LOCALE,
      vars: { villa, motive, privacy_url: `${baseUrl()}/fr/legal/confidentialite` },
    });
    if (!r.ok) {
      log({
        level: 'error',
        event: 'admission.decision_notify_failed',
        user_id: requesterUserId,
        residence_id: null,
        request_id: null,
        payload: { errorCode: r.errorCode, decision: 'rejected' },
      });
    }
  } catch (cause) {
    log({
      level: 'error',
      event: 'admission.decision_notify_threw',
      user_id: requesterUserId,
      residence_id: null,
      request_id: null,
      payload: { errorName: cause instanceof Error ? cause.name : 'unknown', decision: 'rejected' },
    });
  }
}
