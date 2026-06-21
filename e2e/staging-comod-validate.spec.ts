import { test, expect } from '@playwright/test';

const BASE_URL = 'https://darnatips.app';
const COMOD_LOGIN_URL = process.env.COMOD_LOGIN_URL || '';

test.use({ baseURL: BASE_URL });

test('Co_mod valide la demande villa 42', async ({ page }) => {
  test.setTimeout(60_000);
  expect(COMOD_LOGIN_URL).toBeTruthy();

  // 1. Login via magic-link PKCE
  await page.goto(COMOD_LOGIN_URL);
  await page.waitForLoadState('networkidle');
  console.log(`Step 1: post-login URL = ${page.url()}`);

  // 2. Force navigation to comod queue (resolveRedirect bug ignores co_mod role)
  await page.goto('/fr/comod/admission');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/fr\/comod\/admission/);
  console.log('Step 2: on comod admission queue');

  // 3. Locate row villa=42 + click "Valider"
  // Wait for queue items to render
  await page.waitForSelector('text=Test Voisin', { timeout: 10_000 });
  const row = page.locator('tr', { hasText: 'Test Voisin' }).first();
  await expect(row).toBeVisible();
  console.log('Step 3: row Test Voisin visible');

  const acceptBtn = row.getByRole('button', { name: /valider/i });
  await acceptBtn.click();
  console.log('Step 4: clicked Valider');

  // 4. Wait until row disappears (validated)
  await expect(row).toBeHidden({ timeout: 10_000 });
  console.log('Step 5: row disappeared');
});
