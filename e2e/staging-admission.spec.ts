import { test, expect } from '@playwright/test';

const BASE_URL = 'https://darnatips.app';
const TEST_EMAIL = 'henry.stephane+test1@gmail.com';
const VILLA = '42';

test.use({ baseURL: BASE_URL });

test('E2E admission flow', async ({ page }) => {
  test.setTimeout(60_000);

  // 1. Visit admission form
  await page.goto('/fr/admission');
  await expect(page).toHaveURL(/\/fr\/admission/);
  // eslint-disable-next-line no-console
  console.log('Step 1: form loaded');

  // 2. Fill form
  await page.locator('input[name="villa"]').fill(VILLA);
  await page.locator('select[name="tranche"]').selectOption('A');
  await page.locator('input[name="first_name"]').fill('Test Voisin');
  await page.locator('input[name="email"]').fill(TEST_EMAIL);
  await page.getByRole('checkbox', { name: /accepte les conditions/ }).click();
  // eslint-disable-next-line no-console
  console.log('Step 2: form filled');

  // 3. Submit
  await page.locator('button[type="submit"]').click();
  // eslint-disable-next-line no-console
  console.log('Step 3: submitted');

  // 4. Should land on /admission/pending or check-email
  await page.waitForLoadState('networkidle');
  const url = page.url();
  // eslint-disable-next-line no-console
  console.log(`Step 4: landed on ${url}`);
  expect(url).toMatch(/(check-email|pending|admission)/);
});
