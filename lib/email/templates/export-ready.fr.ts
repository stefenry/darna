import type { RenderedTemplate } from './magic-link.fr';

export type ExportReadyVars = {
  download_url: string;
};

export type { RenderedTemplate };

// Story 8.3 (AR21) — e-mail envoyé au résident quand son export RGPD est prêt.
// Contient l'URL signée (valide 24h). Ton chaleureux, première personne, zéro
// tracking pixel / zéro image (contraintes 1.6).
export function exportReadyTemplate(vars: ExportReadyVars): RenderedTemplate {
  const link = String(vars.download_url ?? '');

  const subject = 'Ton export Darna est prêt';

  const textContent = `Ton export est prêt 📦

Tu peux télécharger l'ensemble de tes données et contributions Darna au format JSON :

${link}

Ce lien est valable 24 heures, puis il expire automatiquement (le fichier est supprimé).

— L'équipe Darna`;

  const htmlContent = `<!doctype html><html lang="fr"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>Ton export est prêt 📦</p>
<p>Tu peux télécharger l'ensemble de tes données et contributions Darna au format JSON :</p>
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#3B6944;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:14px;display:inline-block;font-weight:600">Télécharger mon export</a></p>
<p style="font-size:14px;color:#6b6b6b">Ou copie-colle ce lien dans ton navigateur :<br/><span style="word-break:break-all">${escapeHtml(link)}</span></p>
<p style="font-size:14px;color:#6b6b6b">Ce lien est valable 24 heures, puis il expire automatiquement (le fichier est supprimé).</p>
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
