import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/config';
import { pickLocalized, type TipCategoryKey } from '@/lib/content/ephemeral';
import { resolveTipAuthorLabel, resolveTipAuthorLabels } from '@/lib/content/author-label';
import type { FeedItem } from '@/app/[locale]/community/_components/feed-card';

// Story 4.4 — liste et détail des bons plans. La liste (`fetchTips`) vient de
// l'ancien flux unifié de `alertes/data.ts`, séparé le 2026-07-26.
//
// Détail bon plan (`/bons-plans/[slug]`) : Même garde RLS que les
// alertes : non supprimé, scopé résidence, expiré masqué sauf auteur/co_mod.

export type TipDetail = {
  id: string;
  slug: string;
  title: string;
  body: string;
  untranslated: boolean;
  category: TipCategoryKey;
  createdAt: string;
  expiresAt: string;
  isOwn: boolean;
  authorName: string | null;
  authorPseudonymSuffix: string | null;
};

export type TipDetailResult = { kind: 'found'; entry: TipDetail } | { kind: 'not-found' };

export const fetchTips = cache(_fetchTips);

async function _fetchTips(locale: Locale): Promise<FeedItem[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('tips')
    .select('id, slug, title_fr, title_ar, created_at, expires_at, category_key, created_by')
    .is('deleted_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false });
  if (error) throw error;

  // Libellés auteur en 1 requête admin batch ; `created_by` ne quitte pas le serveur.
  const authorLabels = await resolveTipAuthorLabels((data ?? []).map((t) => t.created_by));

  return (data ?? []).map((t) => {
    const loc = pickLocalized(locale, t.title_fr, t.title_ar);
    const author = (t.created_by && authorLabels.get(t.created_by)) || null;
    return {
      kind: 'tip' as const,
      id: t.id,
      slug: t.slug,
      title: loc.value,
      untranslated: loc.untranslated,
      createdAt: t.created_at,
      expiresAt: t.expires_at,
      category: t.category_key as TipCategoryKey,
      authorName: author?.authorName ?? null,
      authorPseudonymSuffix: author?.pseudonymSuffix ?? null,
    };
  });
}

export const fetchTipBySlug = cache(_fetchTipBySlug);

async function _fetchTipBySlug(locale: Locale, slug: string): Promise<TipDetailResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('tips')
    .select(
      'id, slug, title_fr, title_ar, body_fr, body_ar, category_key, created_at, expires_at, created_by, deleted_at',
    )
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { kind: 'not-found' };

  const title = pickLocalized(locale, data.title_fr, data.title_ar);
  const body = pickLocalized(locale, data.body_fr, data.body_ar);
  const author = await resolveTipAuthorLabel(data.created_by);
  return {
    kind: 'found',
    entry: {
      id: data.id,
      slug: data.slug,
      title: title.value,
      body: body.value,
      untranslated: title.untranslated || body.untranslated,
      category: data.category_key as TipCategoryKey,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      isOwn: !!user && data.created_by === user.id,
      authorName: author.authorName,
      authorPseudonymSuffix: author.pseudonymSuffix,
    },
  };
}
