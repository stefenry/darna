'use server';

// Story 4.3 — createTip : publication d'un bon plan typé expirable (FR29).
// INSERT via client SESSION (RLS tips_resident_insert_own + GRANT). Trace
// moderation_log `tip_created` posée par le trigger AFTER INSERT (4.1).
// L'expiration explicite (picker date) est validée ICI : passée ou > 30j →
// `invalid_expiration` (AC2 / AR18). Notification opt-in : plumbing Epic 7.

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireResident } from '@/lib/auth/require-resident';
import { checkLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { TIP_MAX_EXPIRY_DAYS, type TipCategoryKey } from '@/lib/content/ephemeral';
import {
  zCreateTip,
  mapTipFieldError,
  buildEphemeralSlug,
  type EphemeralFieldErrorKey,
} from '@/lib/validation/ephemeral-content';

const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 3600;

export type CreateTipResult =
  | { ok: true; slug: string }
  | {
      ok: false;
      error:
        | { code: 'validation'; field: string; message_key: EphemeralFieldErrorKey }
        | { code: 'rate_limited' }
        | { code: 'forbidden' }
        | { code: 'submit_failed' };
    };

export type CreateTipState = CreateTipResult | { ok: false; idle: true };

export const CREATE_TIP_INITIAL: CreateTipState = { ok: false, idle: true };

function field(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Borne l'expiration : la date `YYYY-MM-DD` du picker est interprétée en fin de
 * journée locale (23:59:59) ; doit être dans le futur et ≤ 30j. Renvoie l'ISO ou
 * null (→ invalid_expiration).
 */
function resolveExpiresAt(expiresOn: string): string | null {
  const end = new Date(`${expiresOn}T23:59:59`);
  if (Number.isNaN(end.getTime())) return null;
  const now = Date.now();
  const max = now + TIP_MAX_EXPIRY_DAYS * 86_400_000;
  if (end.getTime() <= now || end.getTime() > max) return null;
  return end.toISOString();
}

export async function createTip(
  _prev: CreateTipState,
  formData: FormData,
): Promise<CreateTipState> {
  const guard = await requireResident();
  if (!guard.ok) return { ok: false, error: { code: 'forbidden' } };
  const userId = guard.user.id;

  const rl = await checkLimit(`tip-create:${userId}`, RATE_LIMIT, RATE_WINDOW_SECONDS);
  if (!rl.success) return { ok: false, error: { code: 'rate_limited' } };

  const parsed = zCreateTip.safeParse({
    category_key: field(formData, 'category_key'),
    title_fr: field(formData, 'title_fr'),
    title_ar: field(formData, 'title_ar'),
    body_fr: field(formData, 'body_fr'),
    body_ar: field(formData, 'body_ar'),
    expires_on: field(formData, 'expires_on'),
  });
  if (!parsed.success) {
    const path = String(parsed.error.issues[0]?.path[0] ?? '');
    return {
      ok: false,
      error: { code: 'validation', field: path, message_key: mapTipFieldError(path) },
    };
  }
  const form = parsed.data;

  const expiresAt = resolveExpiresAt(form.expires_on);
  if (!expiresAt) {
    return {
      ok: false,
      error: { code: 'validation', field: 'expires_on', message_key: 'invalid_expiration' },
    };
  }

  const supabase = await createClient();

  const { data: me } = await supabase
    .from('users')
    .select('residence_id, role')
    .eq('id', userId)
    .maybeSingle();
  if (!me?.residence_id || (me.role !== 'resident' && me.role !== 'co_mod')) {
    return { ok: false, error: { code: 'forbidden' } };
  }

  const slug = buildEphemeralSlug(form.title_fr, 'bon-plan');

  const { error: insErr } = await supabase.from('tips').insert({
    slug,
    residence_id: me.residence_id,
    category_key: form.category_key as TipCategoryKey,
    title_fr: form.title_fr,
    title_ar: form.title_ar,
    body_fr: form.body_fr,
    body_ar: form.body_ar,
    expires_at: expiresAt,
  });
  if (insErr) {
    log({
      level: 'error',
      event: 'tip.create_insert_failed',
      user_id: userId,
      residence_id: me.residence_id,
      request_id: null,
      payload: { errorCode: insErr.code ?? 'unknown', category: form.category_key },
    });
    return { ok: false, error: { code: 'submit_failed' } };
  }

  revalidatePath(`/[locale]/community/alertes`, 'page');
  return { ok: true, slug };
}
