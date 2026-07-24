import type { RenderedTemplate } from './magic-link.fr';

// Feedback bêta 2026-07-23 — e-mail co_mod : « Nouvel artisan à valider ».
// Avec l'envoi SMS coupé, toute fiche créée attend une publication co_mod ;
// sans notification, la file /comod/artisans n'est vue qu'en y pensant.
// On n'envoie que le nom de l'artisan (pas le contributeur — même retenue que
// suggestion-notify-comod, FR42).

export type ArtisanNotifyComodVars = {
  artisan_name: string;
  queue_url: string;
};

export type { RenderedTemplate };

export function artisanNotifyComodTemplate(vars: ArtisanNotifyComodVars): RenderedTemplate {
  const artisanName = String(vars.artisan_name ?? '').slice(0, 120);
  const queueUrl = String(vars.queue_url ?? '');

  const subject = 'Nouvel artisan à valider';

  const textContent = `Salut 👋

Un voisin vient de recommander un artisan sur l'annuaire : ${artisanName}.

Sa fiche attend ta validation avant publication. Ouvre la file pour la vérifier :
${queueUrl}

— L'équipe Darna`;

  const htmlContent = `<!doctype html><html lang="fr"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>Salut 👋</p>
<p>Un voisin vient de recommander un artisan sur l'annuaire : <strong>${escapeHtml(artisanName)}</strong>.</p>
<p>Sa fiche attend ta validation avant publication.</p>
<p style="margin:24px 0"><a href="${escapeHtml(queueUrl)}" style="background:#3B6944;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:14px;display:inline-block;font-weight:600">Voir les artisans à valider</a></p>
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
