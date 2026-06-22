import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { routing } from './routing';
import type { Locale } from './config';

// Story 7.4 — persistance de la langue choisie. Le cookie `NEXT_LOCALE` est lu
// par le middleware next-intl (et par `detectLocale`) ; on l'écrit côté serveur
// (Server Action paramètres + callback login) pour que la préférence survive
// aux sessions et aux appareils. Mêmes options que le cookie next-intl par
// défaut (path '/', lax, ~1 an) pour éviter tout conflit d'écrasement.

export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function isLocale(value: string | null | undefined): value is Locale {
  return typeof value === 'string' && (routing.locales as readonly string[]).includes(value);
}

export async function setLocaleCookie(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE_NAME, locale, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

/**
 * Au login (nouvel appareil/navigateur), aligne le cookie `NEXT_LOCALE` sur la
 * langue mémorisée dans `profiles.language` et renvoie la locale effective à
 * utiliser pour la redirection. Best-effort : sur erreur DB on garde `fallback`.
 */
export async function applyLocaleFromProfile(
  supabase: SupabaseClient,
  userId: string,
  fallback: Locale,
): Promise<Locale> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('language')
      .eq('user_id', userId)
      .maybeSingle<{ language: string }>();
    if (isLocale(data?.language)) {
      await setLocaleCookie(data.language);
      return data.language;
    }
  } catch {
    // best-effort : ne jamais casser le flux de login pour une préférence d'UI
  }
  return fallback;
}
