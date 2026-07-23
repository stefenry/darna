import type { RenderedTemplate, ArtisanNotifyComodVars } from './artisan-notify-comod.fr';

// Feedback bêta 2026-07-23 — version AR (RTL). MVP FR-only mais structure
// bilingue prête (parité NFR44).

export type { ArtisanNotifyComodVars };

export function artisanNotifyComodTemplate(vars: ArtisanNotifyComodVars): RenderedTemplate {
  const artisanName = String(vars.artisan_name ?? '').slice(0, 120);
  const queueUrl = String(vars.queue_url ?? '');

  const subject = 'حرفي جديد بانتظار المصادقة';

  const textContent = `مرحبًا 👋

أوصى أحد الجيران بحرفي على الدليل: ${artisanName}.

بطاقته بانتظار مصادقتك قبل النشر. افتح القائمة للتحقق منها:
${queueUrl}

— فريق دارنا`;

  const htmlContent = `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>مرحبًا 👋</p>
<p>أوصى أحد الجيران بحرفي على الدليل: <strong>${escapeHtml(artisanName)}</strong>.</p>
<p>بطاقته بانتظار مصادقتك قبل النشر.</p>
<p style="margin:24px 0"><a href="${escapeHtml(queueUrl)}" style="background:#3B6944;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:14px;display:inline-block;font-weight:600">عرض الحرفيين بانتظار المصادقة</a></p>
<p style="font-size:14px;color:#6b6b6b">— فريق دارنا</p>
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
