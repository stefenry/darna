// Story 2.4 — boundary unique pour tout envoi SMS transactionnel (miroir de
// `lib/email/send.ts`). Choisit l'adapter selon `SMS_PROVIDER` (`log` MVP par
// défaut / `brevo` en prod).

import { env } from '@/lib/env';
import { sendSmsViaLog, sendSmsViaBrevo, sendSmsViaTwilio, type SmsSendResult } from './client';
import { consentSmsTemplate, type ConsentSmsVars } from './templates/consent.fr';
import { respondSmsTemplate, type RespondSmsVars } from './templates/respond.fr';
import { reconsentSmsTemplate, type ReconsentSmsVars } from './templates/reconsent.fr';

export type SmsArgs =
  | { template: 'artisan-consent'; to: string; vars: ConsentSmsVars }
  | { template: 'artisan-reconsent'; to: string; vars: ReconsentSmsVars }
  | { template: 'artisan-respond'; to: string; vars: RespondSmsVars };

function renderSms(args: SmsArgs): string {
  switch (args.template) {
    case 'artisan-consent':
      return consentSmsTemplate(args.vars);
    case 'artisan-reconsent':
      return reconsentSmsTemplate(args.vars);
    case 'artisan-respond':
      return respondSmsTemplate(args.vars);
  }
}

/**
 * Interim 2026-07-23 — envoi SMS coupé (`SMS_PROVIDER=disabled`) en attendant
 * l'activation Twilio. Les pages/actions s'en servent pour adapter la copy
 * (aucune promesse de SMS) et sauter l'envoi.
 */
export function isSmsDisabled(): boolean {
  return env.server.SMS_PROVIDER === 'disabled';
}

export async function sendTransactionalSms(args: SmsArgs): Promise<SmsSendResult> {
  // Défense en profondeur : les appelants sautent déjà l'envoi quand le
  // provider est `disabled` — si l'un l'oublie, on ne tente rien et on ne
  // loggue pas le body (il contient le token magic-link brut).
  if (isSmsDisabled()) {
    return { ok: false, errorCode: 'disabled', error: 'SMS sending disabled (SMS_PROVIDER)' };
  }
  const body = renderSms(args); // FR-only au MVP (locale artisan inconnue)
  if (env.server.SMS_PROVIDER === 'twilio') {
    return sendSmsViaTwilio(args.to, body);
  }
  if (env.server.SMS_PROVIDER === 'brevo') {
    return sendSmsViaBrevo(args.to, body);
  }
  return sendSmsViaLog(args.to, body, Date.now());
}
