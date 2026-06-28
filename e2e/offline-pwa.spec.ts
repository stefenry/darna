// QA E2E — Offline / Service Worker / fallback (Story 7.3).
// Trou n°2 de la rétro globale 2026-06-26 : seul tests/offline/sw-matchers.test.ts
// (unit, prédicats purs) existe ; aucun E2E n'a jamais vérifié le SW au runtime.
//
// ⚠️ PRÉREQUIS — le Service Worker Serwist ne tourne PAS en dev Turbopack.
// Ces tests N'ONT DE SENS que contre un build prod servi ou un environnement
// staging. Ils sont donc gated derrière OFFLINE_BASE_URL :
//
//   pnpm build && pnpm start          # terminal 1 (génère + sert le SW)
//   OFFLINE_BASE_URL=http://localhost:3000 pnpm e2e offline-pwa.spec.ts
//
//   # ou contre staging :
//   OFFLINE_BASE_URL=https://darna-staging.vercel.app pnpm e2e offline-pwa.spec.ts
//
// Sans OFFLINE_BASE_URL, toute la suite est skip (évite des faux échecs en dev).

import { test, expect } from '@playwright/test';

const OFFLINE_BASE_URL = process.env.OFFLINE_BASE_URL;
// Parcours résident authentifié (optionnel) : URL magic-link à usage unique,
// même convention que keyboard-navigation.spec.ts.
const RESIDENT_LOGIN_URL = process.env.RESIDENT_LOGIN_URL;

// Attend que le SW soit prêt ET contrôle la page (clientsClaim). Race avec un
// timeout pour ne pas bloquer 30s si le SW est absent.
async function waitForServiceWorker(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const ready = navigator.serviceWorker.ready.then(() => true);
    const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10_000));
    const ok = await Promise.race([ready, timeout]);
    // clientsClaim peut prendre un tick après "ready".
    if (ok && !navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        });
        setTimeout(resolve, 3_000);
      });
    }
    return ok;
  });
}

test.describe('PWA offline (Story 7.3) — gated OFFLINE_BASE_URL', () => {
  test.skip(
    !OFFLINE_BASE_URL,
    'OFFLINE_BASE_URL non fourni (requiert un build prod servi : pnpm build && pnpm start, ou staging).',
  );
  test.use({ baseURL: OFFLINE_BASE_URL });

  test('le Service Worker s’enregistre et prend le contrôle', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('/fr');
    const swReady = await waitForServiceWorker(page);
    expect(swReady, 'navigator.serviceWorker.ready doit résoudre').toBe(true);
  });

  test('navigation hors-ligne non cachée → page de repli /offline', async ({ page, context }) => {
    test.setTimeout(30_000);
    // 1. Visite en ligne pour enregistrer + activer le SW (précache du shell offline).
    await page.goto('/fr');
    const swReady = await waitForServiceWorker(page);
    expect(swReady).toBe(true);

    // 2. Coupe le réseau, puis navigue vers une URL jamais visitée.
    await context.setOffline(true);
    await page
      .goto('/fr/community/guide/page-jamais-visitee-xyz', {
        waitUntil: 'commit',
      })
      .catch(() => {
        /* la navigation document échoue → le SW sert le fallback */
      });

    // 3. Le SW doit servir le shell offline précaché (fallback document).
    await expect(page.getByText(/aucune connexion d.tect/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /r.essayer/i })).toBeVisible();

    await context.setOffline(false);
  });

  test('surface token /consent jamais mise en cache (NetworkOnly bypass)', async ({
    page,
    context,
  }) => {
    test.setTimeout(30_000);
    // 1. En ligne : visite une page consent (token invalide → rendu "Lien invalide").
    await page.goto('/consent/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    await waitForServiceWorker(page);
    await expect(page.getByRole('heading', { name: /lien invalide ou expir/i })).toBeVisible();

    // 2. Hors-ligne : un reload NE DOIT PAS resservir le HTML token depuis le cache.
    //    Comme /consent est en NetworkOnly, la navigation document échoue offline
    //    → le SW bascule sur le shell offline (preuve : pas de fuite du HTML token).
    await context.setOffline(true);
    await page.reload({ waitUntil: 'commit' }).catch(() => {
      /* navigation échoue offline (NetworkOnly, pas de cache) */
    });

    await expect(page.getByText(/aucune connexion d.tect/i)).toBeVisible({ timeout: 10_000 });
    // Le titre "Lien invalide" (HTML token) ne doit PAS avoir été servi du cache.
    await expect(page.getByRole('heading', { name: /lien invalide ou expir/i })).toHaveCount(0);

    await context.setOffline(false);
  });

  test('contenu durable lisible hors-ligne — parcours résident (gated RESIDENT_LOGIN_URL)', async ({
    page,
    context,
  }) => {
    test.skip(!RESIDENT_LOGIN_URL, 'RESIDENT_LOGIN_URL non fourni.');
    test.setTimeout(45_000);

    // 1. Connexion résident via magic-link à usage unique.
    await page.goto(RESIDENT_LOGIN_URL!);
    await page.waitForLoadState('networkidle');

    // 2. Visite le guide EN LIGNE pour réchauffer le cache StaleWhileRevalidate.
    await page.goto('/fr/community/guide');
    await page.waitForLoadState('networkidle');
    await waitForServiceWorker(page);
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
    const onlineTitle = (await heading.textContent())?.trim() ?? '';
    // eslint-disable-next-line no-console
    console.log(`Guide online heading: ${onlineTitle}`);

    // 3. Hors-ligne : reload → le contenu durable reste lisible (AC5 < 100ms),
    //    PAS la page de repli offline.
    await context.setOffline(true);
    await page.reload({ waitUntil: 'commit' }).catch(() => {});
    await expect(page.getByText(/aucune connexion d.tect/i)).toHaveCount(0);
    await expect(page.getByRole('heading').first()).toBeVisible();

    await context.setOffline(false);
  });
});
