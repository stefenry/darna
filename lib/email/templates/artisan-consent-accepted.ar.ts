import type { RenderedTemplate } from './magic-link.fr';
import type { ArtisanConsentAcceptedVars } from './artisan-consent-accepted.fr';
import { escapeHtml, singleLine } from '../escape';

export type { ArtisanConsentAcceptedVars, RenderedTemplate };

// Story 2.5 — version AR (le contributeur peut avoir choisi l'arabe, V1.5).
// Review P26/P27 : singleLine + escape centralisé.
export function artisanConsentAcceptedTemplate(vars: ArtisanConsentAcceptedVars): RenderedTemplate {
  const name = singleLine(String(vars.artisanName ?? '')).slice(0, 120);
  const url = String(vars.ficheUrl ?? '');
  const subject = singleLine(`بطاقة ${name} أصبحت متاحة 🎉`);

  const textContent = `خبر سار!

أكّد ${name} بطاقته في دليل دارنا. أصبحت الآن مرئية لجيرانك:

${url}

شكرًا على مساهمتك.

— فريق دارنا`;

  const htmlContent = `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>خبر سار!</p>
<p>أكّد <strong>${escapeHtml(name)}</strong> بطاقته في دليل دارنا. أصبحت الآن مرئية لجيرانك.</p>
<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#5B9C66;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:14px;display:inline-block;font-weight:600">عرض البطاقة</a></p>
<p style="font-size:14px;color:#6b6b6b">شكرًا على مساهمتك.</p>
<p style="font-size:14px;color:#6b6b6b">— فريق دارنا</p>
</body></html>`;

  return { subject, htmlContent, textContent };
}
