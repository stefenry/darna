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
  /** Nom du contributeur si `visibility='named'` ; sinon null (→ libellé générique). */
  authorName: string | null;
  scores: { axis: RatingAxis; value: number }[];
  commentText: string;
  createdAt: string;
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
      'id, comment_text, visibility, created_at, author_display_name, score_depannage, score_petits_travaux, score_travail_soigne, score_urgences',
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
    return {
      id: r.id,
      authorName,
      scores,
      commentText: r.comment_text ?? '',
      createdAt: r.created_at,
    };
  });
}
