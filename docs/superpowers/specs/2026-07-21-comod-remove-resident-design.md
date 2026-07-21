# Retrait d'un résident par un co_mod — design

> Date : 2026-07-21 · Statut : validé (option B) · Demande : pouvoir « supprimer des
> résidents » dans la version d'essai, comme fonctionnalité produit co_mod.

## Contexte

Darna dispose déjà d'une suppression **self-service** RGPD (`request_account_deletion`,
migration `20260617090000`, ADR 0006) : soft-delete immédiat + anonymisation, blocage
re-login (`lib/auth/is-account-deleted.ts`), purge dure à J+7 par le cron
`purge-expired`, contributions conservées mais détachées de l'auteur (`SET NULL`).
Il n'existe **aucun** moyen pour un co_mod de retirer un résident (déménagement, abus) :
la page `/comod/residents` ne propose que la promotion co_mod.

## Objectif

Un co_mod peut retirer un résident de sa résidence depuis `/comod/residents`, en
réutilisant **à l'identique** le pipeline soft-delete → J+7 → purge existant.

## Non-objectifs

- Retirer un **co_mod** : reste script-only (asymétrie assumée, cf. commentaire de
  `promoteToComod`). Un co_mod doit d'abord être rétrogradé par script.
- UI de restauration pendant la fenêtre J+7 : geste ops, comme pour le flux RGPD.
- Suppression immédiate définitive : refusée au profit de la grâce J+7 (décision user).

## Décisions

| Question        | Décision                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------- |
| Sémantique      | Même pipeline que `request_account_deletion` (soft-delete + J+7)                          |
| Architecture    | **B** : RPC SQL `SECURITY DEFINER` atomique + Server Action (pattern `accept_admission`)  |
| Cible autorisée | `users.role = 'resident'` uniquement, même résidence, non déjà supprimé                   |
| Motif           | **Obligatoire**, texte court, journalisé dans `moderation_log`                            |
| Audit           | `moderation_log` action `user_deleted` (valeur d'enum existante, pas de migration d'enum) |

## Composants

### 1. Migration `comod_remove_resident`

Nouvelle migration `supabase/migrations/<ts>_comod_remove_resident.sql` :
fonction `public.comod_remove_resident(p_target_user_id uuid, p_reason text)`
`SECURITY DEFINER`, `search_path = public`, `GRANT EXECUTE TO authenticated`.

Dans une transaction :

1. **Gardes** (chacune → `RAISE EXCEPTION` avec code dédié, mappé côté action) :
   - appelant : `auth_role() = 'co_mod'` sinon `forbidden` ;
   - cible existe, `residence_id` = `auth_residence_id()` de l'appelant sinon
     `cross_residence` ;
   - cible `role = 'resident'` (pas co_mod) sinon `target_not_resident` ;
   - cible non supprimée (`deleted_at IS NULL`) sinon `already_deleted` ;
   - `p_reason` non vide (trim), ≤ 200 caractères sinon `invalid_reason`.
2. **Écritures** (mêmes que `request_account_deletion`, avec acteur) :
   - `users` : `deleted_at = now()`, `deleted_by = auth.uid()`,
     `deletion_reason = 'removed_by_comod'`, `display_name = 'Voisin supprimé'` ;
   - `profiles` : soft-delete miroir ;
   - `moderation_log` : action `user_deleted`, acteur = co_mod, motif dans le champ
     de détail existant (même forme que les autres insertions du log), insert
     idempotent (guard `NOT EXISTS` comme le flux RGPD).

### 2. Server Action `removeResident`

Dans `app/[locale]/comod/residents/actions.ts` (à côté de `promoteToComod`) :

- Zod : `p_target_user_id` UUID, `reason` string 1–200 (schéma dans
  `lib/validation/`, cohérent avec l'existant).
- `requireComod()` puis `supabase.rpc('comod_remove_resident', …)` avec le client
  **session** (la RPC porte les gardes ; pas d'admin client pour l'écriture DB).
- Puis coupure JWT via admin client : `updateUserById(target, { app_metadata:
{ role: 'demandeur' } })` — même mécanique inverse que la promotion ; l'accès
  effectif tombe au plus tard à l'expiration du token, et les gardes serveur
  (`requireResident` + `isAccountDeleted` au re-login) rejettent immédiatement.
- Log applicatif `comod.resident_removed` (UUID only, pas de PII) — pattern
  `comod.promoted`.
- Retour `{ ok: true }` ou `{ ok: false, code, message_key }` (mêmes formes que
  `promoteToComod`), `revalidatePath` de la page.

### 3. UI `/comod/residents`

- Sur chaque carte résident (pas sur les badges co_mod) : bouton « Retirer » ouvrant
  une zone inline avec champ **motif obligatoire** + confirmation native
  (`window.confirm`) — même pattern que `comod-publish-button.tsx`.
- Après succès : le résident disparaît de la liste (elle filtre déjà `deleted_at`).
- i18n : clés `comod.residents.remove.*` dans `messages/fr.json` (`ar.json` : copie
  FR, dette V1.5 assumée comme le reste).

### 4. Effets aval (aucun code nouveau)

- Re-login bloqué pendant J+7 : `isAccountDeleted` (existant).
- Purge dure J+7 : cron `purge-expired` sélectionne sur `deleted_at` sans filtrer
  `deletion_reason` (vérifié) → aucun changement.
- Contributions anonymisées à la purge via cascades `SET NULL` (existant).
- Journal de modération public : l'entrée `user_deleted` apparaît, anonyme après purge.

## Sécurité / invariants

- Écritures sensibles en RPC `SECURITY DEFINER` avec gardes SQL — un résident ne peut
  pas appeler la RPC avec succès (`auth_role()` ≠ co_mod), même en forgeant l'appel.
- Cross-résidence impossible (garde SQL sur `auth_residence_id()`).
- Un co_mod ne peut pas retirer un co_mod (donc pas lui-même) via l'app.
- Pas de PII dans les logs applicatifs ; le motif vit uniquement dans
  `moderation_log` (audit produit).
- Échec de la synchro `app_metadata` : non bloquant, loggé en error (drift-visibility,
  même politique que `validateAdmission`).

## Tests

- **Unitaires** (`tests/comod/remove-resident.test.ts`, pattern
  `validate-admission.test.ts`) : happy path (RPC + app_metadata + log), forbidden
  (non co_mod), mapping des erreurs RPC (`cross_residence`, `target_not_resident`,
  `already_deleted`, `invalid_reason`), échec app_metadata non bloquant.
- **RLS** (`tests/rls.test.ts`) : un résident qui appelle la RPC est rejeté ;
  un co_mod d'une autre résidence est rejeté.
- **Composant** : le bouton n'apparaît pas sur un co_mod ; motif vide → soumission
  bloquée.

## Livraison

Branche `feat/comod-remove-resident` → PR (la CI exécute lint/typecheck/test +
tests RLS bloquants) → merge = déploiement production automatique. La migration est
appliquée en prod via le flux habituel du repo (release/`db push` ou application
manuelle staging, comme les migrations précédentes).
