'use server';

// Story 4.2 — createAlert : publication d'une alerte éphémère depuis un modèle
// pré-rédigé (FR27), en ~1 tap. INSERT via le client SESSION → RLS
// (alerts_resident_insert_own) + GRANT column-level forcent residence/auteur.
// La trace moderation_log `alert_created` est posée par le trigger AFTER INSERT
// (4.1) — l'action n'y touche pas (AR19). La notification opt-in (Epic 7) lira
// notifications_prefs ; rien à programmer ici (plumbing différé).

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireResident } from '@/lib/auth/require-resident';
import { checkLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import {
  zCreateAlert,
  mapAlertFieldError,
  buildEphemeralSlug,
  type EphemeralFieldErrorKey,
} from '@/lib/validation/ephemeral-content';

const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 3600;

export type CreateAlertResult =
  | { ok: true; slug: string }
  | {
      ok: false;
      error:
        | { code: 'validation'; field: string; message_key: EphemeralFieldErrorKey }
        | { code: 'rate_limited' }
        | { code: 'forbidden' }
        | { code: 'submit_failed' };
    };

export type CreateAlertState = CreateAlertResult | { ok: false; idle: true };

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export async function createAlert(
  _prev: CreateAlertState,
  formData: FormData,
): Promise<CreateAlertState> {
  const guard = await requireResident();
  if (!guard.ok) return { ok: false, error: { code: 'forbidden' } };
  const userId = guard.user.id;

  const rl = await checkLimit(`alert-create:${userId}`, RATE_LIMIT, RATE_WINDOW_SECONDS);
  if (!rl.success) return { ok: false, error: { code: 'rate_limited' } };

  const parsed = zCreateAlert.safeParse({
    template_key: field(formData, 'template_key'),
    title_fr: field(formData, 'title_fr'),
    title_ar: field(formData, 'title_ar'),
    body_fr: field(formData, 'body_fr'),
    body_ar: field(formData, 'body_ar'),
    duration_hours: field(formData, 'duration_hours'),
  });
  if (!parsed.success) {
    const path = String(parsed.error.issues[0]?.path[0] ?? '');
    return {
      ok: false,
      error: { code: 'validation', field: path, message_key: mapAlertFieldError(path) },
    };
  }
  const form = parsed.data;

  const supabase = await createClient();

  // Résidence + gate rôle (requireResident ne gate pas le rôle — review 2.4 P7).
  const { data: me } = await supabase
    .from('users')
    .select('residence_id, role')
    .eq('id', userId)
    .maybeSingle();
  if (!me?.residence_id || (me.role !== 'resident' && me.role !== 'co_mod')) {
    return { ok: false, error: { code: 'forbidden' } };
  }

  // template_id depuis la clé (référentiel lisible par le résident, RLS).
  const { data: tpl } = await supabase
    .from('alert_templates')
    .select('id')
    .eq('template_key', form.template_key)
    .maybeSingle();

  const slug = buildEphemeralSlug(form.title_fr, 'alerte');
  const expiresAt = new Date(Date.now() + form.duration_hours * 3_600_000).toISOString();

  const { error: insErr } = await supabase.from('alerts').insert({
    slug,
    residence_id: me.residence_id,
    template_id: tpl?.id ?? null,
    title_fr: form.title_fr,
    title_ar: form.title_ar,
    body_fr: form.body_fr,
    body_ar: form.body_ar,
    expires_at: expiresAt,
  });
  if (insErr) {
    log({
      level: 'error',
      event: 'alert.create_insert_failed',
      user_id: userId,
      residence_id: me.residence_id,
      request_id: null,
      payload: { errorCode: insErr.code ?? 'unknown', durationHours: form.duration_hours },
    });
    return { ok: false, error: { code: 'submit_failed' } };
  }

  revalidatePath(`/[locale]/community/alertes`, 'page');
  return { ok: true, slug };
}
