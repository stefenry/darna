export type MagicLinkVars = {
  link: string;
  expiresInMinutes: number;
  // OTP code 6-chiffres (optionnel pour compat ancien code). Affiché en
  // alternative au lien pour les PWA iOS standalone qui ont un cookie jar
  // séparé de Safari : l'utilisateur saisit le code sur /auth/login depuis
  // la PWA et reste connecté dans l'app.
  code?: string;
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
  // Supabase default OTP length = 6 chiffres mais configurable 6-10. On accepte
  // tout token numérique 6-10 chiffres pour rester safe vs config Supabase.
  const code = typeof vars.code === 'string' && /^\d{6,10}$/.test(vars.code) ? vars.code : null;

  const subject = 'Connecte-toi à Darna en un clic';

  const codeTextBlock = code
    ? `

OU saisis ce code dans l'app (utile si tu as installé Darna sur ton téléphone) :

    ${code}

`
    : '';

  const textContent = `Salut 👋

Clique sur le lien ci-dessous pour te connecter à Darna :

${link}${codeTextBlock}

Le lien et le code expirent dans ${expiresInMinutes} minutes et ne sont utilisables qu'une seule fois.

Si tu n'as pas demandé ce lien, ignore cet e-mail — aucun compte n'a été créé sans ta confirmation.

— L'équipe Darna`;

  const codeHtmlBlock = code
    ? `
<p style="margin-top:32px;font-size:14px;color:#6b6b6b">Ou si tu as installé Darna sur ton téléphone, ouvre l'app et saisis ce code :</p>
<p style="margin:12px 0"><span style="font-family:ui-monospace,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:0.2em;color:#1f1f1f;background:#f3f4f6;padding:12px 20px;border-radius:10px;display:inline-block">${escapeHtml(code)}</span></p>`
    : '';

  const htmlContent = `<!doctype html><html lang="fr"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>Salut 👋</p>
<p>Clique sur le bouton ci-dessous pour te connecter à Darna :</p>
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#3B6944;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:14px;display:inline-block;font-weight:600">Me connecter à Darna</a></p>
<p style="font-size:14px;color:#6b6b6b">Ou copie-colle ce lien dans ton navigateur :<br/><span style="word-break:break-all">${escapeHtml(link)}</span></p>${codeHtmlBlock}
<p style="font-size:14px;color:#6b6b6b">Le lien et le code expirent dans ${expiresInMinutes} minutes et ne sont utilisables qu'une seule fois.</p>
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
