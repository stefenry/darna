import type { RenderedTemplate, SuggestionNotifyComodVars } from './suggestion-notify-comod.fr';

// Story 6.5 — version AR (RTL). MVP FR-only mais structure bilingue prête.

export type { SuggestionNotifyComodVars };

export function suggestionNotifyComodTemplate(vars: SuggestionNotifyComodVars): RenderedTemplate {
  const excerpt = String(vars.excerpt ?? '').slice(0, 280);
  const queueUrl = String(vars.queue_url ?? '');

  const subject = 'اقتراح جديد من المجتمع';

  const textContent = `مرحبًا 👋

شارك أحد الجيران اقتراحًا للتطوير على دارنا:

« ${excerpt} »

افتح مساحة الاقتراحات لقراءته:
${queueUrl}

— فريق دارنا`;

  const htmlContent = `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1f;max-width:560px;margin:0 auto;padding:24px">
<p>مرحبًا 👋</p>
<p>شارك أحد الجيران اقتراحًا للتطوير على دارنا:</p>
<blockquote style="border-inline-start:3px solid #5B9C66;margin:16px 0;padding:4px 16px;color:#38362E">${escapeHtml(excerpt)}</blockquote>
<p style="margin:24px 0"><a href="${escapeHtml(queueUrl)}" style="background:#5B9C66;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:14px;display:inline-block;font-weight:600">قراءة الاقتراحات</a></p>
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
