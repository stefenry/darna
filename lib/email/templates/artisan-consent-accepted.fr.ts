import type { RenderedTemplate } from './magic-link.fr';
import { escapeHtml, singleLine } from '../escape';

export type ArtisanConsentAcceptedVars = {
  artisanName: string;
  ficheUrl: string;
};

export type { RenderedTemplate };

// Story 2.5 — e-mail au contributeur quand l'artisan ACCEPTE sa fiche.
// Review P26 : `singleLine` strippe CRLF du subject (anti header injection).
// Review P27 : `escapeHtml` centralisé dans `../escape`.
export function artisanConsentAcceptedTemplate(vars: ArtisanConsentAcceptedVars): RenderedTemplate {
  const name = singleLine(String(vars.artisanName ?? '')).slice(0, 120);
  const url = String(vars.ficheUrl ?? '');
  const subject = singleLine(`La fiche de ${name} est en ligne 🎉`);

  const textContent = `Bonne nouvelle !

${name} a confirmé sa fiche sur l'annuaire Darna. Elle est maintenant visible par tes voisins :

${url}

Merci pour ta contribution — c'est grâce à toi que l'annuaire s'enrichit.

— L'équipe Darna`;

  const htmlContent = `<!doctype html><html lang="fr"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>Bonne nouvelle !</p>
<p><strong>${escapeHtml(name)}</strong> a confirmé sa fiche sur l'annuaire Darna. Elle est maintenant visible par tes voisins.</p>
<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#5B9C66;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:14px;display:inline-block;font-weight:600">Voir la fiche</a></p>
<p style="font-size:14px;color:#6b6b6b">Merci pour ta contribution — c'est grâce à toi que l'annuaire s'enrichit.</p>
<p style="font-size:14px;color:#6b6b6b">— L'équipe Darna</p>
</body></html>`;

  return { subject, htmlContent, textContent };
}
