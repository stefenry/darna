import { test, expect } from '@playwright/test';

const BASE_URL = 'https://darnatips.app';

test.use({ baseURL: BASE_URL });

test('Trigger magic-link email for Stephane', async ({ page }) => {
  test.setTimeout(45_000);

  await page.goto('/fr/auth/login');
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="email"]').first().fill('henry.stephane@gmail.com');
  await page.getByRole('button', { name: /m'envoyer le lien/i }).click();

  await page.waitForLoadState('networkidle');
  // eslint-disable-next-line no-console
  console.log(`Landed on: ${page.url()}`);
  expect(page.url()).toContain('/auth/check-email');
});
