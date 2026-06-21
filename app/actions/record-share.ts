'use server';

// Story 6.2 (FR37) — incrémente le compteur de partages d'une entité (best-effort,
// fire-and-forget côté UI). Compteur SEUL : aucune PII, aucun tracking (NFR16/52).
// L'écriture passe par la RPC `increment_share_count` (SECURITY DEFINER) — le
// résident n'a aucun grant direct sur `share_count`.

import { createClient } from '@/lib/supabase/server';
import { requireResident } from '@/lib/auth/require-resident';
import { isShareKind } from '@/lib/share/entities';
import { log } from '@/lib/logger';

export async function recordShare(kind: string, id: string): Promise<{ ok: boolean }> {
  const guard = await requireResident();
  if (!guard.ok || !isShareKind(kind)) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc('increment_share_count', { p_kind: kind, p_id: id });
  if (error) {
    log({
      level: 'error',
      event: 'share.increment_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { kind, errorCode: error.code ?? 'unknown' },
    });
    return { ok: false };
  }
  return { ok: true };
}
