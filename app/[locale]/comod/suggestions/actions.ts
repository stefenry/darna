'use server';

// Story 6.5 — markSuggestionReviewed : un co_mod marque une suggestion « lue »
// (state → reviewed). UPDATE via session (RLS suggestions_co_mod_update_state +
// grant `state` seul borne au co_mod de la résidence).

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireComod } from '@/lib/auth/require-comod';
import { log } from '@/lib/logger';

export type MarkReviewedState = { ok: true } | { ok: false };

export async function markSuggestionReviewed(id: string): Promise<MarkReviewedState> {
  const guard = await requireComod();
  if (!guard.ok) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase.from('suggestions').update({ state: 'reviewed' }).eq('id', id);
  if (error) {
    log({
      level: 'error',
      event: 'suggestion.mark_reviewed_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown' },
    });
    return { ok: false };
  }

  revalidatePath(`/[locale]/comod/suggestions`, 'page');
  return { ok: true };
}
