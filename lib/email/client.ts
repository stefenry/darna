import { env } from '@/lib/env';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 5000;

export type BrevoSendInput = {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
};

export type BrevoSendResult =
  | { ok: true; messageId: string }
  | { ok: false; errorCode: string; error: string };

export async function brevoSendEmail(input: BrevoSendInput): Promise<BrevoSendResult> {
  if (env.server.RESEND_API_KEY) return resendSend(input, env.server.RESEND_API_KEY);
  return brevoSend(input);
}

async function brevoSend(input: BrevoSendInput): Promise<BrevoSendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': env.server.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: env.server.BREVO_SENDER_NAME,
          email: env.server.BREVO_SENDER_EMAIL,
        },
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.htmlContent,
        textContent: input.textContent,
      }),
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

    const body = await safeJson(response);
    if (typeof body.messageId !== 'string') {
      return {
        ok: false,
        errorCode: 'no_message_id',
        error: 'Brevo response missing messageId',
      };
    }
    return { ok: true, messageId: body.messageId };
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      return { ok: false, errorCode: 'timeout', error: 'Brevo request timed out' };
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

async function resendSend(input: BrevoSendInput, apiKey: string): Promise<BrevoSendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${env.server.BREVO_SENDER_NAME} <${env.server.BREVO_SENDER_EMAIL}>`,
        to: [input.to],
        subject: input.subject,
        html: input.htmlContent,
        text: input.textContent,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await safeJson(response);
      return {
        ok: false,
        errorCode: typeof body.name === 'string' ? body.name : String(response.status),
        error: typeof body.message === 'string' ? body.message : response.statusText,
      };
    }

    const body = await safeJson(response);
    if (typeof body.id !== 'string') {
      return { ok: false, errorCode: 'no_message_id', error: 'Resend response missing id' };
    }
    return { ok: true, messageId: body.id };
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') {
      return { ok: false, errorCode: 'timeout', error: 'Resend request timed out' };
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
