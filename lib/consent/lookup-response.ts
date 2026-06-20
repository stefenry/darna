// Story 2.8 — lecture/validation d'un token `purpose='respond'` (page GET
// /respond/[token]). Fork de lib/consent/lookup.ts (2.5) : filtre purpose +
// masquage phone + ratings récents (sélecteur de cible). Lecture via client ADMIN
// (artisan_consent_tokens deny-all client).
//
// Sécurité (AR38) : token introuvable, cross-purpose ('consent'), artisan retiré,
// hash incohérent → MÊME statut `invalid` (ne révèle pas l'existence).

import { createAdminClient } from '@/lib/supabase/admin';
import { hashConsentToken } from './token';
import { env } from '@/lib/env';
import { RATING_AXES, type RatingAxis } from '@/lib/artisans/rating';
import type { Locale } from '@/lib/i18n/config';
import type { Database } from '@/lib/supabase/types.generated';

type EmbeddedTag = { key: string; label_fr: string; label_ar: string | null };

export type RecentRating = { id: string; createdAt: string; summary: string };

export type ResponseLookup =
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'used' }
  | {
      status: 'valid';
      artisanId: string;
      slug: string;
      displayName: string;
      phoneMasked: string;
      tags: string[];
      recentRatings: RecentRating[];
    };

const RAW_MIN = 16;
const RAW_MAX = 200;
const SCORE_COLUMN: Record<RatingAxis, string> = {
  depannage: 'score_depannage',
  'petits-travaux': 'score_petits_travaux',
  'travail-soigne': 'score_travail_soigne',
  urgences: 'score_urgences',
};

function pickLocale(locale: Locale, fr: string, ar: string | null): string {
  return locale === 'ar' && ar?.trim() ? ar : fr;
}

/** `+212600000001` → `+212 •• •• •• 01` (2 derniers chiffres visibles). */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const last2 = digits.slice(-2) || '••';
  return `+212 •• •• •• ${last2}`;
}

export async function resolveResponseToken(raw: string, locale: Locale): Promise<ResponseLookup> {
  if (!raw || raw.length < RAW_MIN || raw.length > RAW_MAX) return { status: 'invalid' };

  const tokenHash = hashConsentToken(raw, env.server.CONSENT_TOKEN_SECRET);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('artisan_consent_tokens')
    .select(
      'expires_at, used_at, purpose, artisans ( id, slug, display_name_fr, display_name_ar, phone_e164, state, deleted_at, artisan_tags ( tags ( key, label_fr, label_ar ) ) )',
    )
    .eq('token_hash', tokenHash)
    .eq('purpose', 'respond')
    .maybeSingle();

  if (error || !data || !data.artisans) return { status: 'invalid' };

  const artisan = data.artisans as unknown as {
    id: string;
    slug: string;
    display_name_fr: string;
    display_name_ar: string | null;
    phone_e164: string;
    state: Database['public']['Enums']['artisan_state'];
    deleted_at: string | null;
    artisan_tags: { tags: EmbeddedTag | null }[] | null;
  };

  // Artisan retiré (state != published OU soft-deleted) → invalid (AR38).
  if (artisan.state !== 'published' || artisan.deleted_at) return { status: 'invalid' };

  if (data.used_at) return { status: 'used' };
  if (new Date(data.expires_at).getTime() < Date.now()) return { status: 'expired' };

  const tags = (artisan.artisan_tags ?? [])
    .map((at) => at.tags)
    .filter((tag): tag is EmbeddedTag => !!tag)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((tag) => pickLocale(locale, tag.label_fr, tag.label_ar));

  // 5 ratings récents (commentés ou non) — pour le sélecteur de cible « répondre
  // à une note ». Résumé = snippet du commentaire, sinon les axes notés.
  const { data: ratingRows } = await admin
    .from('ratings')
    .select(
      'id, created_at, comment_text, score_depannage, score_petits_travaux, score_travail_soigne, score_urgences',
    )
    .eq('artisan_id', artisan.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  const recentRatings: RecentRating[] = (ratingRows ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const comment = typeof row.comment_text === 'string' ? row.comment_text.trim() : '';
    let summary = comment.slice(0, 40);
    if (!summary) {
      const axes = RATING_AXES.filter((a) => typeof row[SCORE_COLUMN[a]] === 'number');
      summary = axes.length > 0 ? `${axes.length} axe(s) noté(s)` : 'Note';
    }
    return { id: String(row.id), createdAt: String(row.created_at), summary };
  });

  return {
    status: 'valid',
    artisanId: artisan.id,
    slug: artisan.slug,
    displayName: pickLocale(locale, artisan.display_name_fr, artisan.display_name_ar),
    phoneMasked: maskPhone(artisan.phone_e164),
    tags,
    recentRatings,
  };
}
