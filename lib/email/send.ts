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
import { reportNotifyComodTemplate as reportNotifyComodFr } from './templates/report-notify-comod.fr';
import { reportNotifyComodTemplate as reportNotifyComodAr } from './templates/report-notify-comod.ar';
import type { ReportNotifyComodVars } from './templates/report-notify-comod.fr';
import { contentRemovedAuthorTemplate as contentRemovedAuthorFr } from './templates/content-removed-author.fr';
import { contentRemovedAuthorTemplate as contentRemovedAuthorAr } from './templates/content-removed-author.ar';
import type { ContentRemovedAuthorVars } from './templates/content-removed-author.fr';
import { reportKeptReporterTemplate as reportKeptReporterFr } from './templates/report-kept-reporter.fr';
import { reportKeptReporterTemplate as reportKeptReporterAr } from './templates/report-kept-reporter.ar';
import type { ReportKeptReporterVars } from './templates/report-kept-reporter.fr';
import { escalationLegalTemplate as escalationLegalFr } from './templates/escalation-legal.fr';
import { escalationLegalTemplate as escalationLegalAr } from './templates/escalation-legal.ar';
import type { EscalationLegalVars } from './templates/escalation-legal.fr';
import { suggestionNotifyComodTemplate as suggestionNotifyComodFr } from './templates/suggestion-notify-comod.fr';
import { suggestionNotifyComodTemplate as suggestionNotifyComodAr } from './templates/suggestion-notify-comod.ar';
import type { SuggestionNotifyComodVars } from './templates/suggestion-notify-comod.fr';

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
    }
  | {
      template: 'report-notify-comod';
      to: string;
      locale: 'fr' | 'ar';
      vars: ReportNotifyComodVars;
    }
  | {
      template: 'content-removed-author';
      to: string;
      locale: 'fr' | 'ar';
      vars: ContentRemovedAuthorVars;
    }
  | {
      template: 'report-kept-reporter';
      to: string;
      locale: 'fr' | 'ar';
      vars: ReportKeptReporterVars;
    }
  | {
      template: 'escalation-legal';
      to: string;
      locale: 'fr' | 'ar';
      vars: EscalationLegalVars;
    }
  | {
      template: 'suggestion-notify-comod';
      to: string;
      locale: 'fr' | 'ar';
      vars: SuggestionNotifyComodVars;
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
    case 'report-notify-comod':
      return args.locale === 'ar' ? reportNotifyComodAr(args.vars) : reportNotifyComodFr(args.vars);
    case 'content-removed-author':
      return args.locale === 'ar'
        ? contentRemovedAuthorAr(args.vars)
        : contentRemovedAuthorFr(args.vars);
    case 'report-kept-reporter':
      return args.locale === 'ar'
        ? reportKeptReporterAr(args.vars)
        : reportKeptReporterFr(args.vars);
    case 'escalation-legal':
      return args.locale === 'ar' ? escalationLegalAr(args.vars) : escalationLegalFr(args.vars);
    case 'suggestion-notify-comod':
      return args.locale === 'ar'
        ? suggestionNotifyComodAr(args.vars)
        : suggestionNotifyComodFr(args.vars);
  }
}
