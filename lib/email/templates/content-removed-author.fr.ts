import type { RenderedTemplate } from './magic-link.fr';

// Story 5.3 (FR32) — e-mail à l'AUTEUR d'un contenu retiré par la modération.
// « Votre contribution a été retirée — motif : [motif] ». Pas de PII du reporter.

export type ContentRemovedAuthorVars = {
  content_label: string; // type de contenu localisé (ex. « Avis »)
  motive_label: string; // motif localisé (ex. « Diffamation »)
};

export type { RenderedTemplate };

export function contentRemovedAuthorTemplate(vars: ContentRemovedAuthorVars): RenderedTemplate {
  const contentLabel = String(vars.content_label ?? '').slice(0, 60);
  const motiveLabel = String(vars.motive_label ?? '').slice(0, 60);

  const subject = 'Votre contribution a été retirée';

  const textContent = `Bonjour,

Un co-modérateur de Darna a retiré l'une de vos contributions :

  • Contenu : ${contentLabel}
  • Motif : ${motiveLabel}

La modération de Darna est horizontale et transparente : chaque retrait est motivé et consigné dans le journal public.

Si vous pensez qu'il s'agit d'une erreur, vous pouvez republier un contenu conforme à la charte.

— L'équipe Darna`;

  const htmlContent = `<!doctype html><html lang="fr"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>Bonjour,</p>
<p>Un co-modérateur de Darna a retiré l'une de vos contributions :</p>
<ul style="line-height:1.8">
<li>Contenu : <strong>${escapeHtml(contentLabel)}</strong></li>
<li>Motif : <strong>${escapeHtml(motiveLabel)}</strong></li>
</ul>
<p style="font-size:14px;color:#6b6b6b">La modération de Darna est horizontale et transparente : chaque retrait est motivé et consigné dans le journal public.</p>
<p style="font-size:14px;color:#6b6b6b">Si vous pensez qu'il s'agit d'une erreur, vous pouvez republier un contenu conforme à la charte.</p>
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
