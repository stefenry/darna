// Story 5.3 — résolution du contenu cible d'un signalement (polymorphe). Le co_mod
// lit TOUT le contenu de sa résidence, y compris soft-deleté (RLS *_co_mod_select_*
// / *_author_select / resident_select selon table), pour afficher le contexte dans
// la queue (snippet) et la page détail (corps complet). Server-only.

import { createClient } from '@/lib/supabase/server';
import type { ReportTargetType } from '@/lib/validation/report';

type Locale = 'fr' | 'ar';

export type ResolvedTarget = {
  exists: boolean;
  removed: boolean; // deleted_at non null
  title: string;
  body: string | null;
};

const MISSING: ResolvedTarget = { exists: false, removed: false, title: '', body: null };

function pick(
  fr: string | null | undefined,
  ar: string | null | undefined,
  locale: Locale,
): string {
  if (locale === 'ar' && ar && ar.trim()) return ar;
  return (fr ?? '').trim();
}

type Client = Awaited<ReturnType<typeof createClient>>;

export async function resolveTarget(
  locale: Locale,
  targetType: ReportTargetType,
  targetId: string,
): Promise<ResolvedTarget> {
  const supabase: Client = await createClient();

  switch (targetType) {
    case 'artisan': {
      const { data } = await supabase
        .from('artisans')
        .select('display_name_fr, display_name_ar, deleted_at')
        .eq('id', targetId)
        .maybeSingle();
      if (!data) return MISSING;
      return {
        exists: true,
        removed: data.deleted_at !== null,
        title: pick(data.display_name_fr, data.display_name_ar, locale),
        body: null,
      };
    }
    case 'rating': {
      const { data } = await supabase
        .from('ratings')
        .select('comment_text, deleted_at')
        .eq('id', targetId)
        .maybeSingle();
      if (!data) return MISSING;
      return {
        exists: true,
        removed: data.deleted_at !== null,
        title: 'Avis',
        body: data.comment_text,
      };
    }
    case 'alert':
    case 'tip': {
      const table = (targetType === 'alert' ? 'alerts' : 'tips') as 'alerts' | 'tips';
      const { data } = await supabase
        .from(table)
        .select('title_fr, title_ar, body_fr, body_ar, deleted_at')
        .eq('id', targetId)
        .maybeSingle();
      if (!data) return MISSING;
      return {
        exists: true,
        removed: data.deleted_at !== null,
        title: pick(data.title_fr, data.title_ar, locale),
        body: pick(data.body_fr, data.body_ar, locale) || null,
      };
    }
    case 'guide_entry': {
      const { data } = await supabase
        .from('guide_entries')
        .select('title_fr, title_ar, body_fr_markdown, body_ar_markdown, deleted_at')
        .eq('id', targetId)
        .maybeSingle();
      if (!data) return MISSING;
      return {
        exists: true,
        removed: data.deleted_at !== null,
        title: pick(data.title_fr, data.title_ar, locale),
        body: pick(data.body_fr_markdown, data.body_ar_markdown, locale) || null,
      };
    }
    case 'useful_number': {
      const { data } = await supabase
        .from('useful_numbers')
        .select('label_fr, label_ar, phone_e164, deleted_at')
        .eq('id', targetId)
        .maybeSingle();
      if (!data) return MISSING;
      return {
        exists: true,
        removed: data.deleted_at !== null,
        title: pick(data.label_fr, data.label_ar, locale),
        body: data.phone_e164,
      };
    }
    case 'alert_comment':
    default:
      return MISSING;
  }
}

// Snippet court (queue) : titre tronqué + 1re ligne du corps si présent.
export function snippet(t: ResolvedTarget, max = 120): string {
  const base = t.body ? `${t.title} — ${t.body}` : t.title;
  const oneLine = base.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}
