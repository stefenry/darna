// QA E2E — Webhook droit de réponse artisan (Story 2.8).
// Surface symétrique à /consent : page /respond/[token] → POST
// /api/webhook/artisan-respond → PRG /respond/done. Second volet du trou
// « webhooks consent/respond » de la rétro globale 2026-06-26 (§3.1), couvert
// en unit (consent-respond-rpc, consent/lookup-response) mais jamais en E2E.
//
// Différences notables avec le webhook consent :
//   - champ `kind` (response | rectification), pas `decision`.
//   - token inexistant → 303 redirect /respond/done?status=invalid (AR38,
//     indistinguable de expired/used), PAS un 401.
//
// Tests "toujours actifs" uniquement : rendu page (token invalide, toggle FR/AR)
// + gardes du webhook (CSRF, body, token bien formé inexistant). Aucun seed DB.
// Le round-trip complet (soumission réponse/rectification) nécessite un token
// valide à usage unique — non couvert ici (mêmes contraintes que consent).

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.CONSENT_BASE_URL ?? 'http://localhost:3000';
const WEBHOOK_PATH = '/api/webhook/artisan-respond';
const WELL_FORMED_UNKNOWN_TOKEN = 'a'.repeat(40);

test.use({ baseURL: BASE_URL });

test.describe('Droit de réponse — rendu page /respond/[token]', () => {
  test('token invalide → écran "Lien invalide", aucun formulaire, noindex', async ({ page }) => {
    await page.goto(`/respond/${WELL_FORMED_UNKNOWN_TOKEN}`);

    await expect(page.getByRole('heading', { name: /lien invalide/i })).toBeVisible();
    // Pas de zone de saisie de réponse sur un token invalide.
    await expect(page.locator('textarea[name="response_text"]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
  });

  test('toggle de langue ?lang=ar bascule le document en RTL', async ({ page }) => {
    await page.goto(`/respond/${WELL_FORMED_UNKNOWN_TOKEN}?lang=fr`);
    await expect(page.locator('main')).toHaveAttribute('dir', 'ltr');

    await page.goto(`/respond/${WELL_FORMED_UNKNOWN_TOKEN}?lang=ar`);
    await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
  });
});

test.describe('Droit de réponse — gardes du webhook POST', () => {
  test('POST cross-origin → 403 (CSRF P6)', async ({ request }) => {
    const res = await request.post(`${BASE_URL}${WEBHOOK_PATH}`, {
      headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
      form: { token: WELL_FORMED_UNKNOWN_TOKEN, kind: 'response', response_text: 'hello' },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(403);
  });

  test('POST same-origin sans kind → 400 (P19)', async ({ request }) => {
    const res = await request.post(`${BASE_URL}${WEBHOOK_PATH}`, {
      headers: { origin: BASE_URL, 'sec-fetch-site': 'same-origin' },
      form: { token: WELL_FORMED_UNKNOWN_TOKEN },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(400);
  });

  test('POST kind invalide → 400', async ({ request }) => {
    const res = await request.post(`${BASE_URL}${WEBHOOK_PATH}`, {
      headers: { origin: BASE_URL, 'sec-fetch-site': 'same-origin' },
      form: { token: WELL_FORMED_UNKNOWN_TOKEN, kind: 'whatever' },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(400);
  });

  test('POST kind=response sans response_text → 400', async ({ request }) => {
    const res = await request.post(`${BASE_URL}${WEBHOOK_PATH}`, {
      headers: { origin: BASE_URL, 'sec-fetch-site': 'same-origin' },
      form: { token: WELL_FORMED_UNKNOWN_TOKEN, kind: 'response', response_text: '' },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(400);
  });

  test('token bien formé inexistant → 303 /respond/done?status=invalid (AR38)', async ({
    request,
  }) => {
    const res = await request.post(`${BASE_URL}${WEBHOOK_PATH}`, {
      headers: { origin: BASE_URL, 'sec-fetch-site': 'same-origin' },
      form: { token: WELL_FORMED_UNKNOWN_TOKEN, kind: 'response', response_text: 'bonjour' },
      maxRedirects: 0,
    });
    // 303 attendu (redirect générique invalide) ; 429 toléré si rate-limit token saturé.
    expect([303, 429]).toContain(res.status());
    if (res.status() === 303) {
      expect(res.headers()['location']).toContain('/respond/done');
      expect(res.headers()['location']).toContain('status=invalid');
    }
  });
});
