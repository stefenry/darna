# 0004 — Isolation : RLS Postgres + discipline FK/column-grants

## Context

Darna est mono-résidence au MVP mais multi-tenant par conception (V3). Les données sont
nominatives et sensibles (CNDP/RGPD). Il faut empêcher tout accès cross-user et cross-résidence,
y compris si un attaquant utilise directement l'API REST Supabase avec un JWT valide.

## Decision

**Row-Level Security (RLS) sur toutes les tables**, en défense en profondeur :

1. **Policies par rôle** (`resident`, `co_mod`, `demandeur`, `public`) lisant `auth.uid()` et
   `app_metadata.role`/`residence_id` via les helpers `auth_role()` / `auth_residence_id()`.
2. **Column-level GRANT/REVOKE** : `authenticated` ne peut écrire que des colonnes précises
   (ex. `users` : pas de `role`/`residence_id` ; `admission_requests` : INSERT limité à 6
   colonnes, UPDATE réservé aux décisions). Anti auto-promotion / auto-validation.
3. **Écritures sensibles via fonctions `SECURITY DEFINER`** (décision admission, suppression
   compte) — `moderation_log` n'a aucune policy INSERT côté client.
4. **FK `ON DELETE` explicites** (cascade vs set-null) pour la cohérence + l'anonymisation
   (cf. ADR 0006).

Le rôle `app_metadata` est la source de vérité du JWT ; il est posé/synchronisé via service-role
(bootstrap co-mods, promotion résident à l'acceptation).

## Consequences

- ✅ Isolation enforced au niveau DB, pas seulement applicatif.
- ✅ Les Server Actions héritent de la défense column-level même via service-role (discipline
  « n'insérer que les colonnes autorisées »).
- ⚠️ La synchro `public.users.role` → `app_metadata` n'est pas automatique au MVP (script
  `invite-co-mods` + `updateUserById` à l'acceptation) ; un trigger de synchro est différé V3.
- ⚠️ Couvert par les tests d'isolation automatisés (ADR 0008).

## Status

Accepted — décision step-02. Implémenté story 1.3 (schéma+RLS), durci stories 1.8/1.9/1.10a.
