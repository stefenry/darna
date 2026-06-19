import type { RenderedTemplate } from './magic-link.fr';
import type { ArtisanConsentRefusedVars } from './artisan-consent-refused.fr';
import { escapeHtml, singleLine } from '../escape';

export type { ArtisanConsentRefusedVars, RenderedTemplate };

// Story 2.5 — version AR. Review P26/P27 : singleLine + escape centralisé.
export function artisanConsentRefusedTemplate(vars: ArtisanConsentRefusedVars): RenderedTemplate {
  const name = singleLine(String(vars.artisanName ?? '')).slice(0, 120);
  const subject = singleLine(`${name} رفض النشر`);

  const textContent = `اختار ${name} عدم الظهور في دليل دارنا.

وفقًا لاختياره، تم حذف البيانات التي أدخلتها لهذه البطاقة.

شكرًا على نيتك في مساعدة جيرانك.

— فريق دارنا`;

  const htmlContent = `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>اختار <strong>${escapeHtml(name)}</strong> عدم الظهور في دليل دارنا.</p>
<p>وفقًا لاختياره، تم حذف البيانات التي أدخلتها لهذه البطاقة.</p>
<p style="font-size:14px;color:#6b6b6b">شكرًا على نيتك في مساعدة جيرانك.</p>
<p style="font-size:14px;color:#6b6b6b">— فريق دارنا</p>
</body></html>`;

  return { subject, htmlContent, textContent };
}
