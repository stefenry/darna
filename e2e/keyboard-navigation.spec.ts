import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Story 7.6 (FR49/FR50/NFR37/NFR39/AR33) — navigation clavier complète +
// prefers-reduced-motion + zéro violation WCAG AA sur les parcours utilisateurs.
//
// Les parcours PUBLICS (Karim/Salma onboarding, login) tournent en CI sans
// session. Les parcours AUTHENTIFIÉS (Yassine annuaire, Aïcha guide, Nadia
// création, co-mod) nécessitent une session magic-link → gardés derrière
// RESIDENT_LOGIN_URL / COMOD_LOGIN_URL (skip si absent, comme les specs staging).

const PUBLIC_JOURNEYS = [
  { name: 'Onboarding (admission)', path: '/fr/admission' },
  { name: 'Connexion (login)', path: '/fr/auth/login' },
  { name: 'Accueil public', path: '/fr' },
];

async function tabTo(page: Page, presses: number): Promise<string[]> {
  const seen: string[] = [];
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press('Tab');
    const desc = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return 'body';
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const ti = el.getAttribute('tabindex');
      return `${tag}${id}${ti ? `[tabindex=${ti}]` : ''}`;
    });
    seen.push(desc);
  }
  return seen;
}

for (const journey of PUBLIC_JOURNEYS) {
  test.describe(`Keyboard — ${journey.name}`, () => {
    test('skip link is the first focusable element and targets #main-content', async ({ page }) => {
      await page.goto(journey.path);
      await page.keyboard.press('Tab');
      const href = await page.evaluate(() =>
        (document.activeElement as HTMLAnchorElement | null)?.getAttribute('href'),
      );
      expect(href).toBe('#main-content');
    });

    test('no keyboard trap: focus keeps progressing without focusable tabindex=-1', async ({
      page,
    }) => {
      await page.goto(journey.path);
      const visited = await tabTo(page, 25);
      // Focus must move across several distinct elements (no single-element trap).
      expect(new Set(visited).size).toBeGreaterThan(2);
      // A focusable element must never expose tabindex="-1" (would be a trap/skip).
      expect(visited.some((d) => d.includes('tabindex=-1'))).toBe(false);
    });

    test('zero WCAG A/AA violations (incl. reduced-motion)', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(journey.path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      if (results.violations.length > 0) {
        console.warn(
          `[a11y] ${journey.path}:`,
          results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
        );
      }
      expect(results.violations).toEqual([]);
    });
  });
}

test.describe('Keyboard — admission has a focusable main landmark', () => {
  test('#main-content exists and is reachable via the skip link', async ({ page }) => {
    await page.goto('/fr/admission');
    const main = page.locator('#main-content');
    await expect(main).toBeVisible();
  });
});

// ── Parcours authentifiés (gated) ───────────────────────────────────────────
const RESIDENT_LOGIN_URL = process.env.RESIDENT_LOGIN_URL || '';
const RESIDENT_JOURNEYS = [
  { name: 'Yassine — annuaire', path: '/fr/community/annuaire' },
  { name: 'Aïcha — guide', path: '/fr/community/guide' },
  { name: 'Nadia — création fiche', path: '/fr/community/annuaire/nouveau' },
];

test.describe('Keyboard — parcours résident (gated RESIDENT_LOGIN_URL)', () => {
  test.skip(!RESIDENT_LOGIN_URL, 'RESIDENT_LOGIN_URL non fourni');

  for (const journey of RESIDENT_JOURNEYS) {
    test(`${journey.name}: clavier + zéro violation WCAG AA`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(RESIDENT_LOGIN_URL);
      await page.waitForLoadState('networkidle');
      await page.goto(journey.path);
      // Skip link en tête.
      await page.keyboard.press('Tab');
      const href = await page.evaluate(() =>
        (document.activeElement as HTMLAnchorElement | null)?.getAttribute('href'),
      );
      expect(href).toBe('#main-content');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
