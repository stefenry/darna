'use server';

// Story 6.5 (FR43c/FR42) — submitSuggestion : un résident envoie une suggestion
// d'évolution (texte libre ≤1000). INSERT via session (RLS suggestions_resident_
// insert_own + grant `body` seul) ; les co_mods sont notifiés par e-mail (extrait
// seul, pas l'auteur). Jamais public, aucun vote.

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireResident } from '@/lib/auth/require-resident';
import { checkLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { env } from '@/lib/env';
import { sendTransactionalEmail } from '@/lib/email/send';
import { zSuggestion } from '@/lib/validation/suggestion';

const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 3600;

export type SubmitSuggestionState =
  | { ok: true }
  | { ok: false; idle: true }
  | { ok: false; code: 'forbidden' | 'rate_limited' | 'invalid' | 'failed' };

export const SUGGESTION_INITIAL: SubmitSuggestionState = { ok: false, idle: true };

function baseUrl(): string {
  return env.client.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
}

export async function submitSuggestion(
  _prev: SubmitSuggestionState,
  formData: FormData,
): Promise<SubmitSuggestionState> {
  const guard = await requireResident();
  if (!guard.ok) return { ok: false, code: 'forbidden' };
  const userId = guard.user.id;

  const rl = await checkLimit(`suggestion-create:${userId}`, RATE_LIMIT, RATE_WINDOW_SECONDS);
  if (!rl.success) return { ok: false, code: 'rate_limited' };

  const raw = formData.get('body');
  const parsed = zSuggestion.safeParse({ body: typeof raw === 'string' ? raw : '' });
  if (!parsed.success) return { ok: false, code: 'invalid' };

  const supabase = await createClient();
  const { error } = await supabase.from('suggestions').insert({ body: parsed.data.body });
  if (error) {
    log({
      level: 'error',
      event: 'suggestion.insert_failed',
      user_id: userId,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown' },
    });
    return { ok: false, code: 'failed' };
  }

  // Notification co_mods (non bloquante) — extrait seul, pas l'auteur (FR42).
  const excerpt = parsed.data.body.slice(0, 280);
  const queueUrl = `${baseUrl()}/fr/comod/suggestions`;
  for (const comodEmail of env.server.INITIAL_COMOD_EMAILS) {
    try {
      const r = await sendTransactionalEmail({
        template: 'suggestion-notify-comod',
        to: comodEmail,
        locale: 'fr',
        vars: { excerpt, queue_url: queueUrl },
      });
      if (!r.ok) {
        log({
          level: 'error',
          event: 'suggestion.comod_notify_failed',
          user_id: userId,
          residence_id: null,
          request_id: null,
          payload: { errorCode: r.errorCode },
        });
      }
    } catch (cause) {
      log({
        level: 'error',
        event: 'suggestion.comod_notify_threw',
        user_id: userId,
        residence_id: null,
        request_id: null,
        payload: { errorName: cause instanceof Error ? cause.name : 'unknown' },
      });
    }
  }

  revalidatePath(`/[locale]/community/profil/parametres/suggestion`, 'page');
  return { ok: true };
}
