import { notFound } from 'next/navigation';
import { routing } from '@/lib/i18n/routing';
import type { Locale } from '@/lib/i18n/config';

/**
 * Garde-fou standard des pages `[locale]` : 404 si le segment n'est pas une
 * locale supportée. Extrait (2026-07-23) du boilerplate dupliqué dans chaque
 * page — les pages existantes migrent au fil de l'eau.
 */
export function assertLocale(locale: string): asserts locale is Locale {
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
}
