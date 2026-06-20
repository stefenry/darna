import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/config';
import { pickLocalized, type TipCategoryKey } from '@/lib/content/ephemeral';

// Story 4.4 — détail bon plan (`/bons-plans/[slug]`). Même garde RLS que les
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
};

export type TipDetailResult = { kind: 'found'; entry: TipDetail } | { kind: 'not-found' };

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
    },
  };
}
