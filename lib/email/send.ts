import { log } from '@/lib/logger';
import { brevoSendEmail, type BrevoSendResult } from './client';
import { magicLinkTemplate as magicLinkFr } from './templates/magic-link.fr';
import { magicLinkTemplate as magicLinkAr } from './templates/magic-link.ar';
import type { MagicLinkVars } from './templates/magic-link.fr';
import { admissionNotifyComodTemplate as notifyComodFr } from './templates/admission-notify-comod.fr';
import { admissionNotifyComodTemplate as notifyComodAr } from './templates/admission-notify-comod.ar';
import type { AdmissionNotifyComodVars } from './templates/admission-notify-comod.fr';
import { admissionValidatedTemplate as admissionValidatedFr } from './templates/admission-validated.fr';
import { admissionValidatedTemplate as admissionValidatedAr } from './templates/admission-validated.ar';
import type { AdmissionValidatedVars } from './templates/admission-validated.fr';
import { admissionRejectedTemplate as admissionRejectedFr } from './templates/admission-rejected.fr';
import { admissionRejectedTemplate as admissionRejectedAr } from './templates/admission-rejected.ar';
import type { AdmissionRejectedVars } from './templates/admission-rejected.fr';
import { artisanConsentAcceptedTemplate as consentAcceptedFr } from './templates/artisan-consent-accepted.fr';
import { artisanConsentAcceptedTemplate as consentAcceptedAr } from './templates/artisan-consent-accepted.ar';
import type { ArtisanConsentAcceptedVars } from './templates/artisan-consent-accepted.fr';
import { artisanConsentRefusedTemplate as consentRefusedFr } from './templates/artisan-consent-refused.fr';
import { artisanConsentRefusedTemplate as consentRefusedAr } from './templates/artisan-consent-refused.ar';
import type { ArtisanConsentRefusedVars } from './templates/artisan-consent-refused.fr';

// AR16 — Boundary unique pour tout envoi e-mail transactionnel applicatif.
// Note : `scripts/budget-alert.ts` est un script CLI ops (pas runtime app)
// et conserve son propre fetch direct, hors de cette boundary.

export type SendArgs =
  | {
      template: 'magic-link';
      to: string;
      locale: 'fr' | 'ar';
      vars: MagicLinkVars;
    }
  | {
      template: 'admission-notify-comod';
      to: string;
      locale: 'fr' | 'ar';
      vars: AdmissionNotifyComodVars;
    }
  | {
      template: 'admission-validated';
      to: string;
      locale: 'fr' | 'ar';
      vars: AdmissionValidatedVars;
    }
  | {
      template: 'admission-rejected';
      to: string;
      locale: 'fr' | 'ar';
      vars: AdmissionRejectedVars;
    }
  | {
      template: 'artisan-consent-accepted';
      to: string;
      locale: 'fr' | 'ar';
      vars: ArtisanConsentAcceptedVars;
    }
  | {
      template: 'artisan-consent-refused';
      to: string;
      locale: 'fr' | 'ar';
      vars: ArtisanConsentRefusedVars;
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
    case 'admission-notify-comod':
      return args.locale === 'ar' ? notifyComodAr(args.vars) : notifyComodFr(args.vars);
    case 'admission-validated':
      return args.locale === 'ar'
        ? admissionValidatedAr(args.vars)
        : admissionValidatedFr(args.vars);
    case 'admission-rejected':
      return args.locale === 'ar' ? admissionRejectedAr(args.vars) : admissionRejectedFr(args.vars);
    case 'artisan-consent-accepted':
      return args.locale === 'ar' ? consentAcceptedAr(args.vars) : consentAcceptedFr(args.vars);
    case 'artisan-consent-refused':
      return args.locale === 'ar' ? consentRefusedAr(args.vars) : consentRefusedFr(args.vars);
  }
}
