import type { RenderedTemplate } from './magic-link.fr';

export type AdmissionNotifyComodVars = {
  villa: number;
  tranche: string;
  first_name: string;
  queue_url: string;
};

export type { RenderedTemplate };

export function admissionNotifyComodTemplate(vars: AdmissionNotifyComodVars): RenderedTemplate {
  const villa = Number.isFinite(vars.villa) ? Math.floor(vars.villa) : 0;
  const tranche = String(vars.tranche ?? '').slice(0, 4);
  const firstName = String(vars.first_name ?? '').slice(0, 60);
  const queueUrl = String(vars.queue_url ?? '');

  const subject = `Nouvelle demande d'admission — villa ${villa} (${tranche})`;

  const textContent = `Salut 👋

Une nouvelle demande d'admission Darna vient d'arriver :

  • Villa : ${villa}
  • Tranche : ${tranche}
  • Prénom : ${firstName}

Ouvre la file pour décider sous 24h max :
${queueUrl}

— L'équipe Darna`;

  const htmlContent = `<!doctype html><html lang="fr"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>Salut 👋</p>
<p>Une nouvelle demande d'admission Darna vient d'arriver :</p>
<ul style="line-height:1.8">
<li>Villa : <strong>${escapeHtml(String(villa))}</strong></li>
<li>Tranche : <strong>${escapeHtml(tranche)}</strong></li>
<li>Prénom : <strong>${escapeHtml(firstName)}</strong></li>
</ul>
<p style="margin:24px 0"><a href="${escapeHtml(queueUrl)}" style="background:#3B6944;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:14px;display:inline-block;font-weight:600">Ouvrir la file d'admission</a></p>
<p style="font-size:14px;color:#6b6b6b">Le SLA communautaire est de 24h max. Ouvre la file pour valider ou rejeter avec un motif.</p>
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
