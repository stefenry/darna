export type MagicLinkVars = {
  link: string;
  expiresInMinutes: number;
};

export type RenderedTemplate = {
  subject: string;
  htmlContent: string;
  textContent: string;
};

export function magicLinkTemplate(vars: MagicLinkVars): RenderedTemplate {
  const { link } = vars;
  // Coerce defensively: even though the type is `number`, runtime drift in
  // callers could inject HTML via this value (it lands in the email body raw).
  const ttl = Number.isFinite(vars.expiresInMinutes)
    ? Math.max(1, Math.floor(vars.expiresInMinutes))
    : 15;
  const expiresInMinutes = ttl;

  const subject = 'Connecte-toi à Darna en un clic';

  const textContent = `Salut 👋

Clique sur le lien ci-dessous pour te connecter à Darna :

${link}

Le lien expire dans ${expiresInMinutes} minutes et n'est utilisable qu'une seule fois.

Si tu n'as pas demandé ce lien, ignore cet e-mail — aucun compte n'a été créé sans ta confirmation.

— L'équipe Darna`;

  const htmlContent = `<!doctype html><html lang="fr"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>Salut 👋</p>
<p>Clique sur le bouton ci-dessous pour te connecter à Darna :</p>
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#5B9C66;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:14px;display:inline-block;font-weight:600">Me connecter à Darna</a></p>
<p style="font-size:14px;color:#6b6b6b">Ou copie-colle ce lien dans ton navigateur :<br/><span style="word-break:break-all">${escapeHtml(link)}</span></p>
<p style="font-size:14px;color:#6b6b6b">Le lien expire dans ${expiresInMinutes} minutes et n'est utilisable qu'une seule fois.</p>
<p style="font-size:14px;color:#6b6b6b">Si tu n'as pas demandé ce lien, ignore cet e-mail — aucun compte n'a été créé sans ta confirmation.</p>
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
