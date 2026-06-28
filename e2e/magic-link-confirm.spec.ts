// QA E2E — Confirmation magic-link (Stories 1.6 / 1.7 / 1.9).
// Couvre le route handler /auth/confirm, point de doute n°2 de la rétro §3.1
// (« generateLink type:magiclink vs guard type!=='email' »).
//
// RAPPEL DU FLOW (cf. app/actions/auth-signin.ts + lib/auth/build-pkce-confirm-url.ts) :
//   generateLink({type:'magiclink'}) → properties.hashed_token
//   → l'app construit ELLE-MÊME /auth/confirm?token_hash=<hash>&type=email&next=…
//     (elle n'utilise PAS l'action_link Supabase legacy /auth/v1/verify)
//   → confirm route : guard `type!=='email'` → verifyOtp({type:'email', token_hash}).
//
// Tests "toujours actifs" (NON-write : le guard rejette AVANT tout appel DB) :
//   - paramètres manquants/incohérents → /auth/error?reason=invalid
//   - type=magiclink (≠ email attendu) → invalid (preuve que le guard mord)
//   - token_hash bidon mais type=email → verifyOtp échoue → /auth/expired (défaut)
//
// Test "gated" MAGIC_LINK_CONFIRM_URL (round-trip réel) : colle l'URL PKCE
// complète interceptée (e-mail reçu OU sortie de la sonde scratchpad) →
// doit poser une session et NE PAS atterrir sur /auth/error|/auth/expired.

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.CONSENT_BASE_URL ?? 'http://localhost:3000';
const FRESH_LOOKING_HASH = 'pkce_' + 'b'.repeat(56);

test.use({ baseURL: BASE_URL });

test.describe('Magic-link confirm — guard /auth/confirm (non-write)', () => {
  test('token_hash absent → /auth/error?reason=invalid', async ({ page }) => {
    await page.goto('/auth/confirm?type=email&next=/fr/admission');
    await expect(page).toHaveURL(/\/auth\/error\?reason=invalid/);
    await expect(page.getByRole('heading', { name: /n.est pas valide/i })).toBeVisible();
  });

  test('type=magiclink (≠ email) → /auth/error?reason=invalid (le guard mord)', async ({
    page,
  }) => {
    await page.goto(
      `/auth/confirm?token_hash=${FRESH_LOOKING_HASH}&type=magiclink&next=/fr/admission`,
    );
    await expect(page).toHaveURL(/\/auth\/error\?reason=invalid/);
  });

  test('type absent → /auth/error?reason=invalid', async ({ page }) => {
    await page.goto(`/auth/confirm?token_hash=${FRESH_LOOKING_HASH}&next=/fr/admission`);
    await expect(page).toHaveURL(/\/auth\/error\?reason=invalid/);
  });

  test('type=email + token_hash bidon → verifyOtp échoue → /auth/expired (défaut)', async ({
    page,
  }) => {
    await page.goto(`/auth/confirm?token_hash=${FRESH_LOOKING_HASH}&type=email&next=/fr/admission`);
    // Le guard passe (type=email) → verifyOtp est appelé → échoue → expired OU
    // error?reason=invalid|used selon le code Supabase. Jamais une session valide.
    await expect(page).toHaveURL(/\/auth\/(expired|error)/);
    await expect(page).not.toHaveURL(/\/admission/);
  });
});

test.describe('Magic-link confirm — round-trip réel (gated)', () => {
  const CONFIRM_URL = process.env.MAGIC_LINK_CONFIRM_URL;

  test('URL PKCE valide → session posée, pas d’écran d’erreur', async ({ page }) => {
    test.skip(
      !CONFIRM_URL,
      'MAGIC_LINK_CONFIRM_URL non fourni (URL /auth/confirm interceptée depuis l’e-mail ou la sonde).',
    );
    test.setTimeout(45_000);

    await page.goto(CONFIRM_URL!);
    await page.waitForLoadState('networkidle');
    // eslint-disable-next-line no-console
    console.log(`Landed on: ${page.url()}`);

    // Succès = redirigé vers une destination applicative (state-based), PAS error/expired.
    await expect(page).not.toHaveURL(/\/auth\/(error|expired)/);
    // Cookie de session Supabase posé.
    const cookies = await page.context().cookies();
    const hasAuthCookie = cookies.some((c) => /sb-.*-auth-token/.test(c.name));
    expect(hasAuthCookie, 'cookie de session sb-*-auth-token attendu').toBe(true);
  });
});
