// Story 2.2 (AC1/AC2/AC3) — couche de données de l'annuaire (server-only).
// La RLS (`artisans_resident_select_published`, `ratings_resident_select_residence`,
// vue `artisan_rating_aggregates` SECURITY INVOKER) scope déjà résidence +
// published + soft-delete : aucune fuite cross-tenant ici. On filtre `published`
// / `deleted_at is null` explicitement par défense en profondeur.
//
// Review 2026-06-17 :
//   - Filtre `min_rating` désormais DB-side (OR sur la vue agrégat) → plus de
//     sous-comptage silencieux du post-filtre JS sur CANDIDATE_LIMIT.
//   - Branche FTS commentaires : erreurs propagées (loggable côté page).
//   - `fetchTags` order locale-aware + erreurs propagées.
//   - `primaryTagLabel` déterministe (`tags.key` croissant) sur le select imbriqué.

import { createClient } from '@/lib/supabase/server';
import { nameFtsTarget, COMMENT_FTS, hasQuery, sanitizeQuery } from '@/lib/search/fts';
import { toAxisScores, type AxisScore } from '@/lib/artisans/rating';
import type { Locale } from '@/lib/i18n/config';
import type { Database } from '@/lib/supabase/types.generated';
import type { ArtisanCardData } from './_components/artisan-card';
import type { AnnuaireSearchParams } from './schema';

export const PAGE_SIZE = 20;
// Pool de candidats récupéré (PAGE_SIZE+1 pour détecter le `hasMore` sans count).
// La carte de 150 villas, 8 compétences → ordre de grandeur ≤ 50 artisans
// `published` total. Un cap supérieur sert juste à arbitrer le tri en FTS.
const CANDIDATE_LIMIT = 60;

type PriceRelative = Database['public']['Enums']['artisan_price_relative'];
type HasInvoice = Database['public']['Enums']['artisan_has_invoice'];

type EmbeddedTag = { key: string; label_fr: string; label_ar: string | null };
type ArtisanRow = {
  id: string;
  slug: string;
  display_name_fr: string;
  display_name_ar: string | null;
  price_relative: PriceRelative | null;
  has_invoice: HasInvoice | null;
  phone_e164: string;
  created_at: string;
  artisan_tags: { tags: EmbeddedTag | null }[] | null;
};

const ARTISAN_SELECT =
  'id, slug, display_name_fr, display_name_ar, price_relative, has_invoice, phone_e164, created_at, artisan_tags ( tags ( key, label_fr, label_ar ) )';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AnnuaireResult = {
  artisans: ArtisanCardData[];
  /** Plus de résultats que `PAGE_SIZE` côté résidence (affichage tronqué — compteur honnête). */
  hasMore: boolean;
};

function pickLocale(locale: Locale, fr: string, ar: string | null): string {
  return locale === 'ar' && ar?.trim() ? ar : fr;
}

function toCardData(locale: Locale, row: ArtisanRow, axes: AxisScore[]): ArtisanCardData {
  const tags = (row.artisan_tags ?? [])
    .map((at) => at.tags)
    .filter((tag): tag is EmbeddedTag => !!tag)
    // Déterministe : sans `order` sur l'embed PostgREST, l'ordre des tags peut
    // varier d'un fetch à l'autre. Trier par `key` garantit que `primaryTag`
    // est stable et reproductible.
    .sort((a, b) => a.key.localeCompare(b.key));
  const primary = tags[0] ?? null;
  return {
    slug: row.slug,
    displayName: pickLocale(locale, row.display_name_fr, row.display_name_ar),
    priceRelative: row.price_relative,
    hasInvoice: row.has_invoice,
    phoneE164: row.phone_e164,
    primaryTagKey: primary?.key ?? null,
    primaryTagLabel: primary ? pickLocale(locale, primary.label_fr, primary.label_ar) : null,
    axes,
  };
}

/**
 * Charge la liste annuaire filtrée et triée. Lève en cas d'erreur Supabase
 * (la page log + retombe sur l'empty/error state).
 */
export async function fetchAnnuaire(
  locale: Locale,
  params: AnnuaireSearchParams,
): Promise<AnnuaireResult> {
  const supabase = await createClient();

  // Restriction par tag (compétence) → set d'artisan_ids (RLS scopée).
  let tagArtisanIds: string[] | null = null;
  if (params.tag) {
    const { data: tagRows, error: tagErr } = await supabase
      .from('artisan_tags')
      .select('artisan_id, tags!inner(key)')
      .eq('tags.key', params.tag);
    if (tagErr) throw tagErr;
    tagArtisanIds = (tagRows ?? []).map((r) => r.artisan_id);
    if (tagArtisanIds.length === 0) return { artisans: [], hasMore: false };
  }

  // Filtre note min DB-side (review D2) : sur la vue agrégat RLS-scopée, OR sur
  // les 4 colonnes `avg_*`. Évite le sous-comptage JS post-fetch et garde le
  // compteur honnête.
  let ratingArtisanIds: string[] | null = null;
  if (params.min_rating != null) {
    const min = params.min_rating;
    const { data: rated, error: ratedErr } = await supabase
      .from('artisan_rating_aggregates')
      .select('artisan_id')
      .or(
        [
          `avg_depannage.gte.${min}`,
          `avg_petits_travaux.gte.${min}`,
          `avg_travail_soigne.gte.${min}`,
          `avg_urgences.gte.${min}`,
        ].join(','),
      );
    if (ratedErr) throw ratedErr;
    ratingArtisanIds = [
      ...new Set(
        (rated ?? []).map((r) => r.artisan_id).filter((id): id is string => typeof id === 'string'),
      ),
    ];
    if (ratingArtisanIds.length === 0) return { artisans: [], hasMore: false };
  }

  const baseFiltered = () => {
    let q = supabase
      .from('artisans')
      .select(ARTISAN_SELECT)
      .eq('state', 'published')
      .is('deleted_at', null);
    if (params.price) q = q.eq('price_relative', params.price);
    if (params.facture) q = q.eq('has_invoice', params.facture);
    if (tagArtisanIds) q = q.in('id', tagArtisanIds);
    if (ratingArtisanIds) q = q.in('id', ratingArtisanIds);
    return q;
  };

  let rows: ArtisanRow[];

  if (hasQuery(params.q)) {
    const q = sanitizeQuery(params.q);
    const target = nameFtsTarget(locale);

    // Match sur le nom (résultats complets, triés récence).
    const { data: nameRows, error: nameErr } = await baseFiltered()
      .textSearch(target.column, q, { type: 'websearch', config: target.config })
      .order('created_at', { ascending: false })
      .limit(CANDIDATE_LIMIT);
    if (nameErr) throw nameErr;
    const nameList = (nameRows ?? []) as unknown as ArtisanRow[];

    // Match sur les commentaires → artisan_ids (le tsvector vit sur ratings).
    // Review F12 : erreurs propagées (avant : swallow silencieux → perte de
    // résultats invisible côté ops).
    const { data: commentRows, error: commentErr } = await supabase
      .from('ratings')
      .select('artisan_id')
      .is('deleted_at', null)
      .textSearch(COMMENT_FTS.column, q, { type: 'websearch', config: COMMENT_FTS.config })
      .limit(CANDIDATE_LIMIT);
    if (commentErr) throw commentErr;
    const have = new Set(nameList.map((r) => r.id));
    const extraIds = [...new Set((commentRows ?? []).map((r) => r.artisan_id))].filter(
      (id) => !have.has(id),
    );

    let commentArtisans: ArtisanRow[] = [];
    if (extraIds.length > 0) {
      const { data: extra, error: extraErr } = await baseFiltered()
        .in('id', extraIds)
        .order('created_at', { ascending: false })
        .limit(CANDIDATE_LIMIT);
      if (extraErr) throw extraErr;
      commentArtisans = (extra ?? []) as unknown as ArtisanRow[];
    }
    rows = [...nameList, ...commentArtisans]; // noms d'abord (recombinaison 2.1 §FTS)
  } else {
    const { data, error } = await baseFiltered()
      .order('created_at', { ascending: false })
      .limit(CANDIDATE_LIMIT);
    if (error) throw error;
    rows = (data ?? []) as unknown as ArtisanRow[];
  }

  if (rows.length === 0) return { artisans: [], hasMore: false };

  // Agrégats de notation des candidats (vue RLS-scopée).
  const ids = rows.map((r) => r.id);
  const { data: aggRows, error: aggErr } = await supabase
    .from('artisan_rating_aggregates')
    .select('*')
    .in('artisan_id', ids);
  if (aggErr) throw aggErr;
  const aggById = new Map((aggRows ?? []).map((a) => [a.artisan_id, a]));

  const cards = rows.map((row) =>
    toCardData(locale, row, toAxisScores(aggById.get(row.id) ?? null)),
  );
  const hasMore = cards.length > PAGE_SIZE;
  return { artisans: cards.slice(0, PAGE_SIZE), hasMore };
}

/** Liste des compétences (tags) pour les chips de filtre, labels par locale. */
export async function fetchTags(locale: Locale): Promise<{ key: string; label: string }[]> {
  const supabase = await createClient();
  // Review F18 : tri locale-aware (la base FTS = `simple` côté AR). Erreurs
  // propagées (avant : swallow → infra invisible).
  const orderCol = locale === 'ar' ? 'label_ar' : 'label_fr';
  const { data, error } = await supabase
    .from('tags')
    .select('key, label_fr, label_ar')
    .order(orderCol, { nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((tag) => ({
    key: tag.key,
    label: pickLocale(locale, tag.label_fr, tag.label_ar),
  }));
}

export type { SupabaseClient };
