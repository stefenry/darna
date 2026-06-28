# Test Automation Summary — Consentement artisan & Offline PWA

**Date :** 2026-06-28 · **Auteur :** QA automation (Amelia) · **Demandeur :** Stephane
**Cible :** combler les 2 trous E2E nommés par la rétro globale 2026-06-26 (§3.1)
**Framework :** Playwright (`@playwright/test` ^1.60), 3 projets (chromium / webkit-iPhone15 / firefox)

---

## Tests générés

### E2E — Webhook consentement artisan (Stories 2.4 / 2.5 / 2.8)

`e2e/consent-artisan.spec.ts` — **8 tests × 3 projets**

Toujours actifs (aucun seed DB requis) :

- [x] Token invalide → écran « Lien invalide », aucun bouton de décision, `<meta robots noindex>`
- [x] Toggle `?lang=ar` → document bascule en `dir="rtl"`
- [x] POST cross-origin → **403** (garde CSRF P6 : `Origin`/`Sec-Fetch-Site`)
- [x] POST same-origin sans `decision` → **400** (P19)
- [x] POST `decision` invalide → **400**
- [x] Token bien formé mais inexistant → **401** générique (AR38) — exerce la RPC `process_artisan_consent`

Gated (token valide à usage unique requis) :

- [x] `CONSENT_ACCEPT_URL` → clic « J'accepte » → `/consent/done?status=accepted` + heading « votre fiche est en ligne »
- [x] `CONSENT_REFUSE_URL` → clic « Je refuse » → `/consent/done?status=refused` + heading « votre choix est enregistré »

### E2E — Webhook droit de réponse artisan (Story 2.8)

`e2e/respond-artisan.spec.ts` — **7 tests × 3 projets** — non-gated (aucun seed DB)

- [x] Token invalide → écran « Lien invalide », pas de `textarea`, `noindex`
- [x] Toggle `?lang=ar` → `dir="rtl"`
- [x] POST cross-origin → **403** (CSRF P6)
- [x] POST sans `kind` → **400** (P19)
- [x] POST `kind` invalide → **400**
- [x] POST `kind=response` sans `response_text` → **400**
- [x] Token bien formé inexistant → **303** `/respond/done?status=invalid` (AR38) — exerce la RPC `process_artisan_response`

### E2E — Confirmation magic-link (Stories 1.6 / 1.7 / 1.9)

`e2e/magic-link-confirm.spec.ts` — **5 tests × 3 projets**

Guard `/auth/confirm` (non-gated, **non-write** : rejet avant tout appel DB) :

- [x] `token_hash` absent → `/auth/error?reason=invalid`
- [x] `type=magiclink` (≠ email) → `invalid` (preuve que le guard mord)
- [x] `type` absent → `invalid`
- [x] `type=email` + `token_hash` bidon → `verifyOtp` échoue → `/auth/expired`, jamais de session

Gated (`MAGIC_LINK_CONFIRM_URL` = URL PKCE réelle de l'inbox/sonde) :

- [x] URL valide → session `sb-*-auth-token` posée, pas d'écran d'erreur

### E2E — Offline / Service Worker / fallback (Story 7.3)

`e2e/offline-pwa.spec.ts` — **4 tests × 3 projets** — **toute la suite gated `OFFLINE_BASE_URL`**

- [x] Le SW s'enregistre et prend le contrôle (`navigator.serviceWorker.ready`)
- [x] Navigation hors-ligne non cachée → page de repli `/fr/offline` (« Aucune connexion détectée » + bouton « Réessayer »)
- [x] Surface token `/consent` jamais mise en cache (NetworkOnly bypass) → reload offline sert le fallback, **pas** le HTML token (anti-leak P12)
- [x] (gated `RESIDENT_LOGIN_URL`) Contenu durable `/fr/community/guide` lisible hors-ligne après réchauffage (AC5)

---

## Couverture

| Domaine                    | Avant                            | Après                                                    |
| -------------------------- | -------------------------------- | -------------------------------------------------------- |
| Consentement artisan (E2E) | 0 (unit seulement)               | rendu + 4 gardes webhook + round-trip accept/refuse      |
| Offline/SW (E2E)           | 0 (unit `sw-matchers` seulement) | SW actif + fallback + anti-cache token + durable offline |

---

## Statut d'exécution

### ✅ Consentement artisan — 6/6 non-gated VERTS contre staging live (2026-06-28)

Exécuté `CONSENT_BASE_URL=https://darnatips.app pnpm e2e consent-artisan.spec.ts --project=chromium` :

| Test                                         | Résultat |
| -------------------------------------------- | -------- |
| Token invalide → « Lien invalide » + noindex | ✅       |
| Toggle `?lang=ar` → RTL                      | ✅       |
| POST cross-origin → 403 (CSRF P6)            | ✅       |
| POST sans `decision` → 400 (P19)             | ✅       |
| POST `decision` invalide → 400               | ✅       |
| Token bien formé inexistant → 401 (AR38)     | ✅       |

**6 passed.** Premier signal runtime réel sur le chemin webhook consentement — la garde CSRF, les validations de body et la RPC `process_artisan_consent` (chemin `not_found`) sont confirmées en prod-like.

### ✅ Droit de réponse artisan — 7/7 VERTS contre staging live (2026-06-28)

`CONSENT_BASE_URL=https://darnatips.app pnpm e2e respond-artisan.spec.ts --project=chromium` → **7 passed.** CSRF 403, 3× validations body 400, RPC `process_artisan_response` (not_found → 303 status=invalid), rendu invalide+noindex, toggle RTL. **Le volet « respond » du trou consent/respond est vérifié au runtime.**

### 🟡 Magic-link — 4/4 guards VERTS contre staging (2026-06-28) ; positif gated

`CONSENT_BASE_URL=https://darnatips.app pnpm e2e magic-link-confirm.spec.ts -g guard` → **4 passed.**
Confirmé : le route handler `/auth/confirm` rejette `type=magiclink`/params manquants → `invalid` ; `type=email`+token bidon → `verifyOtp` atteint, échec gracieux → `/auth/expired` (zéro fuite de session).

**Analyse code (résout le doute conceptuel §3.1)** : l'app n'utilise PAS l'`action_link` legacy Supabase. `auth-signin.ts`/`admission-submit.ts` appellent `generateLink({type:'magiclink'})`, extraient `properties.hashed_token`, et `buildPkceConfirmUrl` reconstruit `/auth/confirm?token_hash=…&type=email` (type **codé en dur**). Le guard `type!=='email'` passe donc TOUJOURS sur le chemin légitime. Le doute « guard mange le magiclink » est **infondé par construction**.

**Chemin POSITIF — RÉSOLU empiriquement (2026-06-28, sonde curl autorisée)** : contre Supabase staging,
`POST /auth/v1/admin/generate_link {type:magiclink}` → token `verification_type: magiclink` →
`POST /auth/v1/verify {type:'email', token_hash}` → **HTTP 200 + session valide** pour le bon user.
✅ Supabase accepte un `hashed_token` magiclink vérifié en `type:email` — exactement le contrat de
`buildPkceConfirmUrl`. **Le doute magic-link de la story 1.6 est clos : le flow marche.** Session de
test révoquée (logout global 204), aucun user créé (`+test1` préexistant). Point 2 go/no-go = ✅.

### ⏳ Restant à exécuter

- **Round-trip accept/refuse** (2 tests gated) : nécessite un token valide à usage unique (`CONSENT_ACCEPT_URL`/`CONSENT_REFUSE_URL`).
- **Offline PWA** (4 tests gated `OFFLINE_BASE_URL`) : nécessite un build prod servi (Serwist KO sous Turbopack dev). Non encore exécuté.

`playwright test --list` → 36 tests collectés ; `eslint` clean sur les 2 specs.

### Comment exécuter

Consentement (contre staging ou dev avec backend) :

```bash
CONSENT_BASE_URL=https://darna-staging.vercel.app pnpm e2e consent-artisan.spec.ts
# round-trip complet (token frais à usage unique) :
CONSENT_ACCEPT_URL="https://<base>/consent/<raw-token>" \
CONSENT_REFUSE_URL="https://<base>/consent/<raw-token-2>" \
  pnpm e2e consent-artisan.spec.ts
```

Offline (build prod obligatoire — Serwist KO sous Turbopack) :

```bash
pnpm build && pnpm start                                    # terminal 1
OFFLINE_BASE_URL=http://localhost:3000 pnpm e2e offline-pwa.spec.ts   # terminal 2
# ou : OFFLINE_BASE_URL=https://darna-staging.vercel.app pnpm e2e offline-pwa.spec.ts
```

Minter un token consent valide : `lib/consent/token.ts` (`generateConsentToken`) + insert `consent_tokens`, ou récupérer le lien SMS loggé en staging (`SMS_PROVIDER=log`).

---

## Next Steps

1. **Exécuter** les deux suites au vert contre staging (`darna-staging.vercel.app`) — c'est l'action go/no-go bêta, pas la génération.
2. Brancher `consent-artisan.spec.ts` (tests non-gated) dans la CI — ils ne nécessitent qu'un déploiement, pas de secret.
3. `offline-pwa.spec.ts` : job CI dédié post-`build` (jamais sous Turbopack dev).
4. Étendre ensuite aux autres trous E2E (notation 2.6, feed éphémère epic 4, signalement→modération epic 5) si la couverture le justifie.
