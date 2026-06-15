import { log } from '@/lib/logger';
import { brevoSendEmail, type BrevoSendResult } from './client';
import { magicLinkTemplate as magicLinkFr } from './templates/magic-link.fr';
import { magicLinkTemplate as magicLinkAr } from './templates/magic-link.ar';
import type { MagicLinkVars } from './templates/magic-link.fr';

// AR16 — Boundary unique pour tout envoi e-mail transactionnel applicatif.
// Note : `scripts/budget-alert.ts` est un script CLI ops (pas runtime app)
// et conserve son propre fetch direct, hors de cette boundary.

export type SendArgs = {
  template: 'magic-link';
  to: string;
  locale: 'fr' | 'ar';
  vars: MagicLinkVars;
};

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; errorCode: string };

export async function sendTransactionalEmail(args: SendArgs): Promise<SendResult> {
  const rendered = renderTemplate(args);

  const result: BrevoSendResult = await brevoSendEmail({
    to: args.to,
    subject: rendered.subject,
    htmlContent: rendered.htmlContent,
    textContent: rendered.textContent,
  });

  if (result.ok) {
    log({
      level: 'info',
      event: 'email.sent',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: {
        template: args.template,
        locale: args.locale,
        messageId: result.messageId,
      },
    });
    return { ok: true, messageId: result.messageId };
  }

  log({
    level: 'error',
    event: 'email.failed',
    user_id: null,
    residence_id: null,
    request_id: null,
    payload: {
      template: args.template,
      locale: args.locale,
      errorCode: result.errorCode,
    },
  });
  return { ok: false, error: result.error, errorCode: result.errorCode };
}

function renderTemplate(args: SendArgs) {
  switch (args.template) {
    case 'magic-link':
      return args.locale === 'ar' ? magicLinkAr(args.vars) : magicLinkFr(args.vars);
  }
}
