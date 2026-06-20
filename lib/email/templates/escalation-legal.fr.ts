import type { RenderedTemplate } from './magic-link.fr';

// Story 5.5 (FR35) — e-mail au contact juridique pré-identifié (LEGAL_CONTACT_EMAIL).
// Résumé + lien signé vers le dossier (30j) si le storage a réussi, sinon le dossier
// est joint inline (fallback). Aucune PII d'autres résidents (dossier déjà PII-safe).

export type EscalationLegalVars = {
  summary: string;
  dossier_url: string | null; // URL signée 30j (null → inline)
  dossier_inline: string | null; // Markdown du dossier (fallback si pas d'URL)
};

export type { RenderedTemplate };

export function escalationLegalTemplate(vars: EscalationLegalVars): RenderedTemplate {
  const summary = String(vars.summary ?? '').slice(0, 500);
  const url = vars.dossier_url ?? null;
  const inline = vars.dossier_inline ?? null;

  const subject = 'Darna — escalade juridique : dossier de modération';

  const linkBlockText = url
    ? `Dossier complet (lien valable 30 jours) :\n${url}\n`
    : `Dossier complet (ci-dessous) :\n\n${inline ?? ''}\n`;
  const textContent = `Bonjour,

Un co-modérateur de Darna sollicite un avis juridique sur un contenu signalé.

${summary}

${linkBlockText}
Ce dossier ne contient aucune donnée personnelle identifiante (minimisation CNDP).

— L'équipe Darna`;

  const linkBlockHtml = url
    ? `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#5B9C66;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:14px;display:inline-block;font-weight:600">Ouvrir le dossier (valable 30 jours)</a></p>`
    : `<pre style="white-space:pre-wrap;background:#f5f5f5;padding:16px;border-radius:10px;font-size:13px">${escapeHtml(inline ?? '')}</pre>`;
  const htmlContent = `<!doctype html><html lang="fr"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:640px;margin:0 auto;padding:24px">
<p>Bonjour,</p>
<p>Un co-modérateur de Darna sollicite un avis juridique sur un contenu signalé.</p>
<p><strong>${escapeHtml(summary)}</strong></p>
${linkBlockHtml}
<p style="font-size:14px;color:#6b6b6b">Ce dossier ne contient aucune donnée personnelle identifiante (minimisation CNDP).</p>
<p style="font-size:14px;color:#6b6b6b">— L'équipe Darna</p>
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
