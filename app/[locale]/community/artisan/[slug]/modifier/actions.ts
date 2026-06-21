'use server';

// Story 2.7 — édition & retrait d'une fiche par son contributeur.
//
// updateArtisan : (review 2026-06-20 P21/D2) RPC reconsent FIRST si PII change ;
//   commit non-PII + tags APRÈS seulement si reconsent OK. Atomicité applicative
//   (RPC est transactionnelle ; non-PII commit après seul → pas de partial-state
//   sur RPC fail). retractArtisan : RPC `retract_artisan` (gate atomique RETURNING,
//   ADR 0006 user_id NULL sur ratings cascade).
//
// Sécurité (AC9) : ownership vérifié 3× (UI isOwner, action `created_by`, RPC).
// Token raw jamais loggué. Role check `resident|co_mod` (P3 leçon 2.4 P7).
// `state='refused'` bloqué AVANT toute écriture (P6).

import { revalidatePath } from 'next/cache';
import {
  zEditArtisanForm,
  mapEditArtisanFieldError,
  zRetractArtisanConfirm,
  type EditArtisanFieldKey,
} from '@/lib/validation/artisan-edit';
import type { ArtisanFieldErrorKey } from '@/lib/validation/artisan';
import { piiChanged } from '@/lib/artisans/diff-pii';
import { diffTagKeys } from '@/lib/artisans/diff-tags';
import { createClient } from '@/lib/supabase/server';
import { requireResident } from '@/lib/auth/require-resident';
import { generateConsentToken } from '@/lib/consent/token';
import { sendTransactionalSms } from '@/lib/sms/send';
import { checkLimit } from '@/lib/rate-limit';
import { routing } from '@/lib/i18n/routing';
import { env } from '@/lib/env';
import { log } from '@/lib/logger';

const EDIT_RATE_LIMIT = 10;
const EDIT_RATE_WINDOW_SECONDS = 600;
const SMS_RATE_LIMIT_USER = 5;
const SMS_RATE_WINDOW_SECONDS = 3600;
const SMS_RATE_LIMIT_PHONE = 3;
const PHONE_NORMALIZE = /[\s.\-()]+/g;

type Reconsent = 'none' | 'in_place' | 'draft';

export type UpdateArtisanResult =
  | { ok: true; slug: string; reconsent: Reconsent; smsFailed?: boolean }
  | {
      ok: false;
      error:
        | { code: 'validation'; field: EditArtisanFieldKey; message_key: ArtisanFieldErrorKey }
        | { code: 'rate_limited'; message_key: 'errors.rate_limit.exceeded' }
        | { code: 'unauthenticated'; message_key: 'errors.forbidden' }
        | { code: 'forbidden'; message_key: 'errors.artisan.edit_forbidden' }
        | { code: 'phone_duplicate'; message_key: 'errors.artisan.phone_duplicate' }
        | { code: 'submit_failed'; message_key: 'errors.artisan.edit_submit_failed' };
    };

export type UpdateArtisanState = UpdateArtisanResult | { ok: false; idle: true };

export type RetractArtisanResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | { code: 'validation'; message_key: 'errors.artisan.confirm_mismatch' }
        | { code: 'rate_limited'; message_key: 'errors.rate_limit.exceeded' }
        | { code: 'unauthenticated'; message_key: 'errors.forbidden' }
        | { code: 'forbidden'; message_key: 'errors.artisan.edit_forbidden' }
        | { code: 'submit_failed'; message_key: 'errors.artisan.edit_submit_failed' };
    };
export type RetractArtisanState = RetractArtisanResult | { ok: false; idle: true };

function optional(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? undefined : s;
}

function siteOrigin(): string {
  return env.client.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
}

function safeLocale(raw: string): string {
  // P19 — locale attaquable via hidden input ; ne valider QUE contre la liste.
  return (routing.locales as readonly string[]).includes(raw) ? raw : 'fr';
}

async function assertResidentOrComod(
  userId: string,
): Promise<{ ok: true; residenceId: string } | { ok: false; reason: 'forbidden' }> {
  // P3 (leçon 2.4 P7) — requireResident ne gate pas le rôle ; check explicite.
  const supabase = await createClient();
  const { data } = await supabase
    .from('users')
    .select('role, residence_id, deleted_at')
    .eq('id', userId)
    .maybeSingle();
  if (!data || data.deleted_at !== null) return { ok: false, reason: 'forbidden' };
  if (data.role !== 'resident' && data.role !== 'co_mod') return { ok: false, reason: 'forbidden' };
  return { ok: true, residenceId: data.residence_id };
}

type ArtisanRow = {
  id: string;
  state: 'pending_consent' | 'published' | 'refused';
  deleted_at: string | null;
  display_name_fr: string;
  phone_e164: string;
  created_by: string | null;
  artisan_tags: { tags: { key: string } | null }[] | null;
};

export async function updateArtisan(
  _prev: UpdateArtisanState,
  formData: FormData,
): Promise<UpdateArtisanState> {
  const slug = String(formData.get('slug') ?? '').trim();
  const locale = safeLocale(String(formData.get('locale') ?? 'fr').trim());
  const rawPhone = String(formData.get('phone') ?? '')
    .trim()
    .replace(PHONE_NORMALIZE, '');
  const raw = {
    display_name_fr: String(formData.get('display_name_fr') ?? '').trim(),
    display_name_ar: String(formData.get('display_name_ar') ?? '').trim(),
    phone: rawPhone,
    tag_keys: formData.getAll('tag_keys').map(String),
    price_relative: optional(formData, 'price_relative'),
    has_invoice: optional(formData, 'has_invoice'),
  };

  const guard = await requireResident();
  if (!guard.ok) {
    return { ok: false, error: { code: 'unauthenticated', message_key: 'errors.forbidden' } };
  }
  const userId = guard.user.id;

  // P3 — role + deleted_at check.
  const roleCheck = await assertResidentOrComod(userId);
  if (!roleCheck.ok) {
    return {
      ok: false,
      error: { code: 'forbidden', message_key: 'errors.artisan.edit_forbidden' },
    };
  }

  const rl = await checkLimit(`artisan-edit:${userId}`, EDIT_RATE_LIMIT, EDIT_RATE_WINDOW_SECONDS);
  if (!rl.success) {
    return {
      ok: false,
      error: { code: 'rate_limited', message_key: 'errors.rate_limit.exceeded' },
    };
  }

  const parsed = zEditArtisanForm.safeParse(raw);
  if (!parsed.success) {
    const field = (parsed.error.issues[0]?.path[0] as EditArtisanFieldKey) ?? 'display_name_fr';
    return {
      ok: false,
      error: { code: 'validation', field, message_key: mapEditArtisanFieldError(field) },
    };
  }
  const form = parsed.data;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from('artisans')
    .select(
      'id, state, deleted_at, display_name_fr, phone_e164, created_by, artisan_tags ( tags ( key ) )',
    )
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();
  const artisan = row as ArtisanRow | null;
  if (!artisan || artisan.created_by !== userId) {
    return {
      ok: false,
      error: { code: 'forbidden', message_key: 'errors.artisan.edit_forbidden' },
    };
  }

  // P6 — `state='refused'` ne doit JAMAIS pouvoir être muté (defense in depth).
  if (artisan.state === 'refused') {
    return {
      ok: false,
      error: { code: 'forbidden', message_key: 'errors.artisan.edit_forbidden' },
    };
  }

  const pii = piiChanged(
    { display_name_fr: artisan.display_name_fr, phone_e164: artisan.phone_e164 },
    { display_name_fr: form.display_name_fr, phone_e164: form.phone },
  );

  // P21 (D2) — RPC reconsent FIRST si PII change. Si elle échoue, on n'a RIEN
  // écrit (atomicité applicative). Le commit non-PII + tags se fait APRÈS.
  let reconsent: Reconsent = 'none';
  let smsResult: Awaited<ReturnType<typeof sendTransactionalSms>> | null = null;

  if (pii) {
    // P11 — rate-limit double : par contributeur ET par phone destinataire.
    const rlUser = await checkLimit(
      `artisan-sms-user:${userId}`,
      SMS_RATE_LIMIT_USER,
      SMS_RATE_WINDOW_SECONDS,
    );
    if (!rlUser.success) {
      return {
        ok: false,
        error: { code: 'rate_limited', message_key: 'errors.rate_limit.exceeded' },
      };
    }
    const rlPhone = await checkLimit(
      `artisan-sms-phone:${form.phone}`,
      SMS_RATE_LIMIT_PHONE,
      SMS_RATE_WINDOW_SECONDS,
    );
    if (!rlPhone.success) {
      return {
        ok: false,
        error: { code: 'rate_limited', message_key: 'errors.rate_limit.exceeded' },
      };
    }

    const { raw: rawToken, hash } = generateConsentToken(env.server.CONSENT_TOKEN_SECRET);
    const { data: rpcData, error: rpcErr } = await supabase.rpc('request_artisan_reconsent', {
      p_artisan_id: artisan.id,
      p_new_name_fr: form.display_name_fr,
      p_new_phone: form.phone,
      p_new_token_hash: hash,
    });
    if (rpcErr) {
      // P2 — phone_already_used détecté côté RPC (avant 23505 silencieux).
      if (rpcErr.message?.includes('phone_already_used')) {
        return {
          ok: false,
          error: { code: 'phone_duplicate', message_key: 'errors.artisan.phone_duplicate' },
        };
      }
      log({
        level: 'error',
        event: 'artisan.edit_reconsent_failed',
        user_id: userId,
        residence_id: roleCheck.residenceId,
        request_id: null,
        payload: { errorCode: rpcErr.code ?? 'unknown' },
      });
      return {
        ok: false,
        error: { code: 'submit_failed', message_key: 'errors.artisan.edit_submit_failed' },
      };
    }

    const rpcRow = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
      | { sms_target_phone: string; sms_artisan_name: string }
      | undefined;
    const smsTarget = rpcRow?.sms_target_phone ?? form.phone;
    const smsName = rpcRow?.sms_artisan_name ?? form.display_name_fr;

    // P22 (D3) — template dédié `artisan-reconsent` (vs invitation initiale).
    smsResult = await sendTransactionalSms({
      template: 'artisan-reconsent',
      to: smsTarget,
      vars: { artisanName: smsName, link: `${siteOrigin()}/consent/${rawToken}` },
    });
    reconsent = artisan.state === 'published' ? 'draft' : 'in_place';
  }

  // P5/P6/P21 — commit non-PII APRÈS RPC OK : pas de partial-state sur fail.
  // .select() pour détecter 0 rows (race contre soft-delete dans un autre onglet).
  const { data: updated, error: updErr } = await supabase
    .from('artisans')
    .update({
      display_name_ar: form.display_name_ar ? form.display_name_ar : null,
      price_relative: form.price_relative ?? null,
      has_invoice: form.has_invoice ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', artisan.id)
    .select('id');
  if (updErr || !updated || updated.length === 0) {
    log({
      level: 'error',
      event: 'artisan.edit_update_failed',
      user_id: userId,
      residence_id: roleCheck.residenceId,
      request_id: null,
      payload: { errorCode: updErr?.code ?? 'zero_rows' },
    });
    return {
      ok: false,
      error: { code: 'submit_failed', message_key: 'errors.artisan.edit_submit_failed' },
    };
  }

  // P4 — Tags diff : check INSERT en premier (DELETE n'est exécuté qu'après
  // validation que toutes les keys cibles existent → pas d'état "fiche vide").
  const currentKeys = (artisan.artisan_tags ?? [])
    .map((at) => at.tags?.key)
    .filter((k): k is string => !!k);
  const { toAdd, toRemove } = diffTagKeys(currentKeys, form.tag_keys);
  if (toAdd.length > 0 || toRemove.length > 0) {
    const touched = [...toAdd, ...toRemove];
    const { data: tagRows } = await supabase.from('tags').select('id, key').in('key', touched);
    const idByKey = new Map((tagRows ?? []).map((t) => [t.key, t.id]));
    if (toAdd.some((k) => !idByKey.has(k))) {
      return {
        ok: false,
        error: {
          code: 'validation',
          field: 'tag_keys',
          message_key: 'errors.artisan.tags_required',
        },
      };
    }

    // P4 — INSERT new tags d'abord (fiche peut transitoirement avoir N+M tags),
    // puis DELETE old. Si INSERT fail, anciens tags intacts ; si DELETE fail,
    // doublons transitoires mais fiche reste fonctionnelle (≥1 tag garanti).
    if (toAdd.length > 0) {
      const links = toAdd.map((k) => ({ artisan_id: artisan.id, tag_id: idByKey.get(k)! }));
      const { error: insErr } = await supabase.from('artisan_tags').insert(links);
      if (insErr) {
        log({
          level: 'error',
          event: 'artisan.edit_tags_insert_failed',
          user_id: userId,
          residence_id: roleCheck.residenceId,
          request_id: null,
          payload: { errorCode: insErr.code ?? 'unknown' },
        });
        return {
          ok: false,
          error: { code: 'submit_failed', message_key: 'errors.artisan.edit_submit_failed' },
        };
      }
    }
    if (toRemove.length > 0) {
      const removeIds = toRemove.map((k) => idByKey.get(k)!).filter(Boolean);
      const { error: delErr } = await supabase
        .from('artisan_tags')
        .delete()
        .eq('artisan_id', artisan.id)
        .in('tag_id', removeIds);
      if (delErr) {
        log({
          level: 'warn',
          event: 'artisan.edit_tags_delete_failed',
          user_id: userId,
          residence_id: roleCheck.residenceId,
          request_id: null,
          payload: { errorCode: delErr.code ?? 'unknown' },
        });
        // Pas de retour d'erreur : la fiche a les nouveaux tags + les anciens
        // (doublons cosmétiques) ; UI dégradée mais fonctionnelle.
      }
    }
  }

  revalidatePath(`/${locale}/community/artisan/${slug}`);
  if (pii && smsResult && !smsResult.ok) {
    log({
      level: 'error',
      event: 'artisan.edit_sms_failed',
      user_id: userId,
      residence_id: roleCheck.residenceId,
      request_id: null,
      payload: { errorCode: smsResult.errorCode },
    });
    return { ok: true, slug, reconsent, smsFailed: true };
  }
  return { ok: true, slug, reconsent };
}

export async function retractArtisan(
  _prev: RetractArtisanState,
  formData: FormData,
): Promise<RetractArtisanState> {
  const slug = String(formData.get('slug') ?? '').trim();
  const locale = safeLocale(String(formData.get('locale') ?? 'fr').trim());

  const guard = await requireResident();
  if (!guard.ok) {
    return { ok: false, error: { code: 'unauthenticated', message_key: 'errors.forbidden' } };
  }
  const userId = guard.user.id;

  // P3 — role check.
  const roleCheck = await assertResidentOrComod(userId);
  if (!roleCheck.ok) {
    return {
      ok: false,
      error: { code: 'forbidden', message_key: 'errors.artisan.edit_forbidden' },
    };
  }

  // P11 (étendu retract) — rate-limit léger contre bruteforce slugs.
  const rl = await checkLimit(
    `artisan-retract:${userId}`,
    EDIT_RATE_LIMIT,
    EDIT_RATE_WINDOW_SECONDS,
  );
  if (!rl.success) {
    return {
      ok: false,
      error: { code: 'rate_limited', message_key: 'errors.rate_limit.exceeded' },
    };
  }

  const confirmParsed = zRetractArtisanConfirm.safeParse({
    confirm: String(formData.get('confirm') ?? ''),
  });
  if (!confirmParsed.success) {
    return {
      ok: false,
      error: { code: 'validation', message_key: 'errors.artisan.confirm_mismatch' },
    };
  }

  const supabase = await createClient();
  const { data: artisan } = await supabase
    .from('artisans')
    .select('id, created_by')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();
  if (!artisan || artisan.created_by !== userId) {
    return {
      ok: false,
      error: { code: 'forbidden', message_key: 'errors.artisan.edit_forbidden' },
    };
  }

  const { error: rpcErr } = await supabase.rpc('retract_artisan', { p_artisan_id: artisan.id });
  if (rpcErr) {
    log({
      level: 'error',
      event: 'artisan.retract_failed',
      user_id: userId,
      residence_id: roleCheck.residenceId,
      request_id: null,
      payload: { errorCode: rpcErr.code ?? 'unknown' },
    });
    return {
      ok: false,
      error: { code: 'submit_failed', message_key: 'errors.artisan.edit_submit_failed' },
    };
  }

  revalidatePath(`/${locale}/community/annuaire`);
  revalidatePath(`/${locale}/community/artisan/${slug}`);
  return { ok: true };
}
