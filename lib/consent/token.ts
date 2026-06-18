// Story 2.4 (AC2/AC7) — tokens de consentement artisan, HMAC. Le secret est
// passé en paramètre (découplé de l'env → testable sans process.env). Le `raw`
// ne vit que dans l'URL du SMS ; seul le `hash` est stocké (artisan_consent_tokens).
// La validation (re-HMAC timing-safe) sert la page/webhook de consentement (2.5).

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function generateConsentToken(secret: string): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashConsentToken(raw, secret) };
}

export function hashConsentToken(raw: string, secret: string): string {
  return createHmac('sha256', secret).update(raw).digest('hex');
}

/** Comparaison timing-safe de deux hash hex (anti timing-attack, AR38). */
export function consentHashEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
