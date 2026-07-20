import type { RenderedTemplate } from './magic-link.fr';

// Story 6.5 (FR43c/FR42) — e-mail co_mod : « Nouvelle suggestion ». On n'envoie
// qu'un extrait (pas l'auteur — la pression sociale est réduite côté UI aussi).

export type SuggestionNotifyComodVars = {
  excerpt: string; // extrait de la suggestion (déjà tronqué)
  queue_url: string;
};

export type { RenderedTemplate };

export function suggestionNotifyComodTemplate(vars: SuggestionNotifyComodVars): RenderedTemplate {
  const excerpt = String(vars.excerpt ?? '').slice(0, 280);
  const queueUrl = String(vars.queue_url ?? '');

  const subject = 'Nouvelle suggestion de la communauté';

  const textContent = `Salut 👋

Un voisin vient de partager une suggestion d'évolution sur Darna :

« ${excerpt} »

Ouvre l'espace suggestions pour la lire :
${queueUrl}

— L'équipe Darna`;

  const htmlContent = `<!doctype html><html lang="fr"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>Salut 👋</p>
<p>Un voisin vient de partager une suggestion d'évolution sur Darna :</p>
<blockquote style="border-inline-start:3px solid #3B6944;margin:16px 0;padding:4px 16px;color:#38362E">${escapeHtml(excerpt)}</blockquote>
<p style="margin:24px 0"><a href="${escapeHtml(queueUrl)}" style="background:#3B6944;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:14px;display:inline-block;font-weight:600">Lire les suggestions</a></p>
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
