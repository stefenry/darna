'use server';

// Story 4.3 (AC4) — retrait par l'auteur de sa propre alerte / bon plan, via la
// RPC SECURITY DEFINER `retract_own_ephemeral` (garde created_by + audit
// moderation_log self_retracted). Appelée depuis la page détail (4.4).

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireResident } from '@/lib/auth/require-resident';
import { log } from '@/lib/logger';

export type RetractKind = 'alert' | 'tip';

export type RetractResult =
  | { ok: true }
  | { ok: false; code: 'forbidden' | 'not_found' | 'submit_failed' };

export async function retractOwnEphemeral(
  kind: RetractKind,
  id: string,
  reason: string,
): Promise<RetractResult> {
  const guard = await requireResident();
  if (!guard.ok) return { ok: false, code: 'forbidden' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('retract_own_ephemeral', {
    p_kind: kind,
    p_id: id,
    p_reason: reason?.trim() ? reason.trim().slice(0, 500) : '',
  });

  if (error) {
    const msg = error.message ?? '';
    if (/forbidden/.test(msg)) return { ok: false, code: 'forbidden' };
    if (/not_found/.test(msg)) return { ok: false, code: 'not_found' };
    log({
      level: 'error',
      event: 'ephemeral.retract_failed',
      user_id: guard.user.id,
      residence_id: null,
      request_id: null,
      payload: { kind, errorCode: error.code ?? 'unknown' },
    });
    return { ok: false, code: 'submit_failed' };
  }

  revalidatePath(`/[locale]/community/alertes`, 'page');
  return { ok: true };
}
