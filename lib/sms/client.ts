// Story 2.4 — adapters SMS bas-niveau. Le boundary `send.ts` choisit l'adapter
// selon `SMS_PROVIDER`. Décision MVP : `log` par défaut (aucun compte requis).

import { env } from '@/lib/env';

const BREVO_SMS_ENDPOINT = 'https://api.brevo.com/v3/transactionalSMS/sms';
const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01/Accounts';
const REQUEST_TIMEOUT_MS = 5000;

export type SmsSendResult =
  | { ok: true; messageId: string }
  | { ok: false; errorCode: string; error: string };

/**
 * Adapter DEV/MVP : loggue le SMS (lien inclus) en console pour tester le flux
 * de consentement sans provider. **Jamais en prod** (le lien contient le raw
 * token) — gardé par `SMS_PROVIDER='log'` (défaut), bascule provider réel en prod.
 */
export function sendSmsViaLog(to: string, body: string, nowMs: number): SmsSendResult {
  // eslint-disable-next-line no-console
  console.info(`[sms:log] to=${to}\n${body}`);
  return { ok: true, messageId: `log-${nowMs}` };
}

// Plomberie HTTP commune aux adapters providers : timeout 5s (AbortController),
// mapping uniforme des erreurs API ({code, message} → errorCode/error) et des
// échecs timeout/réseau. Jamais de throw vers l'appelant (contrat AR38 : les
// actions absorbent/logguent, l'UI reste générique).
async function postSmsRequest(args: {
  url: string;
  headers: Record<string, string>;
  body: string;
  provider: string;
  /** Champ du JSON de succès portant l'identifiant du message envoyé. */
  messageIdField: string;
}): Promise<SmsSendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(args.url, {
      method: 'POST',
      headers: { ...args.headers, Accept: 'application/json' },
      body: args.body,
      signal: controller.signal,
    });
    const json = await safeJson(response);
    if (!response.ok) {
      return {
        ok: false,
        errorCode: json.code != null ? String(json.code) : String(response.status),
        error: typeof json.message === 'string' ? json.message : response.statusText,
      };
    }
    const messageId = json[args.messageIdField];
    return { ok: true, messageId: typeof messageId === 'string' ? messageId : 'unknown' };
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      return { ok: false, errorCode: 'timeout', error: `${args.provider} SMS request timed out` };
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

export async function sendSmsViaBrevo(to: string, body: string): Promise<SmsSendResult> {
  const sender = env.server.BREVO_SMS_SENDER;
  if (!sender) {
    return { ok: false, errorCode: 'no_sender', error: 'BREVO_SMS_SENDER not configured' };
  }
  return postSmsRequest({
    url: BREVO_SMS_ENDPOINT,
    headers: { 'api-key': env.server.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender, recipient: to, content: body, type: 'transactional' }),
    provider: 'Brevo',
    messageIdField: 'messageId',
  });
}

/**
 * Adapter Twilio (pivot 2026-07-22 — WhatsApp Cloud API bloqué par la
 * restriction Meta du compte). Envoi via Messaging Service (recommandé : porte
 * le sender ID alphanumérique Maroc pré-enregistré) ou `From` direct.
 */
export async function sendSmsViaTwilio(to: string, body: string): Promise<SmsSendResult> {
  const sid = env.server.TWILIO_ACCOUNT_SID;
  const token = env.server.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return { ok: false, errorCode: 'not_configured', error: 'Twilio credentials not configured' };
  }
  const params = new URLSearchParams({ To: to, Body: body });
  if (env.server.TWILIO_MESSAGING_SERVICE_SID) {
    params.set('MessagingServiceSid', env.server.TWILIO_MESSAGING_SERVICE_SID);
  } else if (env.server.TWILIO_FROM) {
    params.set('From', env.server.TWILIO_FROM);
  } else {
    return { ok: false, errorCode: 'no_sender', error: 'Twilio sender not configured' };
  }
  return postSmsRequest({
    url: `${TWILIO_API_BASE}/${sid}/Messages.json`,
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    provider: 'Twilio',
    messageIdField: 'sid',
  });
}

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed = await response.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
