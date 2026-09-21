import type { Metadata, Viewport } from 'next';
import './globals.css';

// Story 2.5 review P8 — la page `/consent/[token]` est HORS `[locale]` et n'hérite
// donc pas du `<html>/<body>` posé par `app/[locale]/layout.tsx`. Idéalement le
// root devrait poser ces tags, mais `[locale]/layout.tsx` les pose déjà pour
// driver le `lang={locale} dir={dir}` dynamique — déplacer ici demande un
// refactor (lang dynamique via cookie/header) hors-scope. Next 15+ avertit mais
// rend la page consent fonctionnellement. Différé en deferred-work.md.

const defaultUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: 'Darna',
  description: 'PWA communautaire pour résidence — par les résidents, pour les résidents.',
};

// Barre d'état du navigateur / de la PWA : suit le thème clair ou sombre.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F3F5F2' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0D0E' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
