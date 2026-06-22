import { test, expect } from '@playwright/test';

const BASE_URL = 'https://darnatips.app';
const COMOD_LOGIN_URL = process.env.COMOD_LOGIN_URL || '';

test.use({ baseURL: BASE_URL });

test('Capture pack-accueil/nouveau errors', async ({ page }) => {
  test.setTimeout(60_000);
  expect(COMOD_LOGIN_URL).toBeTruthy();

  // Collect all console messages + network errors
  const consoleMsgs: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (msg) => {
    consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    pageErrors.push(`[pageerror] ${err.message}\n${err.stack ?? ''}`);
  });
  page.on('requestfailed', (req) => {
    failedRequests.push(`[failed] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      failedRequests.push(`[${resp.status()}] ${resp.request().method()} ${resp.url()}`);
    }
  });

  // Login as co_mod
  await page.goto(COMOD_LOGIN_URL);
  await page.waitForLoadState('networkidle');

  // Navigate to pack-accueil/nouveau
  await page.goto('/fr/comod/admin/pack-accueil/nouveau');
  await page.waitForLoadState('networkidle');

  // eslint-disable-next-line no-console
  console.log('\n=== FINAL URL ===');
  // eslint-disable-next-line no-console
  console.log(page.url());

  // eslint-disable-next-line no-console
  console.log('\n=== CONSOLE MESSAGES ===');
  // eslint-disable-next-line no-console
  consoleMsgs.forEach((m) => console.log(m));

  // eslint-disable-next-line no-console
  console.log('\n=== PAGE ERRORS ===');
  // eslint-disable-next-line no-console
  pageErrors.forEach((e) => console.log(e));

  // eslint-disable-next-line no-console
  console.log('\n=== FAILED REQUESTS ===');
  // eslint-disable-next-line no-console
  failedRequests.forEach((r) => console.log(r));

  // eslint-disable-next-line no-console
  console.log('\n=== BODY TEXT (first 500 chars) ===');
  const body = await page
    .locator('body')
    .innerText()
    .catch(() => '');
  // eslint-disable-next-line no-console
  console.log(body.slice(0, 500));
});
