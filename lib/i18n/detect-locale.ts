import type { NextRequest } from 'next/server';
import { routing } from './routing';

type SupportedLocale = (typeof routing.locales)[number];

const COOKIE_NAME = 'NEXT_LOCALE';

function isSupported(value: string | undefined): value is SupportedLocale {
  return typeof value === 'string' && (routing.locales as readonly string[]).includes(value);
}

// Proper RFC 7231 Accept-Language parser: split on ',', extract primary tag
// (chars before any '-' or ';'), sort by quality (default 1.0), return ordered
// list. Avoids the previous /[a-z]{2}/gi regex which matched `q`, `US`,
// quality digits and ignored order/weights.
function parseAcceptLanguage(value: string): string[] {
  const entries: { tag: string; q: number }[] = [];
  for (const raw of value.split(',')) {
    const segment = raw.trim();
    if (!segment) continue;
    const [tagPart, ...params] = segment.split(';');
    if (!tagPart) continue;
    const primary = (tagPart.split('-')[0] ?? '').trim().toLowerCase();
    if (!/^[a-z]{2,3}$/.test(primary)) continue;
    let q = 1;
    for (const param of params) {
      const [k, v] = param.split('=');
      if (k?.trim().toLowerCase() === 'q' && v !== undefined) {
        const parsed = Number(v.trim());
        if (Number.isFinite(parsed)) q = Math.max(0, Math.min(1, parsed));
      }
    }
    entries.push({ tag: primary, q });
  }
  entries.sort((a, b) => b.q - a.q);
  return entries.filter((e) => e.q > 0).map((e) => e.tag);
}

function pickFromAcceptLanguage(value: string): SupportedLocale | null {
  for (const candidate of parseAcceptLanguage(value)) {
    if (isSupported(candidate)) return candidate;
  }
  return null;
}

export function detectLocale(request: NextRequest): SupportedLocale {
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  if (isSupported(cookieValue)) return cookieValue;

  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    const picked = pickFromAcceptLanguage(acceptLanguage);
    if (picked) return picked;
  }

  return routing.defaultLocale;
}

export function detectLocaleFromHeaders(
  cookieHeader: string | null,
  acceptLanguage: string | null,
): SupportedLocale {
  if (cookieHeader) {
    for (const pair of cookieHeader.split(/;\s*/)) {
      const idx = pair.indexOf('=');
      if (idx === -1) continue;
      const name = pair.slice(0, idx);
      const value = pair.slice(idx + 1);
      if (name === COOKIE_NAME && isSupported(value)) return value;
    }
  }
  if (acceptLanguage) {
    const picked = pickFromAcceptLanguage(acceptLanguage);
    if (picked) return picked;
  }
  return routing.defaultLocale;
}
