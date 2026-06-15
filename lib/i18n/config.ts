export const locales = ['fr', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'fr';

// MVP FR-only: seul le français est exposé dans la navigation.
// V1.5 activera 'ar'. Le code de routing/middleware est déjà prêt.
export const ACTIVE_LOCALES: readonly Locale[] = ['fr'];

export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
