// Story 2.3 (AC1) — couche données fiche artisan (server-only).
//
// Visibilité via RLS `artisans_resident_select_published`/`own_pending` ;
// `state='refused'` et `deleted_at not null` → traités comme « inexistants »
// côté lecture (review 2026-06-17 P3, P21). La distinction 404/410 est
// abandonnée au MVP — l'UI gone strict reviendra avec Story 6.1 (slugs
// canoniques + tombstoning). `author_display_name` lu directement depuis
// `ratings` (matérialisé au write par trigger DB ; review 2026-06-17 P20).

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { toAxisScores, RATING_AXES, type AxisScore, type RatingAxis } from '@/lib/artisans/rating';
import { pseudonymSuffix } from '@/lib/artisans/pseudonym';
import type { Locale } from '@/lib/i18n/config';
import type { Database } from '@/lib/supabase/types.generated';

type PriceRelative = Database['public']['Enums']['artisan_price_relative'];
type HasInvoice = Database['public']['Enums']['artisan_has_invoice'];
type ArtisanState = Database['public']['Enums']['artisan_state'];

export type ArtisanDetail = {
  id: string;
  slug: string;
  displayName: string;
  priceRelative: PriceRelative | null;
  hasInvoice: HasInvoice | null;
  phoneE164: string;
  tags: { key: string; label: string }[];
  axes: AxisScore[];
  isOwner: boolean;
};

export type ArtisanComment = {
  id: string;
  /** Nom du contributeur si `visibility='named'` ; sinon null. */
  authorName: string | null;
  /** Suffixe pseudonyme stable (FR16) si `visibility='pseudonym'` ET contributeur non anonymisé ; sinon null. */
  pseudonymSuffix: string | null;
  scores: { axis: RatingAxis; value: number }[];
  commentText: string;
  createdAt: string;
};

/** Note existante du contributeur courant sur un artisan (pré-remplissage du form 2.6 + retrait 2.7). */
export type MyRating = {
  id: string;
  score_depannage: number | null;
  score_petits_travaux: number | null;
  score_travail_soigne: number | null;
  score_urgences: number | null;
  comment_text: string | null;
  visibility: Database['public']['Enums']['rating_visibility'];
};

export type FetchArtisanResult = { kind: 'found'; artisan: ArtisanDetail } | { kind: 'not-found' };

type EmbeddedTag = { key: string; label_fr: string; label_ar: string | null };
type DetailRow = {
  id: string;
  slug: string;
  display_name_fr: string;
  display_name_ar: string | null;
  price_relative: PriceRelative | null;
  has_invoice: HasInvoice | null;
  phone_e164: string;
  state: ArtisanState;
  created_by: string | null;
  artisan_tags: { tags: EmbeddedTag | null }[] | null;
};

const DETAIL_SELECT =
  'id, slug, display_name_fr, display_name_ar, price_relative, has_invoice, phone_e164, state, created_by, artisan_tags ( tags ( key, label_fr, label_ar ) )';

function pickLocale(locale: Locale, fr: string, ar: string | null): string {
  const arTrimmed = ar?.trim();
  const frTrimmed = fr.trim();
  if (locale === 'ar' && arTrimmed) return arTrimmed;
  return frTrimmed || '—';
}

// `cache()` dédupe l'appel dans une même requête → `generateMetadata` + la page
// ne tournent qu'une fois.
export const fetchArtisanBySlug = cache(_fetchArtisanBySlug);

async function _fetchArtisanBySlug(locale: Locale, slug: string): Promise<FetchArtisanResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;

  const { data, error } = await supabase
    .from('artisans')
    .select(DETAIL_SELECT)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;

  if (!data) return { kind: 'not-found' };

  const row = data as unknown as DetailRow;

  // Filet de sécurité : la policy `own_pending` ne filtre pas par state.
  // Un contributeur d'un artisan `refused` serait sinon traité comme valide.
  if (row.state === 'refused') return { kind: 'not-found' };

  const { data: agg, error: aggErr } = await supabase
    .from('artisan_rating_aggregates')
    .select('*')
    .eq('artisan_id', row.id)
    .maybeSingle();
  if (aggErr) throw aggErr;

  const tags = (row.artisan_tags ?? [])
    .map((at) => at.tags)
    .filter((tag): tag is EmbeddedTag => !!tag)
    .map((tag) => ({ key: tag.key, label: pickLocale(locale, tag.label_fr, tag.label_ar) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));

  return {
    kind: 'found',
    artisan: {
      id: row.id,
      slug: row.slug,
      displayName: pickLocale(locale, row.display_name_fr, row.display_name_ar),
      priceRelative: row.price_relative,
      hasInvoice: row.has_invoice,
      phoneE164: row.phone_e164,
      tags,
      axes: toAxisScores(agg ?? null),
      isOwner: uid != null && row.created_by === uid,
    },
  };
}

type CommentRow = {
  id: string;
  user_id: string | null;
  comment_text: string | null;
  visibility: Database['public']['Enums']['rating_visibility'];
  created_at: string;
  author_display_name: string | null;
  score_depannage: number | null;
  score_petits_travaux: number | null;
  score_travail_soigne: number | null;
  score_urgences: number | null;
};

const SCORE_COLUMN: Record<RatingAxis, keyof CommentRow> = {
  depannage: 'score_depannage',
  'petits-travaux': 'score_petits_travaux',
  'travail-soigne': 'score_travail_soigne',
  urgences: 'score_urgences',
};

/** 10 avis les plus récents (commentés non-vides, non supprimés). RLS-scopée résidence. */
export async function fetchArtisanComments(artisanId: string): Promise<ArtisanComment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ratings')
    .select(
      'id, user_id, comment_text, visibility, created_at, author_display_name, score_depannage, score_petits_travaux, score_travail_soigne, score_urgences',
    )
    .eq('artisan_id', artisanId)
    .not('comment_text', 'is', null)
    .neq('comment_text', '')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;

  return ((data ?? []) as unknown as CommentRow[]).map((r) => {
    const scores = RATING_AXES.map((axis) => ({
      axis,
      value: r[SCORE_COLUMN[axis]] as number | null,
    })).filter((s): s is { axis: RatingAxis; value: number } => typeof s.value === 'number');
    const authorName = r.visibility === 'named' ? (r.author_display_name ?? null) : null;
    // FR16 — pseudonyme stable côté serveur (user_id jamais sérialisé). Null si
    // contributeur anonymisé (purge RGPD) → l'UI affiche « Voisin supprimé ».
    const suffix = r.visibility === 'pseudonym' ? pseudonymSuffix(r.user_id, artisanId) : null;
    return {
      id: r.id,
      authorName,
      pseudonymSuffix: suffix,
      scores,
      commentText: r.comment_text ?? '',
      createdAt: r.created_at,
    };
  });
}

/**
 * Note du contributeur courant sur cet artisan (pré-remplissage du form 2.6), ou
 * null s'il n'a pas encore noté / pas de session. RLS `ratings_resident_*` scope
 * la lecture ; `user_id = auth.uid()` garantit qu'on ne lit que sa propre note.
 */
export const fetchMyRating = cache(_fetchMyRating);

async function _fetchMyRating(artisanId: string): Promise<MyRating | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;
  if (!uid) return null;

  const { data, error } = await supabase
    .from('ratings')
    .select(
      'id, score_depannage, score_petits_travaux, score_travail_soigne, score_urgences, comment_text, visibility',
    )
    .eq('artisan_id', artisanId)
    .eq('user_id', uid)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return (data as MyRating | null) ?? null;
}

/** Story 2.8 — réponse publique de l'artisan (droit de réponse FR22). */
export type ArtisanResponseItem = {
  id: string;
  targetKind: 'listing' | 'rating';
  targetId: string | null;
  responseText: string;
  createdAt: string;
};

/** 10 réponses les plus récentes (non supprimées). RLS-scopée fiche published + résidence. */
export async function fetchArtisanResponses(artisanId: string): Promise<ArtisanResponseItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('artisan_responses')
    .select('id, target_kind, target_id, response_text, created_at')
    .eq('artisan_id', artisanId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (
    (data ?? []) as unknown as {
      id: string;
      target_kind: 'listing' | 'rating';
      target_id: string | null;
      response_text: string;
      created_at: string;
    }[]
  ).map((r) => ({
    id: r.id,
    targetKind: r.target_kind,
    targetId: r.target_id,
    responseText: r.response_text,
    createdAt: r.created_at,
  }));
}

export type ArtisanEditData = {
  slug: string;
  state: ArtisanState;
  displayNameFr: string;
  displayNameAr: string | null;
  phoneE164: string;
  priceRelative: PriceRelative | null;
  hasInvoice: HasInvoice | null;
  tagKeys: string[];
  reconsentPending: boolean;
};

/**
 * Story 2.7 — valeurs brutes éditables d'une fiche, pour la page `…/modifier`.
 * Renvoie `null` si pas de session, fiche absente, ou **pas le contributeur**
 * (ownership = défense en profondeur côté lecture ; la RLS `own_pending`/
 * `published` borne déjà la visibilité, on re-checke `created_by`).
 */
export async function fetchArtisanForEdit(slug: string): Promise<ArtisanEditData | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;
  if (!uid) return null;

  const { data } = await supabase
    .from('artisans')
    .select(
      'slug, state, display_name_fr, display_name_ar, phone_e164, price_relative, has_invoice, created_by, pending_display_name_fr, pending_phone_e164, artisan_tags ( tags ( key ) )',
    )
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;

  const row = data as unknown as {
    slug: string;
    state: ArtisanState;
    display_name_fr: string;
    display_name_ar: string | null;
    phone_e164: string;
    price_relative: PriceRelative | null;
    has_invoice: HasInvoice | null;
    created_by: string | null;
    pending_display_name_fr: string | null;
    pending_phone_e164: string | null;
    artisan_tags: { tags: { key: string } | null }[] | null;
  };
  if (row.created_by !== uid) return null;

  const tagKeys = (row.artisan_tags ?? [])
    .map((at) => at.tags?.key)
    .filter((k): k is string => !!k);

  return {
    slug: row.slug,
    state: row.state,
    displayNameFr: row.display_name_fr,
    displayNameAr: row.display_name_ar,
    phoneE164: row.phone_e164,
    priceRelative: row.price_relative,
    hasInvoice: row.has_invoice,
    tagKeys,
    reconsentPending: row.pending_display_name_fr != null || row.pending_phone_e164 != null,
  };
}

/**
 * Visibilité par défaut du form de notation = réglage profil du contributeur
 * (`profiles.identity_mode` mappé), `pseudonym` par défaut (FR16). Bénin : toute
 * absence/erreur retombe sur `pseudonym`.
 */
export async function fetchMyDefaultVisibility(): Promise<'pseudonym' | 'named'> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;
  if (!uid) return 'pseudonym';
  const { data } = await supabase
    .from('profiles')
    .select('identity_mode')
    .eq('user_id', uid)
    .maybeSingle();
  return data?.identity_mode === 'identified' ? 'named' : 'pseudonym';
}
