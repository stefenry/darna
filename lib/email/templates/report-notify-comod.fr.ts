import type { RenderedTemplate } from './magic-link.fr';

// Story 5.2 — e-mail co_mod : « Nouveau signalement » (FR42). Pas de PII du
// reporter (anonyme côté co_mod jusqu'à la queue 5.3) : on n'envoie que le type
// de cible, le motif, et l'éventuelle note du reporter (texte déjà sanitisé).

export type ReportNotifyComodVars = {
  target_label: string; // libellé localisé du type de cible (ex. « Artisan »)
  reason_label: string; // libellé localisé du motif (ex. « Diffamation »)
  note_text: string | null; // note libre du reporter (peut être vide)
  queue_url: string;
};

export type { RenderedTemplate };

export function reportNotifyComodTemplate(vars: ReportNotifyComodVars): RenderedTemplate {
  const targetLabel = String(vars.target_label ?? '').slice(0, 60);
  const reasonLabel = String(vars.reason_label ?? '').slice(0, 60);
  const note = vars.note_text ? String(vars.note_text).slice(0, 200) : '';
  const queueUrl = String(vars.queue_url ?? '');

  const subject = `Nouveau signalement : ${reasonLabel} sur ${targetLabel}`;

  const noteTextBlock = note ? `\n  • Note du voisin : ${note}\n` : '\n';
  const textContent = `Salut 👋

Un voisin vient de signaler un contenu sur Darna :

  • Type : ${targetLabel}
  • Motif : ${reasonLabel}${noteTextBlock}
Ouvre la file de modération pour examiner sous 24h max :
${queueUrl}

— L'équipe Darna`;

  const noteHtmlBlock = note
    ? `<li>Note du voisin : <strong>${escapeHtml(note)}</strong></li>`
    : '';
  const htmlContent = `<!doctype html><html lang="fr"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>Salut 👋</p>
<p>Un voisin vient de signaler un contenu sur Darna :</p>
<ul style="line-height:1.8">
<li>Type : <strong>${escapeHtml(targetLabel)}</strong></li>
<li>Motif : <strong>${escapeHtml(reasonLabel)}</strong></li>
${noteHtmlBlock}
</ul>
<p style="margin:24px 0"><a href="${escapeHtml(queueUrl)}" style="background:#5B9C66;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:14px;display:inline-block;font-weight:600">Ouvrir la file de modération</a></p>
<p style="font-size:14px;color:#6b6b6b">Le SLA communautaire est de 24h max. Tu pourras retirer ou conserver le contenu en motivant ta décision.</p>
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
