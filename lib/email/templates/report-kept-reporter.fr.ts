import type { RenderedTemplate } from './magic-link.fr';

// Story 5.3 (FR32) — e-mail neutre au REPORTER quand le contenu signalé est
// conservé. « Votre signalement a été examiné et le contenu a été conservé. »

export type ReportKeptReporterVars = {
  content_label: string; // type de contenu localisé
};

export type { RenderedTemplate };

export function reportKeptReporterTemplate(vars: ReportKeptReporterVars): RenderedTemplate {
  const contentLabel = String(vars.content_label ?? '').slice(0, 60);

  const subject = 'Votre signalement a été examiné';

  const textContent = `Bonjour,

Merci d'avoir signalé un contenu sur Darna. Un co-modérateur l'a examiné :

  • Contenu : ${contentLabel}
  • Décision : le contenu a été conservé (il respecte la charte communautaire).

Votre vigilance aide à garder Darna sain. Chaque décision de modération est consignée dans le journal public.

— L'équipe Darna`;

  const htmlContent = `<!doctype html><html lang="fr"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>Bonjour,</p>
<p>Merci d'avoir signalé un contenu sur Darna. Un co-modérateur l'a examiné :</p>
<ul style="line-height:1.8">
<li>Contenu : <strong>${escapeHtml(contentLabel)}</strong></li>
<li>Décision : le contenu a été <strong>conservé</strong> (il respecte la charte communautaire).</li>
</ul>
<p style="font-size:14px;color:#6b6b6b">Votre vigilance aide à garder Darna sain. Chaque décision de modération est consignée dans le journal public.</p>
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
