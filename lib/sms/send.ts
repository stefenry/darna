// Story 2.4 — boundary unique pour tout envoi SMS transactionnel (miroir de
// `lib/email/send.ts`). Choisit l'adapter selon `SMS_PROVIDER` (`log` MVP par
// défaut / `brevo` en prod).

import { env } from '@/lib/env';
import { sendSmsViaLog, sendSmsViaBrevo, type SmsSendResult } from './client';
import { consentSmsTemplate, type ConsentSmsVars } from './templates/consent.fr';

export type SmsArgs = {
  template: 'artisan-consent';
  to: string;
  vars: ConsentSmsVars;
};

export async function sendTransactionalSms(args: SmsArgs): Promise<SmsSendResult> {
  const body = consentSmsTemplate(args.vars); // FR-only au MVP (locale artisan inconnue)
  if (env.server.SMS_PROVIDER === 'brevo') {
    return sendSmsViaBrevo(args.to, body);
  }
  return sendSmsViaLog(args.to, body, Date.now());
}
