# 0005 — Rate-limiting : Upstash Redis (sliding window, fail-open)

## Context

Deux endpoints publics sont coûteux et abusables : la soumission d'admission
(`submitAdmissionRequest` → `generateLink` + e-mails) et l'envoi de magic-link
(`signInMagicLink`). Sans limite, un attaquant peut mail-bomber une victime ou brûler le quota
Brevo (300/jour). Reviews 1.6/1.7 ont explicitement déféré la mitigation ici.

## Decision

Utiliser **Upstash Redis EU (Frankfurt, free tier)** via `@upstash/ratelimit` (sliding window),
encapsulé dans `lib/rate-limit.ts` (`checkLimit(key, limit, windowSeconds)` + helper
`tooManyRequests` → 429 `Retry-After`). Limites (AR31) :

- `POST /admission` : **5 / jour / IP**.
- magic-link : **3 / 15 min / e-mail**.
- (webhook `sms-consent` : 100/min/IP — différé epic 2.4, le webhook n'existe pas encore.)

**Fail-open obligatoire** : si Upstash est injoignable, `checkLimit` retourne `success:true` +
log `rate_limit.degraded`. Un Redis down ne doit JAMAIS bloquer l'authentification.

## Consequences

- ✅ Mitigation mail-bombing / quota Brevo ; anti-énumération préservée (magic-link : redirect
  check-email même quand limité, sans envoi).
- ✅ Fail-open → aucune dépendance dure à Upstash pour la disponibilité de l'auth.
- ⚠️ La vérification live (vrai compteur Upstash) nécessite une instance provisionnée (déférée
  pré-bêta) ; le code et les tests (mock) sont en place.

## Status

Accepted — Gap #2. Implémenté story 1.10b.
