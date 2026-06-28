// QA E2E — Webhook consentement artisan (Stories 2.4 / 2.5 / 2.8).
// Couvre le parcours magic-link 1-tap accept/refuse (page /consent/[token] →
// POST /api/webhook/sms-consent → PRG /consent/done). Trou n°1 de la rétro
// globale 2026-06-26 : couvert en unit (consent-rpc, consent-respond-rpc) mais
// jamais en E2E réel.
//
// Deux niveaux :
//   1. Tests "toujours actifs" : ne nécessitent AUCUN seed DB. Ils valident le
//      rendu des états invalide/expiré, le toggle FR/AR, et les gardes du
//      webhook (CSRF, body malformé, token bien formé mais inexistant → 401).
//   2. Tests "gated" : round-trip complet accept/refuse. Nécessitent une URL de
//      consentement fraîche à usage unique (token valide en DB), passée via
//      CONSENT_ACCEPT_URL / CONSENT_REFUSE_URL. Skip sinon.
//
// Pour minter une URL valide (à exécuter contre le même backend que CONSENT_BASE_URL) :
//   1. Seed un artisan `pending` avec un consent_token via la RPC de création
//      (cf. lib/consent/token.ts → generateConsentToken + insert consent_tokens),
//      ou récupère le lien SMS loggé en staging (SMS_PROVIDER=log).
//   2. export CONSENT_ACCEPT_URL="https://<base>/consent/<raw-token>"
//   Le token étant à usage unique, re-minter pour chaque run.

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.CONSENT_BASE_URL ?? 'http://localhost:3000';
const WEBHOOK_PATH = '/api/webhook/sms-consent';
// Token bien formé (≥16, ≤200 chars) mais qui n'existe pas en DB → la RPC
// `process_artisan_consent` renvoie `not_found` → 401 générique (AR38).
const WELL_FORMED_UNKNOWN_TOKEN = 'a'.repeat(40);

test.use({ baseURL: BASE_URL });

test.describe('Consentement artisan — rendu page /consent/[token]', () => {
  test('token invalide → écran "Lien invalide", aucun bouton, noindex', async ({ page }) => {
    await page.goto(`/consent/${WELL_FORMED_UNKNOWN_TOKEN}`);

    await expect(page.getByRole('heading', { name: /lien invalide ou expir/i })).toBeVisible();
    // Aucun bouton de décision ne doit s'afficher sur un token invalide.
    await expect(page.getByRole('button', { name: /accepte/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /refuse/i })).toHaveCount(0);
    // La surface token ne doit jamais être indexée (P12 / robots noindex).
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
  });

  test('toggle de langue ?lang=ar bascule le document en RTL', async ({ page }) => {
    await page.goto(`/consent/${WELL_FORMED_UNKNOWN_TOKEN}?lang=fr`);
    await expect(page.locator('main')).toHaveAttribute('dir', 'ltr');

    await page.goto(`/consent/${WELL_FORMED_UNKNOWN_TOKEN}?lang=ar`);
    await expect(page.locator('main')).toHaveAttribute('dir', 'rtl');
  });
});

test.describe('Consentement artisan — gardes du webhook POST', () => {
  test('POST cross-origin → 403 (CSRF P6)', async ({ request }) => {
    const res = await request.post(`${BASE_URL}${WEBHOOK_PATH}`, {
      headers: {
        origin: 'https://evil.example',
        'sec-fetch-site': 'cross-site',
      },
      form: { token: WELL_FORMED_UNKNOWN_TOKEN, decision: 'accept' },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(403);
  });

  test('POST same-origin sans decision → 400 (P19)', async ({ request }) => {
    const res = await request.post(`${BASE_URL}${WEBHOOK_PATH}`, {
      headers: { origin: BASE_URL, 'sec-fetch-site': 'same-origin' },
      form: { token: WELL_FORMED_UNKNOWN_TOKEN },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(400);
  });

  test('POST decision invalide → 400', async ({ request }) => {
    const res = await request.post(`${BASE_URL}${WEBHOOK_PATH}`, {
      headers: { origin: BASE_URL, 'sec-fetch-site': 'same-origin' },
      form: { token: WELL_FORMED_UNKNOWN_TOKEN, decision: 'maybe' },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(400);
  });

  test('token bien formé mais inexistant → 401 générique (AR38)', async ({ request }) => {
    const res = await request.post(`${BASE_URL}${WEBHOOK_PATH}`, {
      headers: { origin: BASE_URL, 'sec-fetch-site': 'same-origin' },
      form: { token: WELL_FORMED_UNKNOWN_TOKEN, decision: 'accept' },
      maxRedirects: 0,
    });
    // 401 attendu ; 429 toléré si le rate-limit par token_hash a déjà saturé.
    expect([401, 429]).toContain(res.status());
  });
});

test.describe('Consentement artisan — round-trip complet (gated)', () => {
  const ACCEPT_URL = process.env.CONSENT_ACCEPT_URL;
  const REFUSE_URL = process.env.CONSENT_REFUSE_URL;

  test('J’accepte → /consent/done?status=accepted', async ({ page }) => {
    test.skip(!ACCEPT_URL, 'CONSENT_ACCEPT_URL non fourni (token valide à usage unique).');
    test.setTimeout(45_000);

    await page.goto(ACCEPT_URL!);
    await page.getByRole('button', { name: /accepte/i }).click();
    await page.waitForLoadState('networkidle');

    // eslint-disable-next-line no-console
    console.log(`Landed on: ${page.url()}`);
    expect(page.url()).toContain('/consent/done');
    expect(page.url()).toContain('status=accepted');
    await expect(page.getByRole('heading', { name: /votre fiche est en ligne/i })).toBeVisible();
  });

  test('Je refuse → /consent/done?status=refused', async ({ page }) => {
    test.skip(!REFUSE_URL, 'CONSENT_REFUSE_URL non fourni (token valide à usage unique).');
    test.setTimeout(45_000);

    await page.goto(REFUSE_URL!);
    await page.getByRole('button', { name: /refuse/i }).click();
    await page.waitForLoadState('networkidle');

    // eslint-disable-next-line no-console
    console.log(`Landed on: ${page.url()}`);
    expect(page.url()).toContain('/consent/done');
    expect(page.url()).toContain('status=refused');
    await expect(page.getByRole('heading', { name: /votre choix est enregistr/i })).toBeVisible();
  });
});
