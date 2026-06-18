import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Story 1.10c (AR33) — Scan a11y axe (WCAG A + AA) des pages PUBLIQUES existantes
// (epic 1). Les pages authentifiées (profil / comod) nécessitent une session →
// couvertes quand le wiring magic-link mock e2e arrivera (V1.5).
//
// Au MVP, le job CI `a11y` est `continue-on-error: true` (warning, pas bloquant) ;
// il deviendra bloquant avant la bêta (architecture.md:1527-1528). Localement,
// `pnpm e2e` échoue si une violation existe — c'est informatif.
const PUBLIC_PAGES = [
  '/fr',
  '/fr/admission',
  '/fr/auth/login',
  '/fr/manifesto',
  '/fr/transparence',
];

for (const path of PUBLIC_PAGES) {
  test(`a11y WCAG A/AA — ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

    if (results.violations.length > 0) {
      // Trace lisible des violations pour le rapport CI.
      const summary = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
      }));
      console.warn(`[a11y] ${path} — ${results.violations.length} violation(s):`, summary);
    }

    expect(results.violations).toEqual([]);
  });
}
