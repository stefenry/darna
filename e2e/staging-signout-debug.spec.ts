import { test, expect } from '@playwright/test';

const BASE_URL = 'https://darnatips.app';
const COMOD_LOGIN_URL = process.env.COMOD_LOGIN_URL || '';

test.use({ baseURL: BASE_URL });

test('Signout button click debug', async ({ page }) => {
  test.setTimeout(60_000);
  expect(COMOD_LOGIN_URL).toBeTruthy();

  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('requestfailed', (r) => {
    failedRequests.push(`${r.method()} ${r.url()} - ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => {
    if (r.url().includes('/auth/signout')) {
      // eslint-disable-next-line no-console
      console.log(`[response] ${r.status()} ${r.url()} → location: ${r.headers()['location']}`);
    }
  });

  await page.goto(COMOD_LOGIN_URL);
  await page.waitForLoadState('networkidle');

  await page.goto('/fr/community/profil');
  await page.waitForLoadState('networkidle');
  // eslint-disable-next-line no-console
  console.log(`After profil: ${page.url()}`);

  // Try clicking the local signout button
  const localBtn = page.getByRole('button', { name: /signout|déconnecter/i }).first();
  await expect(localBtn).toBeVisible({ timeout: 10_000 });
  // eslint-disable-next-line no-console
  console.log('Signout button visible');

  await localBtn.click();
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  // eslint-disable-next-line no-console
  console.log(`After click: ${page.url()}`);

  // eslint-disable-next-line no-console
  console.log('Console errors:', consoleErrors);
  // eslint-disable-next-line no-console
  console.log('Failed reqs:', failedRequests);
});
