// @vitest-environment node
//
// Régression prod 2026-08-05 — l'app ne fonctionnait PAS hors-ligne.
//
// Chaîne de causalité : `swe-worker-<hash>.js` (le Web Worker de
// `cacheOnNavigation`, généré par @serwist/next dans `public/`) n'était pas
// exclu du matcher du proxy. Avec `localePrefix: 'always'`, next-intl
// redirigeait donc `/swe-worker-<hash>.js` en 307 vers
// `/fr/swe-worker-<hash>.js` → 404. Or Serwist inscrit ce fichier dans le
// manifeste de précache du Service Worker : `install` fait un `cache.addAll()`
// qui échoue sur ce 404, donc le SW ne s'ACTIVE JAMAIS
// (`navigator.serviceWorker.ready` ne résout pas, `controller === null`).
// Résultat : zéro runtime cache, zéro page de repli — offline totalement mort.
//
// Ce test verrouille le contrat : tout asset du Service Worker servi depuis
// `public/` doit contourner le proxy.
import { describe, expect, it, vi } from 'vitest';

// Même stratégie que tests/auth/proxy-session.test.ts : next-intl/middleware ne
// se résout pas hors runtime Next. On ne teste ici que `config.matcher`.
vi.mock('next-intl/middleware', () => ({ default: () => () => undefined }));

vi.mock('@/lib/env', () => ({
  env: {
    client: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://abcdef.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      NEXT_PUBLIC_SITE_URL: 'https://darna.test',
    },
  },
}));

const { config } = await import('@/proxy');

const matcherSource = (config.matcher as { source: string }[])[0]?.source;

function proxyMatches(pathname: string): boolean {
  if (!matcherSource) throw new Error('config.matcher[0].source introuvable dans proxy.ts');
  // Next ancre le pattern du matcher ; on reproduit cet ancrage.
  return new RegExp(`^${matcherSource}$`).test(pathname);
}

describe('proxy matcher — assets du Service Worker (régression offline 2026-08-05)', () => {
  it('laisse passer /sw.js sans réécriture de locale', () => {
    expect(proxyMatches('/sw.js')).toBe(false);
  });

  it('laisse passer le Web Worker swe-worker-<hash>.js sans réécriture de locale', () => {
    // Le hash vient du contenu de la source Serwist : il change avec la version
    // du paquet, donc le matcher doit exclure le PRÉFIXE, pas un nom figé.
    expect(proxyMatches('/swe-worker-f61931bc2770d10b.js')).toBe(false);
    expect(proxyMatches('/swe-worker-0000000000000000.js')).toBe(false);
  });

  it('laisse passer la source map du SW', () => {
    expect(proxyMatches('/sw.js.map')).toBe(false);
  });

  it("n'élargit pas l'exclusion aux routes applicatives", () => {
    // Garde anti-régression : l'exclusion doit rester chirurgicale.
    expect(proxyMatches('/fr/community/guide')).toBe(true);
    expect(proxyMatches('/fr')).toBe(true);
    expect(proxyMatches('/swe-worker')).toBe(true);
  });
});
