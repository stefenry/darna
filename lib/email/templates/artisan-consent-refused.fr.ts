import type { RenderedTemplate } from './magic-link.fr';

export type ArtisanConsentRefusedVars = {
  artisanName: string;
};

export type { RenderedTemplate };

// Story 2.5 — e-mail neutre au contributeur quand l'artisan REFUSE (NFR18).
export function artisanConsentRefusedTemplate(vars: ArtisanConsentRefusedVars): RenderedTemplate {
  const name = String(vars.artisanName ?? '')
    .slice(0, 120)
    .trim();
  const subject = `${name} a décliné la publication`;

  const textContent = `${name} a choisi de ne pas être référencé sur l'annuaire Darna.

Conformément à son choix, les données que tu avais saisies pour cette fiche ont été supprimées.

Merci quand même pour ton intention d'aider tes voisins.

— L'équipe Darna`;

  const htmlContent = `<!doctype html><html lang="fr"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p><strong>${escapeHtml(name)}</strong> a choisi de ne pas être référencé sur l'annuaire Darna.</p>
<p>Conformément à son choix, les données que tu avais saisies pour cette fiche ont été supprimées.</p>
<p style="font-size:14px;color:#6b6b6b">Merci quand même pour ton intention d'aider tes voisins.</p>
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
