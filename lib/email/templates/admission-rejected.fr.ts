import type { RenderedTemplate } from './magic-link.fr';
import type { AdmissionDecisionReason } from '@/lib/validation/admission-decision';

export type AdmissionRejectedVars = {
  villa: number;
  motive: AdmissionDecisionReason;
  privacy_url?: string;
};

export type { RenderedTemplate };

// Story 1.8 — E-mail NEUTRE envoyé au demandeur REJETÉ. Ton non-infantilisant,
// motif explicité mais sans jugement (mitigation risque S3 « rejet perçu
// arbitraire » → motif fermé, ux:967). Aucun magic-link (pas de promotion).
// La phrase est choisie selon le motif fermé (miroir enum DB).
const MOTIVE_TEXT: Record<AdmissionDecisionReason, string> = {
  villa_out_of_range:
    'Le numéro de villa indiqué ne correspond pas à la résidence. Vérifie-le et soumets une nouvelle demande.',
  duplicate:
    "Une demande existait déjà pour ce logement. Si tu penses qu'il y a une erreur, reviens vers un voisin co-mod.",
  incomplete_info:
    "Il manque des informations pour valider ta demande. N'hésite pas à la soumettre de nouveau, complète.",
  manual_review_needed:
    'Ta demande nécessite une vérification de notre part. Nous revenons vers toi prochainement.',
};

export function admissionRejectedTemplate(vars: AdmissionRejectedVars): RenderedTemplate {
  const villa = Number.isFinite(vars.villa) ? Math.floor(vars.villa) : 0;
  const motive: AdmissionDecisionReason =
    vars.motive in MOTIVE_TEXT ? vars.motive : 'manual_review_needed';
  const reason = MOTIVE_TEXT[motive];

  const subject = "Ta demande d'admission à Darna";

  const textContent = `Bonjour,

Ta demande d'admission à Darna (villa ${villa}) n'a pas pu être validée pour le moment.

${reason}

— L'équipe Darna`;

  const privacyLink = vars.privacy_url
    ? `\n<p style="font-size:13px;color:#9b9b9b;margin-top:24px"><a href="${escapeHtml(vars.privacy_url)}" style="color:#9b9b9b">Politique de confidentialité</a></p>`
    : '';

  const htmlContent = `<!doctype html><html lang="fr"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>Bonjour,</p>
<p>Ta demande d'admission à Darna (villa <strong>${escapeHtml(String(villa))}</strong>) n'a pas pu être validée pour le moment.</p>
<p>${escapeHtml(reason)}</p>
<p style="font-size:14px;color:#6b6b6b">— L'équipe Darna</p>${privacyLink}
</body></html>`;

  return { subject, htmlContent, textContent };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
