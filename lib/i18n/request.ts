import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

type Messages = Record<string, unknown>;

function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const key of Object.keys(override)) {
    const a = out[key];
    const b = override[key];
    if (
      a &&
      typeof a === 'object' &&
      !Array.isArray(a) &&
      b &&
      typeof b === 'object' &&
      !Array.isArray(b)
    ) {
      out[key] = deepMerge(a as Messages, b as Messages);
    } else if (typeof b === 'string' && b.length === 0 && key in out) {
      // Locale message file shipped an empty stub — keep the base (fallback locale) value.
    } else {
      out[key] = b;
    }
  }
  return out;
}

async function loadMessages(locale: string): Promise<Messages | null> {
  try {
    const mod = await import(`@/messages/${locale}.json`);
    return mod.default as Messages;
  } catch {
    return null;
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  const fallback = (await loadMessages(routing.defaultLocale)) ?? {};
  const requested = locale === routing.defaultLocale ? null : await loadMessages(locale);

  const messages = requested ? deepMerge(fallback, requested) : fallback;

  return {
    locale,
    messages,
  };
});
