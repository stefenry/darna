# 0008 — Tests d'isolation RLS automatisés (cross-user / cross-résidence)

## Context

L'isolation RLS (ADR 0004) est la pierre angulaire de la conformité CNDP/RGPD. Une régression
silencieuse (policy supprimée, grant trop large) exposerait des données nominatives entre
voisins ou entre résidences. Il faut un garde-fou automatisé, bloquant en CI.

## Decision

Tests d'isolation **Vitest** (`tests/rls.test.ts`) tournant contre la **stack Supabase locale**
(Docker), gated par `SUPABASE_LOCAL_TEST=true` (skip propre sinon). On **n'utilise pas** un
Playwright `e2e/security-rls.spec.ts` : l'isolation DB ne requiert pas de navigateur, et le
harness Vitest+Docker était déjà câblé (story 1.3).

Le test crée des utilisateurs distincts (sessions isolées via `storageKey`), pose leur
`app_metadata` (rôle + résidence) via service-role **puis les re-signe** (le JWT porte alors le
rôle/résidence lus par `auth_role()`/`auth_residence_id()`), et vérifie **0 rows ou 403** sur
chaque tentative cross-user / cross-résidence. Job CI **`e2e-rls` bloquant**.

**Scope (D2)** : seules les tables existantes sont couvertes au MVP — `admission_requests`,
`profiles`, `users`, `moderation_log` (lecture publique mais écriture client refusée). Les tables
epic 2-4 (`artisans`, `ratings`, `alerts`, `alert_comments`, `guide_entries`) **rejoindront ce
test** quand elles seront créées (epic 2.1+).

## Consequences

- ✅ Toute fuite cross-user/cross-résidence échoue le merge (CI bloquant).
- ✅ Pas de navigateur → rapide, déterministe.
- ⚠️ Le run nécessite Docker (local ou CI) ; skip propre sans, donc la suite unitaire reste
  verte partout. Le scope s'étend au fil des epics (forward-ref dans le test).

## Status

Accepted — Gap #7. Implémenté stories 1.3 (base alice/bob) + 1.10c (cross-résidence eve + CI).
