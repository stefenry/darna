import type { MetadataRoute } from 'next';
import { defaultLocale } from '@/lib/i18n/config';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Darna — Communauté de résidence',
    short_name: 'Darna',
    description:
      "Plateforme communautaire de la résidence Darna : annuaire d'artisans, alertes, guide.",
    // `/` ne répond QU'EN 307 vers `/${defaultLocale}` (next-intl,
    // localePrefix: 'always') : une redirection n'est jamais mise en cache par
    // le Service Worker. Hors-ligne, lancer la PWA sur `/` tombait donc
    // systématiquement sur la page de repli « Aucune connexion détectée », même
    // avec `/fr` en cache. On pointe start_url sur l'URL réellement servie et
    // cachée. `scope` reste `/` pour couvrir les deux locales.
    start_url: `/${defaultLocale}`,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#5B9C66',
    background_color: '#FBFAF6',
    lang: 'fr',
    dir: 'ltr',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/favicon.ico',
        sizes: '32x32',
        type: 'image/x-icon',
      },
    ],
  };
}
