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
  // eslint-disable-next-line no-console
  console.log(`Step 1: post-login URL = ${page.url()}`);

  // 2. Force navigation to comod queue (resolveRedirect bug ignores co_mod role)
  await page.goto('/fr/comod/admission');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/\/fr\/comod\/admission/);
  // eslint-disable-next-line no-console
  console.log('Step 2: on comod admission queue');

  // 3. Locate listitem villa=42 + click "Valider"
  await page.waitForSelector('text=Test Voisin', { timeout: 10_000 });
  const item = page.getByRole('listitem').filter({ hasText: 'Test Voisin' }).first();
  await expect(item).toBeVisible();
  // eslint-disable-next-line no-console
  console.log('Step 3: listitem Test Voisin visible');

  const acceptBtn = item.getByRole('button', { name: /valider/i });
  await acceptBtn.click();
  // eslint-disable-next-line no-console
  console.log('Step 4: clicked Valider');

  // 4. Wait until item disappears (validated)
  await expect(item).toBeHidden({ timeout: 10_000 });
  // eslint-disable-next-line no-console
  console.log('Step 5: item disappeared');
});
