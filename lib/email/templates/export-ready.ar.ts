import type { RenderedTemplate } from './magic-link.fr';
import type { ExportReadyVars } from './export-ready.fr';

export type { RenderedTemplate };

// Story 8.3 (AR21) — نسخة عربية من بريد «التصدير جاهز». رابط موقّع صالح 24 ساعة.
export function exportReadyTemplate(vars: ExportReadyVars): RenderedTemplate {
  const link = String(vars.download_url ?? '');

  const subject = 'تصديرك من Darna جاهز';

  const textContent = `تصديرك جاهز 📦

يمكنك تنزيل جميع بياناتك ومساهماتك على Darna بصيغة JSON:

${link}

هذا الرابط صالح لمدة 24 ساعة، ثم ينتهي تلقائيًا (يُحذف الملف).

— فريق Darna`;

  const htmlContent = `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px;text-align:right">
<p>تصديرك جاهز 📦</p>
<p>يمكنك تنزيل جميع بياناتك ومساهماتك على Darna بصيغة JSON:</p>
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#5B9C66;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:14px;display:inline-block;font-weight:600">تنزيل تصديري</a></p>
<p style="font-size:14px;color:#6b6b6b">أو انسخ هذا الرابط في متصفحك:<br/><span style="word-break:break-all">${escapeHtml(link)}</span></p>
<p style="font-size:14px;color:#6b6b6b">هذا الرابط صالح لمدة 24 ساعة، ثم ينتهي تلقائيًا (يُحذف الملف).</p>
<p style="font-size:14px;color:#6b6b6b">— فريق Darna</p>
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
