// Story 2.4 — adapters SMS bas-niveau. Le boundary `send.ts` choisit l'adapter
// selon `SMS_PROVIDER`. Décision MVP : `log` par défaut (aucun compte requis).

import { env } from '@/lib/env';

const BREVO_SMS_ENDPOINT = 'https://api.brevo.com/v3/transactionalSMS/sms';
const REQUEST_TIMEOUT_MS = 5000;

export type SmsSendResult =
  | { ok: true; messageId: string }
  | { ok: false; errorCode: string; error: string };

/**
 * Adapter DEV/MVP : loggue le SMS (lien inclus) en console pour tester le flux
 * de consentement sans provider. **Jamais en prod** (le lien contient le raw
 * token) — gardé par `SMS_PROVIDER='log'` (défaut), bascule `brevo` en prod.
 */
export function sendSmsViaLog(to: string, body: string, nowMs: number): SmsSendResult {
  // eslint-disable-next-line no-console
  console.info(`[sms:log] to=${to}\n${body}`);
  return { ok: true, messageId: `log-${nowMs}` };
}

export async function sendSmsViaBrevo(to: string, body: string): Promise<SmsSendResult> {
  const sender = env.server.BREVO_SMS_SENDER;
  if (!sender) {
    return { ok: false, errorCode: 'no_sender', error: 'BREVO_SMS_SENDER not configured' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(BREVO_SMS_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': env.server.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ sender, recipient: to, content: body, type: 'transactional' }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await safeJson(response);
      return {
        ok: false,
        errorCode: typeof body.code === 'string' ? body.code : String(response.status),
        error: typeof body.message === 'string' ? body.message : response.statusText,
      };
    }
    const json = await safeJson(response);
    return { ok: true, messageId: typeof json.messageId === 'string' ? json.messageId : 'unknown' };
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      return { ok: false, errorCode: 'timeout', error: 'Brevo SMS request timed out' };
    }
    return {
      ok: false,
      errorCode: 'network',
      error: cause instanceof Error ? cause.message : 'unknown network error',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed = await response.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
