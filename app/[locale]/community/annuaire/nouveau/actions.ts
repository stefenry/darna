'use server';

// Story 2.4 — createArtisan : crée un artisan en `pending_consent` + token de
// consentement HMAC + envoie le SMS magic-link à l'artisan. Lecture seule pour
// les autres (la fiche n'apparaît qu'après consentement, story 2.5).
//
// Sécurité / défense en profondeur :
//   - INSERT artisans + artisan_tags via le client SESSION → RLS + GRANT
//     column-level forcent `state='pending_consent'` (jamais forgé) et la
//     cohérence created_by/residence.
//   - INSERT artisan_consent_tokens via le client ADMIN (table deny-all client, 2.1).
//   - Lookup de slug global via ADMIN (slug unique global, inclut tombstones).
//   - UNIQUE index `(phone_e164) where deleted_at is null and state != 'refused'`
//     (review P16) → la contrainte DB est source de vérité ; détecter 23505.
//   - raw token jamais loggué/stocké ; seul le HMAC en DB.
//   - rate-limit anti-spam SMS (D6) : par userId ET par phone destinataire (P2).
//
// Décisions actées (review 2026-06-18) :
//   - D1 → visibilité persistée dans `profiles.identity_mode` (mémorisation auto)
//   - D2 → contrainte DB UNIQUE + détection 23505

import {
  zCreateArtisanForm,
  mapArtisanFieldError,
  type ArtisanFieldKey,
  type ArtisanFieldErrorKey,
} from '@/lib/validation/artisan';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireResident } from '@/lib/auth/require-resident';
import { resolveUniqueSlug } from '@/lib/slug/resolve';
import { generateConsentToken } from '@/lib/consent/token';
import { sendTransactionalSms, isSmsDisabled } from '@/lib/sms/send';
import { checkLimit } from '@/lib/rate-limit';
import { mapVisibilityToIdentityMode } from '@/lib/artisans/visibility';
import { env } from '@/lib/env';
import { log } from '@/lib/logger';

// Review 2026-06-19 P28 (D1 mitigation 5) — TTL réduit 7j → 24h. Le raw token
// reste dans l'URL/SMS de l'artisan ; raccourcir la fenêtre de leak. Si délai
// trop court en pratique, ré-augmenter et coupler avec une relance auto (E7).
const CONSENT_EXPIRY_DAYS = 1;
const CREATE_RATE_LIMIT = 5;
const CREATE_RATE_WINDOW_SECONDS = 3600;
const PHONE_RATE_LIMIT = 3;
const PHONE_RATE_WINDOW_SECONDS = 3600;

const PHONE_NORMALIZE = /[\s.\-()]+/g;

export type CreateArtisanResult =
  | { ok: true; slug: string; display_name: string; smsFailed?: boolean }
  | {
      ok: false;
      error:
        | { code: 'validation'; field: ArtisanFieldKey; message_key: ArtisanFieldErrorKey }
        | {
            code: 'phone_duplicate';
            message_key: 'errors.artisan.phone_duplicate';
            existing_slug: string;
          }
        | { code: 'rate_limited'; message_key: 'errors.rate_limit' }
        | { code: 'unauthenticated'; message_key: 'errors.forbidden' }
        | { code: 'missing_residence'; message_key: 'errors.artisan.missing_residence' }
        | { code: 'submit_failed'; message_key: 'errors.artisan.submit_failed' };
    };

/** État `useActionState` : idle initial OU résultat de soumission. */
export type CreateArtisanState = CreateArtisanResult | { ok: false; idle: true };

function optional(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? undefined : s;
}

function siteOrigin(): string {
  return env.client.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
}

// Review 2.6 P11 — helper extrait dans `lib/artisans/visibility.ts` (dedupe).

async function findSlugByPhone(
  admin: ReturnType<typeof createAdminClient>,
  phone: string,
): Promise<string | null> {
  const { data } = await admin
    .from('artisans')
    .select('slug')
    .eq('phone_e164', phone)
    .is('deleted_at', null)
    .neq('state', 'refused')
    .limit(1)
    .maybeSingle();
  return data?.slug ?? null;
}

export async function createArtisan(
  _prev: CreateArtisanState,
  formData: FormData,
): Promise<CreateArtisanState> {
  // Review P11 — normaliser le phone (strip whitespace/séparateurs) avant Zod.
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
    comment: String(formData.get('comment') ?? '').trim(),
    visibility: optional(formData, 'visibility') ?? 'pseudonym',
    consent_confirmed: formData.get('consent_confirmed') === 'on',
  };

  const guard = await requireResident();
  if (!guard.ok) {
    return { ok: false, error: { code: 'unauthenticated', message_key: 'errors.forbidden' } };
  }
  const userId = guard.user.id;

  // Rate-limit par contributeur (D6 anti-spam SMS).
  const rlUser = await checkLimit(
    `artisan-create:${userId}`,
    CREATE_RATE_LIMIT,
    CREATE_RATE_WINDOW_SECONDS,
  );
  if (!rlUser.success) {
    return { ok: false, error: { code: 'rate_limited', message_key: 'errors.rate_limit' } };
  }

  const parsed = zCreateArtisanForm.safeParse(raw);
  if (!parsed.success) {
    const field = (parsed.error.issues[0]?.path[0] as ArtisanFieldKey) ?? 'display_name_fr';
    return {
      ok: false,
      error: { code: 'validation', field, message_key: mapArtisanFieldError(field) },
    };
  }
  const form = parsed.data;

  // Review P2 — rate-limit secondaire par phone destinataire (anti-harcèlement
  // cross-comptes). Appliqué après Zod (donc phone valide E.164 normalisé).
  const rlPhone = await checkLimit(
    `artisan-sms:${form.phone}`,
    PHONE_RATE_LIMIT,
    PHONE_RATE_WINDOW_SECONDS,
  );
  if (!rlPhone.success) {
    return { ok: false, error: { code: 'rate_limited', message_key: 'errors.rate_limit' } };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  // Résidence + rôle (review P7 — `requireResident` ne gate pas le rôle ;
  // un `demandeur` authentifié serait sinon refusé silencieusement par RLS).
  const { data: me } = await supabase
    .from('users')
    .select('residence_id, role')
    .eq('id', userId)
    .maybeSingle();
  if (!me?.residence_id) {
    return {
      ok: false,
      error: { code: 'missing_residence', message_key: 'errors.artisan.missing_residence' },
    };
  }
  if (me.role !== 'resident' && me.role !== 'co_mod') {
    return { ok: false, error: { code: 'unauthenticated', message_key: 'errors.forbidden' } };
  }
  const residenceId = me.residence_id;

  // Dédup phone côté app (UX rapide). La source de vérité = contrainte DB
  // `artisans_phone_e164_active_unique` (review P16 migration). On laisse
  // donc passer à l'INSERT et on détectera `23505` au besoin (lookup admin
  // post-conflict pour récupérer le slug existant).
  const preDup = await findSlugByPhone(admin, form.phone);
  if (preDup) {
    return {
      ok: false,
      error: {
        code: 'phone_duplicate',
        message_key: 'errors.artisan.phone_duplicate',
        existing_slug: preDup,
      },
    };
  }

  // Slug unique global (lookup ADMIN : voit tous les slugs, tombstones inclus).
  const slug = await resolveUniqueSlug(form.display_name_fr, async (base) => {
    const { data } = await admin.from('artisans').select('slug').like('slug', `${base}%`);
    return (data ?? []).map((r) => r.slug);
  });

  // INSERT artisan (client session : GRANT column-level → state au défaut).
  const { data: inserted, error: insErr } = await supabase
    .from('artisans')
    .insert({
      slug,
      residence_id: residenceId,
      display_name_fr: form.display_name_fr,
      display_name_ar: form.display_name_ar ? form.display_name_ar : null,
      phone_e164: form.phone,
      price_relative: form.price_relative ?? null,
      has_invoice: form.has_invoice ?? null,
      created_by: userId,
    })
    .select('id')
    .single();
  if (insErr || !inserted) {
    // Review P16 — détecter 23505 sur la contrainte unique phone.
    if (insErr?.code === '23505' && /phone_e164/i.test(insErr.message ?? '')) {
      const existing = await findSlugByPhone(admin, form.phone);
      return {
        ok: false,
        error: {
          code: 'phone_duplicate',
          message_key: 'errors.artisan.phone_duplicate',
          existing_slug: existing ?? '',
        },
      };
    }
    log({
      level: 'error',
      event: 'artisan.create_insert_failed',
      user_id: userId,
      residence_id: residenceId,
      request_id: null,
      payload: { errorCode: insErr?.code ?? 'unknown' },
    });
    return {
      ok: false,
      error: { code: 'submit_failed', message_key: 'errors.artisan.submit_failed' },
    };
  }
  const artisanId = inserted.id;

  // Tags (lookup id par key via session — tags lisibles ; INSERT via session,
  // policy artisan_tags_resident_insert : artisan créé par moi).
  // Review P1 — détecter les keys forgées/typos : cardinalité doit matcher.
  const { data: tagRows } = await supabase.from('tags').select('id, key').in('key', form.tag_keys);
  if ((tagRows ?? []).length !== form.tag_keys.length) {
    log({
      level: 'warn',
      event: 'artisan.create_tags_unknown_keys',
      user_id: userId,
      residence_id: residenceId,
      request_id: null,
      payload: {
        submitted: form.tag_keys.length,
        resolved: (tagRows ?? []).length,
      },
    });
    return {
      ok: false,
      error: { code: 'validation', field: 'tag_keys', message_key: 'errors.artisan.tags_required' },
    };
  }
  const links = (tagRows ?? []).map((t) => ({ artisan_id: artisanId, tag_id: t.id }));
  if (links.length > 0) {
    const { error: tagErr } = await supabase.from('artisan_tags').insert(links);
    if (tagErr) {
      // Review P6 — ne plus continuer silencieusement : l'artisan publié sans
      // compétences serait invisible aux filtres → submit_failed (orphan bénin
      // documenté, retry possible).
      log({
        level: 'error',
        event: 'artisan.create_tags_failed',
        user_id: userId,
        residence_id: residenceId,
        request_id: null,
        payload: { errorCode: tagErr.code ?? 'unknown' },
      });
      return {
        ok: false,
        error: { code: 'submit_failed', message_key: 'errors.artisan.submit_failed' },
      };
    }
  }

  // Token de consentement (ADMIN — table deny-all client).
  const { raw: rawToken, hash } = generateConsentToken(env.server.CONSENT_TOKEN_SECRET);
  const expiresAt = new Date(Date.now() + CONSENT_EXPIRY_DAYS * 86_400_000).toISOString();
  const { error: tokErr } = await admin.from('artisan_consent_tokens').insert({
    artisan_id: artisanId,
    residence_id: residenceId,
    token_hash: hash,
    expires_at: expiresAt,
  });
  if (tokErr) {
    // Artisan orphelin en pending (invisible aux autres, bénin) — on échoue côté UX.
    log({
      level: 'error',
      event: 'artisan.create_token_failed',
      user_id: userId,
      residence_id: residenceId,
      request_id: null,
      payload: { errorCode: tokErr.code ?? 'unknown' },
    });
    return {
      ok: false,
      error: { code: 'submit_failed', message_key: 'errors.artisan.submit_failed' },
    };
  }

  // Review P15 (D1) — mémorisation visibility dans `profiles.identity_mode`.
  // Mapping form → DB enum. UPDATE via session (GRANT col-level autorise).
  const identityMode = mapVisibilityToIdentityMode(form.visibility);
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ identity_mode: identityMode })
    .eq('user_id', userId);
  if (profileErr) {
    // Bénin : l'artisan est créé, le profil garde l'ancien identity_mode.
    log({
      level: 'warn',
      event: 'artisan.create_profile_update_failed',
      user_id: userId,
      residence_id: residenceId,
      request_id: null,
      payload: { errorCode: profileErr.code ?? 'unknown' },
    });
  }

  // Interim 2026-07-23 — envoi SMS coupé : la coche « accord de l'artisan »
  // (gate CNDP du formulaire) + la validation co_mod (publier sans attendre le
  // consentement) portent le flux. La fiche reste pending_consent comme avant.
  if (isSmsDisabled()) {
    log({
      level: 'info',
      event: 'artisan.create_sms_skipped',
      user_id: userId,
      residence_id: residenceId,
      request_id: null,
      payload: { reason: 'sms_disabled' },
    });
    return { ok: true, slug, display_name: form.display_name_fr };
  }

  // SMS magic-link (effet de bord post-commit). Review P5 — surface l'échec
  // dans le résultat pour permettre à l'UI d'afficher un avertissement.
  const link = `${siteOrigin()}/consent/${rawToken}`;
  const sms = await sendTransactionalSms({
    template: 'artisan-consent',
    to: form.phone,
    vars: { artisanName: form.display_name_fr, link },
  });
  if (!sms.ok) {
    log({
      level: 'error',
      event: 'artisan.create_sms_failed',
      user_id: userId,
      residence_id: residenceId,
      request_id: null,
      payload: { errorCode: sms.errorCode },
    });
    return { ok: true, slug, display_name: form.display_name_fr, smsFailed: true };
  }

  return { ok: true, slug, display_name: form.display_name_fr };
}
