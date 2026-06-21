'use server';

// Story 6.4 (FR43b) — bascule la réaction 👍 de l'utilisateur sur une cible
// (toggle : ajoute si absente, retire si présente). Renvoie l'état + le compte
// frais (réconciliation de l'optimistic UI). user_id/residence_id sont posés par
// défaut (auth.uid()/auth_residence_id()) — jamais par le client.

import { createClient } from '@/lib/supabase/server';
import { requireResident } from '@/lib/auth/require-resident';
import { isReactionTarget } from '@/lib/reactions/config';
import { log } from '@/lib/logger';

export type ToggleReactionResult = { ok: true; reacted: boolean; count: number } | { ok: false };

export async function toggleReaction(
  targetType: string,
  targetId: string,
): Promise<ToggleReactionResult> {
  const guard = await requireResident();
  if (!guard.ok || !isReactionTarget(targetType)) return { ok: false };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('reactions')
    .select('id')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('user_id', guard.user.id)
    .maybeSingle();

  let reacted: boolean;
  if (existing) {
    const { error } = await supabase.from('reactions').delete().eq('id', existing.id);
    if (error) return fail(guard.user.id, targetType, error.code);
    reacted = false;
  } else {
    const { error } = await supabase
      .from('reactions')
      .insert({ target_type: targetType, target_id: targetId });
    // 23505 = course (double-tap) : la réaction existe déjà → on considère réagi.
    if (error && error.code !== '23505') return fail(guard.user.id, targetType, error.code);
    reacted = true;
  }

  const { data: c } = await supabase
    .from('reaction_counts')
    .select('count')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle();

  return { ok: true, reacted, count: c?.count ?? 0 };
}

function fail(userId: string, targetType: string, code: string | undefined): { ok: false } {
  log({
    level: 'error',
    event: 'reaction.toggle_failed',
    user_id: userId,
    residence_id: null,
    request_id: null,
    payload: { targetType, errorCode: code ?? 'unknown' },
  });
  return { ok: false };
}
