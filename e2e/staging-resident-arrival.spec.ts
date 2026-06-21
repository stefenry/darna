import { test, expect } from '@playwright/test';

const BASE_URL = 'https://darnatips.app';
const RESIDENT_LOGIN_URL = process.env.RESIDENT_LOGIN_URL || '';

test.use({ baseURL: BASE_URL });

test('Resident accepté atterrit sur /community', async ({ page }) => {
  test.setTimeout(45_000);
  expect(RESIDENT_LOGIN_URL).toBeTruthy();

  await page.goto(RESIDENT_LOGIN_URL);
  await page.waitForLoadState('networkidle');
  expect(page.url()).toMatch(/\/fr\/community/);
});
