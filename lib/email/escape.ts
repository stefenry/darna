// Story 2.5 review P27 — helper centralisé HTML escape + CRLF strip pour les
// templates emails (anti header injection sur subject, anti XSS dans body).

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch] ?? ch);
}

// CR, LF, vertical tab, form feed + LINE/PARAGRAPH SEPARATOR Unicode → espace.
const VERTICAL_WS = new RegExp('[\\r\\n\\v\\f\\u2028\\u2029]+', 'g');

/** Strip CR/LF + autre vertical whitespace pour les en-têtes mail (Subject, From). */
export function singleLine(s: string): string {
  return s.replace(VERTICAL_WS, ' ').trim();
}
