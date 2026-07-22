import type { RenderedTemplate } from './magic-link.fr';

export type AdmissionValidatedVars = {
  first_name?: string;
  villa: number;
  magic_link: string;
};

export type { RenderedTemplate };

// Story 1.8 — E-mail de bienvenue envoyé au demandeur ACCEPTÉ par un co-mod.
// Contient un magic-link frais : le clic ouvre /auth/confirm → resolveRedirect
// lit state='accepted' → redirige vers /community/ (story 1.6). Ton chaleureux,
// première personne, zéro tracking pixel / zéro image (contraintes 1.6).
export function admissionValidatedTemplate(vars: AdmissionValidatedVars): RenderedTemplate {
  const firstName = String(vars.first_name ?? '')
    .slice(0, 60)
    .trim();
  const villa = Number.isFinite(vars.villa) ? Math.floor(vars.villa) : 0;
  const link = String(vars.magic_link ?? '');
  const greeting = firstName ? `Bienvenue, ${firstName} 👋` : 'Bienvenue à Darna 👋';

  const subject = 'Bienvenue à Darna 👋';

  const textContent = `${greeting}

Bonne nouvelle : un voisin co-mod vient de valider ton accès à Darna (villa ${villa}).

Connecte-toi en un clic pour découvrir l'annuaire, le guide et les alertes de la résidence :

${link}

Le lien expire bientôt et n'est utilisable qu'une seule fois.

— L'équipe Darna`;

  const htmlContent = `<!doctype html><html lang="fr"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>${escapeHtml(greeting)}</p>
<p>Bonne nouvelle : un voisin co-mod vient de valider ton accès à Darna (villa <strong>${escapeHtml(String(villa))}</strong>).</p>
<p>Connecte-toi en un clic pour découvrir l'annuaire, le guide et les alertes de la résidence :</p>
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#3B6944;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:14px;display:inline-block;font-weight:600">Me connecter à Darna</a></p>
<p style="font-size:14px;color:#6b6b6b">Ou copie-colle ce lien dans ton navigateur :<br/><span style="word-break:break-all">${escapeHtml(link)}</span></p>
<p style="font-size:14px;color:#6b6b6b">Le lien expire bientôt et n'est utilisable qu'une seule fois.</p>
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
