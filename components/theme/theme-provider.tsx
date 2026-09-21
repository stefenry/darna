'use client';

// Refonte 2026-09 — thème clair / sombre. Par défaut on suit le réglage du
// téléphone ; le choix manuel (profil) est mémorisé par next-themes dans
// localStorage et posé en `data-theme` sur <html>, que lit app/globals.css.
// Le script anti-flash de next-themes est inline : la CSP l'autorise déjà.

import { useEffect, type ReactNode } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';

// Doit rester aligné sur --bg (app/globals.css) et app/layout.tsx.
const THEME_COLOR = { light: '#F3F5F2', dark: '#0B0D0E' } as const;

/** Les balises `theme-color` de app/layout.tsx suivent le SYSTÈME (attribut
 *  `media`). Si l'utilisateur force un thème, on aligne la barre d'état dessus. */
function ThemeColorSync() {
  const { theme, resolvedTheme } = useTheme();
  useEffect(() => {
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    metas.forEach((meta) => {
      const system = meta.media.includes('dark') ? THEME_COLOR.dark : THEME_COLOR.light;
      const forced = resolvedTheme === 'dark' ? THEME_COLOR.dark : THEME_COLOR.light;
      meta.content = theme === 'system' || !resolvedTheme ? system : forced;
    });
  }, [theme, resolvedTheme]);
  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
