'use server';

// Story 2.6 — submitRating : crée OU met à jour la note typée du contributeur
// courant sur un artisan publié. Écriture via le client SESSION uniquement → les
// RLS `ratings_resident_insert` / `ratings_resident_update_own` + les GRANT
// column-level sont l'enforcement réel (NFR21 — vérif serveur, pas client).
//
// Décisions (story spec §Décisions) :
//   - Upsert = select-then-branch (PAS `.upsert()` brut : les GRANT colonne
//     diffèrent entre INSERT et UPDATE → un upsert PostgREST heurterait le
//     chemin UPDATE sur conflit).
//   - `unique(artisan_id, user_id)` → 1 note/voisin/artisan ; re-vote = UPDATE.
//   - Visibilité mémorisée sur `profiles.identity_mode` (FR16, cohérent 2.4 D1).
//   - Axe « Non applicable » = `NULL` explicite (pas 0) ; ≥ 1 axe validé Zod + DB.

import { revalidatePath } from 'next/cache';
import {
  zRatingForm,
  mapRatingFieldError,
  type RatingFieldKey,
  type RatingFieldErrorKey,
} from '@/lib/validation/rating';
import { createClient } from '@/lib/supabase/server';
import { requireResident } from '@/lib/auth/require-resident';
import { checkLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';

const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 600;

export type RatingResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | { code: 'validation'; field: RatingFieldKey; message_key: RatingFieldErrorKey }
        | { code: 'rate_limited'; message_key: 'errors.rate_limit.exceeded' }
        | { code: 'unauthenticated'; message_key: 'errors.forbidden' }
        | { code: 'forbidden'; message_key: 'errors.forbidden' }
        | { code: 'artisan_not_found'; message_key: 'errors.rating.artisan_not_found' }
        | { code: 'submit_failed'; message_key: 'errors.rating.submit_failed' };
    };

/** État `useActionState` : idle initial OU résultat de soumission. */
export type RatingState = RatingResult | { ok: false; idle: true };

export const RATING_INITIAL: RatingState = { ok: false, idle: true };

function mapVisibilityToIdentityMode(v: 'pseudonym' | 'named'): 'pseudo' | 'identified' {
  return v === 'named' ? 'identified' : 'pseudo';
}

/** Lit un score : string "1".."5" si noté, undefined si « Non applicable » (champ absent/vide). */
function scoreRaw(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

export async function submitRating(_prev: RatingState, formData: FormData): Promise<RatingState> {
  const slug = String(formData.get('slug') ?? '').trim();
  const locale = String(formData.get('locale') ?? 'fr').trim();

  const raw = {
    score_depannage: scoreRaw(formData, 'score_depannage'),
    score_petits_travaux: scoreRaw(formData, 'score_petits_travaux'),
    score_travail_soigne: scoreRaw(formData, 'score_travail_soigne'),
    score_urgences: scoreRaw(formData, 'score_urgences'),
    comment: String(formData.get('comment') ?? '').trim(),
    visibility: (formData.get('visibility') as string) || 'pseudonym',
  };

  const guard = await requireResident();
  if (!guard.ok) {
    return { ok: false, error: { code: 'unauthenticated', message_key: 'errors.forbidden' } };
  }
  const userId = guard.user.id;

  const rl = await checkLimit(`rating-submit:${userId}`, RATE_LIMIT, RATE_WINDOW_SECONDS);
  if (!rl.success) {
    return {
      ok: false,
      error: { code: 'rate_limited', message_key: 'errors.rate_limit.exceeded' },
    };
  }

  const parsed = zRatingForm.safeParse(raw);
  if (!parsed.success) {
    const field = (parsed.error.issues[0]?.path[0] as RatingFieldKey) ?? 'scores';
    return {
      ok: false,
      error: { code: 'validation', field, message_key: mapRatingFieldError(field) },
    };
  }
  const form = parsed.data;

  const supabase = await createClient();

  // Rôle + résidence (review P7 — `requireResident` ne gate pas le rôle).
  // `residence_id` vient de la table users, jamais du form.
  const { data: me } = await supabase
    .from('users')
    .select('residence_id, role')
    .eq('id', userId)
    .maybeSingle();
  if (!me?.residence_id || (me.role !== 'resident' && me.role !== 'co_mod')) {
    return { ok: false, error: { code: 'forbidden', message_key: 'errors.forbidden' } };
  }
  const residenceId = me.residence_id;

  // Artisan publié résolu par slug (RLS `artisans_resident_select_published`
  // ne renvoie que les publiés de la résidence ; un pending/refused → not_found).
  const { data: artisan } = await supabase
    .from('artisans')
    .select('id, state')
    .eq('slug', slug)
    .eq('state', 'published')
    .maybeSingle();
  if (!artisan) {
    return {
      ok: false,
      error: { code: 'artisan_not_found', message_key: 'errors.rating.artisan_not_found' },
    };
  }

  const scores = {
    score_depannage: form.score_depannage ?? null,
    score_petits_travaux: form.score_petits_travaux ?? null,
    score_travail_soigne: form.score_travail_soigne ?? null,
    score_urgences: form.score_urgences ?? null,
  };
  const commentText = form.comment && form.comment.length > 0 ? form.comment : null;
  const writable = { ...scores, comment_text: commentText, visibility: form.visibility };

  // Select-then-branch : 1 note/(artisan,user). Re-vote = UPDATE de sa ligne.
  const { data: existing } = await supabase
    .from('ratings')
    .select('id')
    .eq('artisan_id', artisan.id)
    .eq('user_id', userId)
    .maybeSingle();

  const { error: writeErr } = existing
    ? await supabase.from('ratings').update(writable).eq('id', existing.id)
    : await supabase.from('ratings').insert({
        artisan_id: artisan.id,
        user_id: userId,
        residence_id: residenceId,
        ...writable,
      });

  if (writeErr) {
    log({
      level: 'error',
      event: 'rating.submit_failed',
      user_id: userId,
      residence_id: residenceId,
      request_id: null,
      payload: { errorCode: writeErr.code ?? 'unknown', mode: existing ? 'update' : 'insert' },
    });
    return {
      ok: false,
      error: { code: 'submit_failed', message_key: 'errors.rating.submit_failed' },
    };
  }

  // FR16 — mémoriser la visibilité choisie sur le profil (bénin si échec).
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ identity_mode: mapVisibilityToIdentityMode(form.visibility) })
    .eq('user_id', userId);
  if (profileErr) {
    log({
      level: 'warn',
      event: 'rating.profile_update_failed',
      user_id: userId,
      residence_id: residenceId,
      request_id: null,
      payload: { errorCode: profileErr.code ?? 'unknown' },
    });
  }

  // Re-lecture des agrégats + commentaires sur la fiche au retour.
  revalidatePath(`/${locale}/community/artisan/${slug}`);
  return { ok: true };
}

// ── Story 2.7 — retrait de sa note / de son commentaire (RPC SECURITY DEFINER) ──

export type RetractRatingResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | { code: 'unauthenticated'; message_key: 'errors.forbidden' }
        | { code: 'forbidden'; message_key: 'errors.forbidden' }
        | { code: 'submit_failed'; message_key: 'errors.rating.submit_failed' };
    };
export type RetractRatingState = RetractRatingResult | { ok: false; idle: true };
export const RETRACT_RATING_INITIAL: RetractRatingState = { ok: false, idle: true };

async function callRetractRpc(
  rpc: 'retract_own_rating' | 'retract_own_comment',
  event: string,
  formData: FormData,
): Promise<RetractRatingState> {
  const slug = String(formData.get('slug') ?? '').trim();
  const locale = String(formData.get('locale') ?? 'fr').trim();
  const ratingId = String(formData.get('rating_id') ?? '').trim();

  const guard = await requireResident();
  if (!guard.ok) {
    return { ok: false, error: { code: 'unauthenticated', message_key: 'errors.forbidden' } };
  }
  if (!ratingId) {
    return { ok: false, error: { code: 'forbidden', message_key: 'errors.forbidden' } };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, { p_rating_id: ratingId });
  if (error) {
    log({
      level: 'error',
      event,
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown' },
    });
    return {
      ok: false,
      error: { code: 'submit_failed', message_key: 'errors.rating.submit_failed' },
    };
  }
  revalidatePath(`/${locale}/community/artisan/${slug}`);
  return { ok: true };
}

/** AC6 — retire la note (soft-delete via RPC). */
export function retractOwnRating(
  _prev: RetractRatingState,
  formData: FormData,
): Promise<RetractRatingState> {
  return callRetractRpc('retract_own_rating', 'rating.retract_failed', formData);
}

/** AC7 — retire le commentaire seul (la note est conservée). */
export function retractOwnComment(
  _prev: RetractRatingState,
  formData: FormData,
): Promise<RetractRatingState> {
  return callRetractRpc('retract_own_comment', 'rating.retract_comment_failed', formData);
}
