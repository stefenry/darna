# Story 1.9: Profil résident, déconnexion & suppression compte RGPD cascade

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** résident authentifié,
**I want** consulter mon profil, ajuster mes préférences (visibilité pseudo/identité + langue), me déconnecter (cet appareil ou tous), et supprimer mon compte avec une cascade d'anonymisation RGPD auditable,
**so that** mes droits de souveraineté des données (FR10, FR11, FR16, FR46) sont opérationnels et défendables CNDP/RGPD — et la zone communautaire (`/community/`) vers laquelle la story 1.6/1.8 redirige enfin un résident accepté existe réellement (aujourd'hui : 404).

## Acceptance Criteria

> **Convention BDD** : chaque AC est testable indépendamment. Référence epic
> ([Source: `_bmad-output/planning-artifacts/epics.md:756-792`]). **Décision MVP FR-only**
> ([[project_darna_mvp_fr_only]]) : messages/templates FR remplis, stubs AR vides (fallback FR
> via `deepMerge`, story 1.5). **Hors-scope** : rate-limiting / headers sécurité / backup hebdo
> / ADRs (story 1.10), dashboard communautaire 3 tuiles Annuaire/Alertes/Guide (epics 2-4 — la
> 1.9 ne livre qu'un **home placeholder** minimal), export RGPD JSON self-service (story 8.3),
> UI complète des 3 toggles notifications (story 7.1 — la 1.9 n'affiche que des **stubs**
> lecture seule), bascule de langue globale dans le header (story 7.4 — la 1.9 **persiste** la
> préférence `profiles.language` mais ne câble pas le switcher header), templates AR finalisés
> (V1.5).

---

### AC1 — Migration : fonction `request_account_deletion` + enum `purge_completed` (DB) (AR10, FR11, NFR18)

**Given** le socle 1.3 fournit (vérifié) :

- `users` : colonnes `deleted_at, deleted_by, deletion_reason` **non grantables** à `authenticated` (UPDATE grant = `display_name, first_login_at, pack_accueil_dismissed_at, updated_at` ; [Source: `supabase/migrations/20260524005600_init_rls.sql:76-78`]) → soft-delete via `SECURITY DEFINER`
- `users.id references auth.users(id) **on delete cascade**` ([Source: `supabase/migrations/20260524005559_init_schema.sql:31`]) ; `profiles.user_id`, `notifications_prefs.user_id`, `admission_requests.user_id` → `users(id) **on delete cascade**` ([Source: schema 51, 128, 72]) ; `moderation_log.actor_id`/`deleted_by` + `admission_requests.decided_by` → `users(id) **on delete set null**` ([Source: schema 107, 80, 115]) → **un `auth.admin.deleteUser(id)` purge dur TOUT en cascade et anonymise le journal automatiquement**
- enum `moderation_action` = `admission_accepted, admission_rejected, user_deleted, content_removed, rating_removed, comment_removed` — **`user_deleted` existe**, **`purge_completed` n'existe PAS** ([Source: `supabase/migrations/20260524005527_init_enums.sql:33-40`])
- tables `ratings, alert_comments, guide_entries, alerts, artisans` **n'existent pas encore** (epics 2/3/4) → la cascade d'anonymisation se limite au MVP (`moderation_log.actor_id` auto-nullé par FK ; pas d'UPDATE explicite à faire)

**When** la story 1.9 est livrée
**Then** une migration **`supabase/migrations/20260617090000_account_deletion.sql`** :

1. **`alter type public.moderation_action add value if not exists 'purge_completed';`** (additif ; PG 15+ ; valeur consommée seulement au runtime cron, pas dans cette migration)
2. crée **`public.request_account_deletion()`** `SECURITY DEFINER set search_path = public`, **`grant execute to authenticated`** (self-service via `auth.uid()`, pas d'admin client requis) :

```sql
create or replace function public.request_account_deletion()
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  -- Soft-delete users : marquage immédiat + anonymisation du display_name.
  update public.users
     set deleted_at = coalesce(deleted_at, now()),
         deletion_reason = 'self_service_rgpd',
         display_name = 'Voisin supprimé',
         updated_at = now()
   where id = v_uid and deleted_at is null;

  -- Soft-delete profiles (cascade dure J+7 via FK quand auth user purgé).
  update public.profiles
     set deleted_at = coalesce(deleted_at, now()),
         deletion_reason = 'self_service_rgpd',
         updated_at = now()
   where user_id = v_uid and deleted_at is null;

  -- Trace publique anonymisée (FR33). actor_id sera SET NULL au purge dur J+7.
  insert into public.moderation_log
    (residence_id, actor_id, action, target_kind, target_id)
  select residence_id, v_uid, 'user_deleted', 'user', v_uid
    from public.users where id = v_uid;
end; $$;

revoke execute on function public.request_account_deletion() from public;
grant execute on function public.request_account_deletion() to authenticated;
```

**And** **purge dure côté cron** (AC8) : **aucune** fonction SQL — le cron utilise `auth.admin.deleteUser(id)` (SDK) qui déclenche la cascade FK ; l'`INSERT moderation_log 'purge_completed'` se fait via l'admin client (service-role bypasse l'absence de policy INSERT).

**And** `pnpm supabase db reset` local OK ; `pnpm run gen:types` régénère `types.generated.ts` (+`purge_completed` dans l'enum, +signature `request_account_deletion`) ; **commit du diff** (patch manuel si Docker down — leçon 1.7/1.8).

**And** la migration **n'altère aucune colonne de table** (1 valeur d'enum + 1 fonction).

---

### AC2 — Shell communautaire `/[locale]/community/` (résout le 404 post-accept) (FR16)

**Given** `resolveRedirect` (story 1.6, livrée) redirige un résident `accepted` vers `/${locale}/community/` ([Source: `lib/auth/redirect-by-state.ts:49`]) **mais ce chemin n'existe pas** (404 actuel) ; le proxy protège déjà `community|...|profil` ([Source: `proxy.ts:15-16`])
**When** la story 1.9 est livrée
**Then** un **segment littéral `app/[locale]/community/`** (pattern story 1.8 : un route group `(community)` produirait `/${locale}/` et entrerait en collision avec `(public)` — utiliser un segment littéral `community`) :

- **`app/[locale]/community/layout.tsx`** — Server Component : `assertLocale`, `setRequestLocale`, garde session via `lib/auth/require-resident.ts` (AC ci-dessous) ; rend un header minimal avec un lien `Settings` vers `/community/profil` (icône top-right, [Source: ux-design-specification.md:1260]) + `<PageContainer>`.
- **`app/[locale]/community/page.tsx`** — Server Component **home placeholder** minimal : titre « Bienvenue à Darna » + texte « L'annuaire, le guide et les alertes arrivent bientôt. » + lien profil. **PAS** les 3 tuiles Annuaire/Alertes/Guide (epics 2-4, hors-scope). `export const dynamic = 'force-dynamic'` (page authentifiée, pas de SSG).
- **`lib/auth/require-resident.ts`** — helper `requireResident(): Promise<{ ok: true; user } | { ok: false }>` (pattern `require-comod.ts` story 1.8) : `createClient()` SSR → `getUser()` ; `ok:false` si pas de session. **Ne gate PAS le rôle** (un `demandeur` authentifié peut voir son profil ; le role-gating community est déféré 1.10/epic2, [[deferred-work community role-gating]]). Si `ok:false`, le layout `redirect('/${locale}/admission')` (le proxy le fait déjà — défense en profondeur).

**And** ce shell est **volontairement minimal** : il existe pour (a) résoudre le 404 post-accept de 1.8, (b) héberger `/profil`. Son enrichissement (nav bottom-tab PWA, tuiles) est livré aux epics 2-4.

---

### AC3 — Page profil `/[locale]/community/profil` (lecture) (FR16)

**Given** je suis résident authentifié et j'ouvre `/${locale}/community/profil`
**When** la page rend (Server Component, `dynamic='force-dynamic'`)
**Then** elle lit `users` (display_name) + `profiles` (villa, tranche, language, identity_mode) + `notifications_prefs` via le **client SSR session** (RLS self-select) et affiche :

- **lecture seule MVP** : villa, tranche, prénom (= `users.display_name` ou un fallback), **e-mail** (= `user.email` du `getUser()`, read-only)
- **préférences courantes** : langue (`profiles.language`), visibilité par défaut (`profiles.identity_mode` → libellé « Pseudonyme » / « Identité visible »)
- **stubs notifications** (lecture seule) : les 3 booléens `notifications_prefs` (`alerts_urgentes_enabled`, `nouvelles_entrees_annuaire_enabled`, `activite_contributions_enabled`) affichés **désactivés** avec mention « Réglage complet bientôt » (UI complète = story 7.1)
- liens : « Paramètres » → `/community/profil/parametres`, « Supprimer mon compte » → `/community/profil/supprimer` (style discret, pas danger ici), + section déconnexion (AC6)

**And** **aucune** PII loggée (la page ne logue rien ; le rendu DOM de l'e-mail/prénom est légitime pour le propriétaire du compte).

---

### AC4 — Paramètres `/[locale]/community/profil/parametres` (visibilité + langue, persist immédiat) (FR16, FR46)

**Given** j'ouvre `/${locale}/community/profil/parametres`
**When** la page rend
**Then** un form (Client Component) permet :

- **Visibilité par défaut** : `identity_mode` ∈ `{pseudo, identified}` — toggle via le **`<Checkbox>` Radix existant** (story 1.4) ou un segmented natif (**D7 : ne PAS ajouter `@radix-ui/react-switch`** — non installé, cohérent avec 1.8 D6). Libellé : « Afficher mon identité (au lieu d'un pseudonyme) » coché = `identified`. ([Source: ux-design-specification.md:158, 167 — opt-in identité révocable])
- **Langue** : `language` ∈ `{fr, ar}` — `<select>` natif. **Note MVP FR-only** : la préférence est **persistée** dans `profiles.language` mais le **switcher header global et le routing AR** restent story 7.4 ; au MVP la valeur stockée n'altère pas encore le rendu (FR-only).

**And** un Server Action **`updateProfileSettings`** (`app/[locale]/community/profil/actions.ts`) :

1. `requireResident()` → échec → `Result.error({ code:'forbidden', message_key:'errors.profil.forbidden' })`
2. valide via Zod `zProfileSettings` (AC10) `.safeParse`
3. **client SSR session** (PAS admin) : `supabase.from('profiles').update({ identity_mode, language, updated_at: new Date().toISOString() }).eq('user_id', user.id)` — la policy RLS `profiles_resident_update_self` + le column-grant `(villa, tranche, language, identity_mode, updated_at)` autorisent **exactement** ces écritures ([Source: `init_rls.sql:113-123`])
4. log `profil.settings_updated` (sans PII : `payload:{ identity_mode, language }`)
5. retourne `Result.ok` → le form fait `router.refresh()` + toast « Préférences enregistrées »

**And** changements **persistés immédiatement** (pas de bouton « Enregistrer » différé exigé, mais accepté ; `useActionState` + `router.refresh()`).

---

### AC5 — Suppression compte `/[locale]/community/profil/supprimer` + `deleteAccount` (Danger Zone + phrase tapée) (FR11, AR10, NFR18)

**Given** j'ouvre `/${locale}/community/profil/supprimer`
**When** la page rend
**Then** une **« Danger Zone »** (Server Component + Client form) affiche :

- titre danger + description cascade **exacte** ([Source: epics.md:774]) : « Tes contributions (avis, commentaires, alertes, etc.) seront anonymisées (mention **'Voisin supprimé'**). Tes données personnelles seront purgées **sous 7 jours** conformément RGPD. »
- un **champ texte de confirmation** : je dois taper la phrase **`SUPPRIMER`** (D2 — constante, casse exacte) pour activer le bouton
- bouton **`destructive`** (`bg-danger #D45B4A`, [Source: ux-design-specification.md:655, 490, 1200] — danger réservé au destructif), désactivé tant que la phrase ≠ `SUPPRIMER`

**And** le Server Action **`deleteAccount`** (`profil/actions.ts`) :

1. `requireResident()` → échec → `Result.error({ code:'forbidden' })`
2. valide la phrase via Zod `zDeleteAccount` (AC10 : `confirm === 'SUPPRIMER'`) → échec → `Result.error({ code:'confirm_mismatch', message_key:'errors.profil.confirm_mismatch' })`
3. **client SSR session** : `supabase.rpc('request_account_deletion')` (la fonction utilise `auth.uid()` en interne — self-service garanti, AC1)
4. sur succès : `supabase.auth.signOut({ scope: 'global' })` (invalide toutes les sessions, cohérent FR10) puis retourne `Result.ok`
5. log `profil.deletion_requested` (sans PII : `payload:{}` ; **jamais** d'e-mail/prénom)
6. le Client Component, sur `ok`, fait `router.push('/${locale}/')` (atterrit sur l'accueil public, [Source: epics.md:774 wording])

**And** **D1 — modèle soft-delete + purge J+7 (PAS de hard-delete immédiat)** : `deleteAccount` **n'appelle PAS** `auth.admin.deleteUser` (la purge dure est faite par le cron AC8 à J+7). Justification : (a) la **copie utilisateur dit « purgées sous 7 jours »** (pas « immédiatement »), (b) **NFR18** « marquage soft-delete immédiat · purge dure à J+7 », (c) le cron `purge-expired` existerait sans objet sinon. **Variance assumée vs lettre de l'epic AC** (qui liste `auth.admin.deleteUser` dans `deleteAccount`) — voir Dev Notes D1. Le compte devient inaccessible immédiatement (signout global + guard AC7).

---

### AC6 — Déconnexion cet appareil / tous les appareils (réutilise l'existant) (FR10)

**Given** la route **`app/auth/signout/route.ts` existe déjà** (POST, CSRF same-origin, `?scope=local|global`, expire les cookies `sb-*`, redirect `/${locale}/`, log `auth.signout`) ([Source: `app/auth/signout/route.ts`]) et les clés i18n **existent** (`auth.common.signOutLocal` / `signOutGlobal`, [Source: `messages/fr.json`])
**When** la story 1.9 est livrée
**Then** la page profil (ou un composant `_components/signout-buttons.tsx`) expose **deux `<form method="post">`** :

- `action="/auth/signout?scope=local"` → bouton « Se déconnecter de cet appareil »
- `action="/auth/signout?scope=global"` → bouton « Se déconnecter de tous mes appareils »

**And** **aucune modification** de `app/auth/signout/route.ts` n'est nécessaire (FR10 déjà livré story 1.6) — 1.9 ne fait qu'ajouter les déclencheurs UI. Le `<form>` POST same-origin passe le check CSRF natif.

---

### AC7 — Guard re-login compte soft-deleted (fenêtre de grâce J+7) (NFR18, sécurité)

**Given** après `deleteAccount`, l'`auth.users` persiste jusqu'au purge J+7 → un magic-link rouvrirait une session ([Source: `app/auth/confirm/route.ts` ne vérifie **pas** `users.deleted_at`)
**When** un utilisateur soft-deleted clique un magic-link
**Then** `app/auth/confirm/route.ts`, **après** `verifyOtp` réussi et **avant** `resolveRedirect`, appelle un helper **`lib/auth/is-account-deleted.ts`** `isAccountDeleted(userId): Promise<boolean>` (admin client, `select deleted_at from users where id = ?`) ; si `true` :

1. `await supabase.auth.signOut({ scope: 'global' })`
2. `log('auth.deleted_account_login_blocked', { user_id })` (sans PII)
3. `redirect('/${locale}/')` (accueil public — pas de page d'erreur dédiée au MVP)

**And** ce guard est **idempotent** et **n'échoue jamais** le callback si la lecture throw (try/catch → laisse passer plutôt que 500 ; cohérent `markAdmissionEmailVerified` 1.7). **Variance minimale 1.6** : 3 lignes ajoutées dans `confirm/route.ts` (documenté Dev Notes D3).

---

### AC8 — Cron `purge-expired` (purge dure J+7 + log) (FR11, NFR18, NFR55, AR39)

**Given** aucun `app/api/` n'existe et `vercel.json` n'a **pas** de `crons` ([Source: `vercel.json`]) ; `CRON_SECRET` est dans l'env (≥32 chars, [Source: `lib/env.ts:17`])
**When** la story 1.9 est livrée
**Then** :

1. **`app/api/cron/purge-expired/route.ts`** (Route Handler `GET`) :
   - **garde** : `Authorization: Bearer ${env.server.CRON_SECRET}` — sinon `Response` **401** `{ error: { code:'unauthorized', message_key:'errors.cron.unauthorized' } }` (AR39)
   - `createAdminClient()` → `select id from users where deleted_at is not null and deleted_at < now() - interval '7 days'`
   - pour chaque `id` : **(a)** `admin.from('moderation_log').insert({ residence_id, actor_id: id, action:'purge_completed', target_kind:'user', target_id: id })` (avant le delete, tant que `id` existe) ; **(b)** `admin.auth.admin.deleteUser(id)` → **cascade FK** hard-delete `users/profiles/admission_requests/notifications_prefs` + `set null` sur `moderation_log.actor_id`/`deleted_by` (la trace `user_deleted` ET `purge_completed` deviennent anonymes)
   - log structuré `cron.purge_completed` `{ count }` (NFR55) ; erreurs par-id en `try/catch` (un échec n'arrête pas le batch)
   - retourne `Response.json({ data: { purged: count } })`
2. **`vercel.json`** : ajouter `"crons": [{ "path": "/api/cron/purge-expired", "schedule": "0 3 * * *" }]` (quotidien 03:00 UTC, [Source: epics.md:780])
3. le matcher `proxy.ts` exclut déjà `api/` ([Source: `proxy.ts:123`]) → le cron n'est pas intercepté par l'auth middleware.

**And** **pas de PII** dans les logs cron (`user_id`/`count` uniquement). **Idempotent** : un compte déjà purgé ne réapparaît pas (il n'a plus de ligne `users`).

---

### AC9 — i18n FR + stubs AR (NFR44)

**Given** nouveau périmètre i18n
**Then** `messages/fr.json` ajoute :

```
community.{home.{title, body}, nav.{settings}}
profil.{pageTitle, villaLabel, trancheLabel, firstNameLabel, emailLabel, emailReadonlyHint,
        languageLabel, visibilityLabel, visibilityPseudo, visibilityIdentified,
        notifStubTitle, notifStubHint, settingsCta, deleteCta,
        settings.{pageTitle, visibilityToggleLabel, languageLabel, saveCta, saved},
        delete.{pageTitle, dangerTitle, cascadeBody, confirmLabel, confirmPlaceholder, confirmPhrase, submitCta}}
errors.profil.{forbidden, confirm_mismatch, settings_failed, delete_failed}
errors.cron.{unauthorized}
```

(les clés `auth.common.signOutLocal/signOutGlobal` **existent déjà** — ne pas dupliquer)

**And** `messages/ar.json` reçoit les **mêmes clés en `""`** (fallback FR via `deepMerge`). Wording **première personne, non-infantilisant** ([Source: ux-design-specification.md:156, 145, 927]). `delete.confirmPhrase` = `"SUPPRIMER"` (identique FR/AR — c'est une constante tapée, pas une traduction).

---

### AC10 — Zod (phrase de confirmation + settings) (AR17)

**Then** `lib/validation/profile.ts` exporte :

```ts
export const zProfileSettings = z.object({
  identity_mode: z.enum(['pseudo', 'identified']),
  language: z.enum(['fr', 'ar']),
});
export const DELETE_CONFIRM_PHRASE = 'SUPPRIMER';
export const zDeleteAccount = z.object({
  confirm: z.literal(DELETE_CONFIRM_PHRASE, { message: 'errors.profil.confirm_mismatch' }),
});
```

**And** `lib/validation/profile.test.ts` : settings valides/invalides (enum hors-bornes), phrase exacte vs casse/espaces erronés.

---

### AC11 — Tests Vitest (AR23)

**Then** :

- `lib/validation/profile.test.ts` (AC10)
- `tests/profil/profile-actions.test.ts` (≥5 cas) : `updateProfileSettings` (ok via RLS update, forbidden, Zod invalid) ; `deleteAccount` (ok → `rpc('request_account_deletion')` appelé + `signOut({scope:'global'})` ; phrase erronée → `confirm_mismatch`, **pas** de rpc/signout ; forbidden) ; **assert aucune PII loggée**
- `tests/auth/is-account-deleted.test.ts` : deleted_at non-null → true ; null → false ; erreur → false (fail-open documenté)
- `tests/cron/purge-expired.test.ts` (≥4 cas) : 401 sans Bearer ; 200 + 0 purge si rien ; purge N comptes → `deleteUser` × N + `moderation_log` insert `purge_completed` × N ; un `deleteUser` qui throw n'arrête pas le batch
- **Non-régression** : `app/auth/signout/route.ts` (si des tests existent) + 1.7/1.8 verts ; `resolveRedirect` inchangé
- **Mocks** : `vi.mock('@/lib/supabase/admin')` (rpc/auth.admin/from) + `vi.mock('@/lib/supabase/server')` (session client) + `vi.mock('@/lib/auth/require-resident')`. `// @vitest-environment node` sur tout test important `lib/env.ts`.

**And** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` verts.

---

### AC12 — Validation manuelle end-to-end

**Then** :

- gates verts + smoke HTTP
- **Prérequis** : `supabase db push` (migration AC1) + `pnpm gen:types -- linked` quand Docker relancé
- Flow : login résident → `/fr/community/profil` rend (plus de 404 `/community/`) → `/parametres` : cocher « identité », changer langue → persiste (vérifier `profiles.identity_mode='identified'`, `language` en SQL) → `/supprimer` : bouton désactivé tant que ≠ `SUPPRIMER` → taper `SUPPRIMER` → confirmer → redirect `/fr/` + en SQL `users.deleted_at NOT NULL`, `display_name='Voisin supprimé'`, `moderation_log` row `user_deleted` → re-cliquer un magic-link (guard AC7) → re-signout + redirect `/fr/` → déclencher le cron (`curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/purge-expired`) après avoir antidaté `deleted_at` → `auth.users` purgé + `moderation_log` `purge_completed` + `actor_id` des 2 traces = NULL
- déconnexion « cet appareil » / « tous mes appareils » : vérifier cookies `sb-*` expirés + (global) session invalidée sur 2e device
- screenshots Danger Zone + e-mails pour review Stephane

---

## Tasks / Subtasks

> **Convention** : cocher au fil de l'eau. **Tester en mode prod** (`pnpm build && pnpm start`) avant AC5/AC7/AC8 (cookies session + cron diffèrent en dev Turbopack).

- [x] **T1 — Migration `account_deletion.sql`** (AC1) : `alter type ... add value 'purge_completed'` + fonction `request_account_deletion()` SECURITY DEFINER (auth.uid, soft-delete users+profiles, anonymise display_name, log user_deleted) + grant authenticated. `gen:types` (ou patch manuel + TODO).
- [x] **T2 — Shell `app/[locale]/community/{layout.tsx, page.tsx}` + `lib/auth/require-resident.ts`** (AC2) : segment littéral `community`, garde session, home placeholder, header lien Settings.
- [x] **T3 — `lib/validation/profile.ts` + `.test.ts`** (AC10) : `zProfileSettings`, `DELETE_CONFIRM_PHRASE`, `zDeleteAccount`.
- [x] **T4 — Page profil `community/profil/page.tsx`** (AC3) : lecture users+profiles+notifications_prefs (RLS session), e-mail read-only, stubs notifs, liens.
- [x] **T5 — Paramètres `community/profil/parametres/page.tsx` + form + `updateProfileSettings`** (AC4) : Checkbox visibilité (pas de react-switch), select langue, Server Action RLS session update, Zod, `router.refresh`.
- [x] **T6 — Suppression `community/profil/supprimer/page.tsx` + Danger Zone form + `deleteAccount`** (AC5) : phrase `SUPPRIMER`, bouton destructive, Server Action → `rpc('request_account_deletion')` + `signOut({scope:'global'})` → redirect `/`.
- [x] **T7 — Boutons déconnexion `_components/signout-buttons.tsx`** (AC6) : 2 `<form method=post>` vers `/auth/signout?scope=local|global` (réutilise route + i18n existants).
- [x] **T8 — Guard `lib/auth/is-account-deleted.ts` + hook dans `app/auth/confirm/route.ts`** (AC7) : check deleted_at avant resolveRedirect → signout global + redirect si supprimé ; try/catch fail-open.
- [x] **T9 — Cron `app/api/cron/purge-expired/route.ts` + `vercel.json` crons** (AC8) : Bearer CRON_SECRET (401 sinon), query >7j, insert `purge_completed` + `auth.admin.deleteUser` par compte, log, batch resilient.
- [x] **T10 — i18n FR + stubs AR** (AC9) : `community.*`, `profil.*`, `errors.profil.*`, `errors.cron.*` ; AR vides (fallback FR). JSON validés.
- [x] **T11 — Tests Vitest** (AC11) : profile validation + profile-actions + is-account-deleted + cron purge + non-régression.
- [x] **T12 — Validation manuelle E2E** (AC12) : checklist + screenshots.

---

## Dev Notes

### Architecture compliance — règles non-négociables

1. **AR10 — Soft-delete cascade anonymisation** [Source: architecture.md:1430-1437] : `user_id`/`actor_id → NULL` sur les contributions ; au MVP seule `moderation_log` est concernée (auto-nullée par FK `on delete set null`). `display_name='Voisin supprimé'` ([Source: epics.md:774]).
2. **AR3 / service-role** : `createAdminClient()` pour le cron (`auth.admin.deleteUser` + insert log) ; **PAS** pour `request_account_deletion` (self-service via `auth.uid()` + grant authenticated — préférable, zéro admin client côté action utilisateur).
3. **AR16-19** : Result<T> discriminé (pas de throw métier), Zod aux frontières (`zProfileSettings`, `zDeleteAccount`, body cron), logger sans PII ([Source: `lib/logger.ts:18-30`]), `message_key` jamais hardcodé.
4. **AR39 — Cron Bearer** [Source: architecture.md:1037] : `Authorization: Bearer ${CRON_SECRET}` → 401 sinon.
5. **AR21 — Skeleton** : `loading.tsx` skeleton sur les pages profil (pattern 1.7/1.8).
6. **AR22 — RTL logical props** : `me-*/ms-*/ps-*/pe-*`.
7. **AR37 — pas de WebSocket** : N/A ici (pas de polling).
8. **MVP FR-only** [[project_darna_mvp_fr_only]] : stubs AR vides → fallback FR ; `profiles.language` persisté mais switcher header = 7.4.
9. **N2 — Confirmation seulement sur destructif** [Source: ux-design-specification.md:927] : seule la suppression compte a une phrase tapée ; settings = 1-tap persist.

### Décisions de conception 1.9 (variances & arbitrages)

**D1 — Modèle soft-delete + purge dure J+7 (PAS de hard-delete immédiat).** L'epic AC liste `auth.admin.deleteUser` dans `deleteAccount`, mais (a) la **copie vue par l'utilisateur** dit « purgées **sous 7 jours** » ([Source: epics.md:774]), (b) **NFR18** = « soft-delete immédiat · purge dure à J+7 » ([Source: architecture.md:299, 1424]), (c) le cron `purge-expired` (AC8) serait inutile sinon. Donc : `deleteAccount` **soft-delete + anonymise + signout global** (compte inaccessible immédiatement) ; le **cron J+7** fait le `auth.admin.deleteUser` (cascade dure). Variance assumée vs lettre de l'AC. **À confirmer Stephane** (voir Questions).

**D2 — Phrase de confirmation = `SUPPRIMER`.** L'UX exige « phrase tapée » ([Source: ux:927, epics.md:776]) mais ne fixe pas le texte. Constante `DELETE_CONFIRM_PHRASE='SUPPRIMER'` (casse exacte, locale-indépendante, validée Zod côté serveur en double-belt).

**D3 — Guard re-login soft-deleted (3 lignes dans `confirm/route.ts`).** Sans lui, un compte soft-deleted se reconnecterait pendant la fenêtre de grâce ([Source: `app/auth/confirm/route.ts` ne checke pas `deleted_at`). Correctness/RGPD → inclus (AC7), minimal et fail-open.

**D4 — Shell communautaire minimal en scope.** `/community/` n'existe pas → 404 post-accept 1.8. La 1.9 livre un **home placeholder** + layout garde-session + `/profil`. Les 3 tuiles (Annuaire/Alertes/Guide) restent epics 2-4. Segment **littéral `community`** (pas un route group — leçon collision 1.8).

**D5 — `ALTER TYPE moderation_action ADD VALUE 'purge_completed'`.** L'epic veut `moderation_log` record purge ([Source: epics.md:782]) mais l'enum ne l'a pas. Ajout additif (PG15+), consommé seulement au runtime cron.

**D6 — Réutilisation totale de `/auth/signout` (FR10 déjà livré 1.6).** 1.9 n'ajoute que les 2 `<form>` POST. Zéro modif de la route.

**D7 — Pas de `@radix-ui/react-switch`.** Non installé ; visibilité via `<Checkbox>` existant / natif (cohérent 1.8 D6, anti scope-bleed dépendances).

### Project Structure Notes

```
app/
├── [locale]/
│   └── community/                                  # NEW — segment littéral (D4)
│       ├── layout.tsx                              # NEW — garde session + header Settings
│       ├── page.tsx                                # NEW — home placeholder (résout 404 1.8)
│       └── profil/
│           ├── page.tsx                            # NEW — lecture profil
│           ├── loading.tsx                         # NEW — skeleton
│           ├── actions.ts                          # NEW — updateProfileSettings, deleteAccount
│           ├── parametres/page.tsx                 # NEW + form client
│           ├── supprimer/page.tsx                  # NEW + Danger Zone client
│           └── _components/
│               ├── settings-form.tsx               # NEW
│               ├── delete-account-form.tsx         # NEW
│               └── signout-buttons.tsx             # NEW (réutilise /auth/signout)
├── api/
│   └── cron/
│       └── purge-expired/route.ts                  # NEW — Bearer CRON_SECRET
└── auth/
    └── confirm/route.ts                            # MODIFIED — guard isAccountDeleted (AC7)
lib/
├── auth/
│   ├── require-resident.ts                         # NEW — garde session (pattern require-comod)
│   └── is-account-deleted.ts                       # NEW — guard re-login
└── validation/
    ├── profile.ts                                  # NEW
    └── profile.test.ts                             # NEW
messages/{fr,ar}.json                               # MODIFIED — community.* profil.* errors.{profil,cron}.*
vercel.json                                         # MODIFIED — crons purge-expired
supabase/migrations/20260617090000_account_deletion.sql  # NEW
tests/
├── profil/profile-actions.test.ts                  # NEW
├── auth/is-account-deleted.test.ts                 # NEW
└── cron/purge-expired.test.ts                      # NEW
```

### Versions verrouillées

Next 16 (App Router, Route Handlers, Server Actions) · React 19 (`useActionState`/`useTransition`/`router.refresh`) · @supabase/ssr + supabase-js `latest` · next-intl 4.12 · Zod 4.x · Radix : `react-checkbox`/`react-label`/`react-slot`/`react-dropdown-menu` installés ; **`react-switch` ABSENT** (D7). PAS d'Upstash (1.10).

### Patterns de code à réutiliser

- **`lib/supabase/server.ts`** `createClient()` (RLS session) — lecture profil + update settings + rpc deletion (self-service auth.uid).
- **`lib/supabase/admin.ts`** `createAdminClient()` — cron uniquement (`auth.admin.deleteUser` + insert log + select).
- **`lib/auth/require-comod.ts`** (1.8) — pattern exact pour `require-resident.ts`.
- **`app/auth/signout/route.ts`** (1.6) — POST `?scope=local|global`, **réutilisé tel quel** (D6).
- **`app/[locale]/comod/admission/actions.ts`** (1.8) — shape `Result`/`DecisionState`, mapping erreurs, mocks Vitest (`vi.mock` admin/session/require).
- **`app/auth/confirm/route.ts`** (1.6) — hook `markAdmissionEmailVerified` montre où insérer le guard `isAccountDeleted` (avant `resolveRedirect`).
- **`lib/logger.ts`** stripPII ; **`lib/env.ts`** `env.server.CRON_SECRET` ; **`PageContainer`** ; **`components/ui/{checkbox,button,card,input,label}`** (button a une variante `destructive`).
- **Tokens v2** : `bg-bg-page/card/soft`, `bg-danger #D45B4A` (destructif uniquement), `bg-accent-500`, `text-neutral-*`, `min-h-touch`, `radius 14px`, `shadow-xs`.

### Latest Tech Information (juin 2026)

- **`supabase.auth.admin.deleteUser(id)`** : supprime `auth.users` → **cascade FK** `public.users` (on delete cascade) → `profiles`/`admission_requests`/`notifications_prefs` (cascade) + `moderation_log.actor_id`/`deleted_by` (set null). Un seul appel purge + anonymise. Idempotent si l'id n'existe plus (erreur 404 à catcher).
- **`supabase.auth.signOut({ scope: 'global' })`** : révoque tous les refresh tokens de l'utilisateur (toutes sessions/devices). `scope:'local'` = device courant. Déjà câblé dans `/auth/signout`.
- **`request_account_deletion()` SECURITY DEFINER + `grant execute to authenticated`** : appelée via `supabase.rpc('request_account_deletion')` avec le client **session** → `auth.uid()` est l'utilisateur courant (self-service sûr, pas d'admin client). Retourne `void` → `{ data: null, error }`.
- **`ALTER TYPE ... ADD VALUE`** (PG15) : non utilisable dans la même transaction que sa création ; ici consommé au runtime cron (OK). `if not exists` rend la migration ré-exécutable.
- **Vercel Cron** : configuré dans `vercel.json` `"crons"` (path + schedule cron) ; Vercel injecte `Authorization: Bearer ${CRON_SECRET}` automatiquement si `CRON_SECRET` est en env. Free tier : crons quotidiens OK.

### Previous Story Intelligence

- **1.8 (review)** : `require-comod.ts` (pattern garde), RPC SECURITY DEFINER + `admin.rpc`, mapping erreurs par message, mocks Vitest, **segment littéral vs route group** (collision build — appliqué ici D4), drift-visibility logging. `scripts/grant-comod.ts` préfigure le `scripts/invite-co-mods.ts` de 1.10 (AR34) — **convergence à noter pour 1.10** (ne pas dupliquer).
- **1.7 (done)** : `admission_requests` soft-delete columns + `markAdmissionEmailVerified` (montre l'insertion du guard dans confirm route). Docker down → patch manuel `types.generated.ts`.
- **1.6 (done)** : `/auth/signout` (réutilisé), `resolveRedirect` (`accepted → /community/` — ce chemin est créé ici), `createAdminClient`, `detect-locale`.
- **1.3 (done)** : FK cascade + column grants + `moderation_action` enum + soft-delete columns — **fondation de toute la cascade RGPD**.

### Hors-scope (NE PAS livrer)

| Élément                                                    | Story                                    |
| ---------------------------------------------------------- | ---------------------------------------- |
| Dashboard 3 tuiles Annuaire/Alertes/Guide                  | epics 2-4 (1.9 = home placeholder)       |
| UI complète 3 toggles notifications                        | 7.1 (1.9 = stubs lecture seule)          |
| Bascule langue header + routing AR actif                   | 7.4 (1.9 = persiste `profiles.language`) |
| Export RGPD JSON self-service                              | 8.3                                      |
| Rate-limit / headers / backup / ADRs / `invite-co-mods.ts` | 1.10                                     |
| Role-gating community (exclure demandeur)                  | 1.10/epic2                               |
| Page d'erreur « compte supprimé » dédiée                   | différé (AC7 redirige `/`)               |
| Tests E2E Playwright                                       | V1.5                                     |

> **Anti-scope-bleed** : si une task déborde → **arrêter et demander** (leçon 1.5/1.6). 1.9 reste sur **profil + paramètres + suppression RGPD + déconnexion + cron purge**.

### Risques connus 1.9

| Risque                                             | Mitigation 1.9                                             | Long terme       |
| -------------------------------------------------- | ---------------------------------------------------------- | ---------------- |
| Compte soft-deleted se reconnecte pendant la grâce | Guard `isAccountDeleted` dans confirm (AC7)                | —                |
| Cron purge échoue partiellement                    | `try/catch` par compte + log `count`                       | retry/alert 1.10 |
| `auth.admin.deleteUser` 404 (déjà purgé)           | catcher l'erreur, continuer                                | —                |
| `purge_completed` non régénéré dans types          | patch manuel + `gen:types` à relancer                      | —                |
| Demandeur accède à `/community/profil`             | acceptable MVP (voit son propre profil) ; role-gating 1.10 | —                |
| Phrase `SUPPRIMER` tapée par erreur                | bouton désactivé + double-belt Zod serveur                 | —                |
| `/community/` exposé avant les features epics 2-4  | home placeholder explicite « arrive bientôt »              | —                |

### References

- **Epic 1.9** : [Source: epics.md:756-792] · **1.10 (aval, `invite-co-mods.ts` AR34)** : epics.md:840
- **users/profiles/notifications_prefs grants + RLS** : [Source: `init_rls.sql:53-78, 91-123, 193-204`]
- **FK on delete cascade/set null** : [Source: `init_schema.sql:31, 51, 72, 80, 107, 115, 128`]
- **`profiles.identity_mode`/`language` CHECK** : [Source: `init_schema.sql:55-57`]
- **`moderation_action` enum (sans purge_completed)** : [Source: `init_enums.sql:33-40`]
- **`request_account_deletion`/`purge_completed` : à créer** (aucune fonction deletion/anonymize/purge n'existe)
- **signout existant** : [Source: `app/auth/signout/route.ts`] · **i18n signout** : `messages/fr.json` `auth.common.signOut*`
- **confirm route (pas de deleted_at check)** : [Source: `app/auth/confirm/route.ts`] · **resolveRedirect → /community/** : `lib/auth/redirect-by-state.ts:49`
- **CRON_SECRET** : [Source: `lib/env.ts:17`] · **vercel.json (pas de crons)** : `vercel.json`
- **AR10/NFR18/AR39/Result/Zod/logger** : [Source: architecture.md:1430-1437, 299, 1037, 494-501, 560, 525-539]
- **UX : danger token / ConfirmDialog / destructif-only / opt-in identité / Settings top-right / Voisin supprimé** : [Source: ux-design-specification.md:655, 490, 1010, 1215, 927, 158, 167, 1260; epics.md:774]
- **MVP FR-only / archi / UX** : [[project_darna_mvp_fr_only]] [[project_darna_arch_complete]] [[project_darna_ux_complete]]
- **Supabase admin.deleteUser** : https://supabase.com/docs/reference/javascript/auth-admin-deleteuser · **signOut scope** : https://supabase.com/docs/reference/javascript/auth-signout · **Vercel Cron** : https://vercel.com/docs/cron-jobs
- **Deferred-work index** : `_bmad-output/implementation-artifacts/deferred-work.md`

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `bmad-dev-story`.

### Debug Log References

- `pnpm typecheck` ✅ 0 erreur.
- `pnpm lint` ✅ 0 erreur / 0 warning.
- `pnpm test` ✅ **157 passed / 5 skipped** (+23 vs 1.8=134) : profile validation 7, profile-actions 7, is-account-deleted 4, cron purge-expired 5.
- `pnpm build` ✅ — `/[locale]/community`, `/community/profil`, `/community/profil/parametres`, `/community/profil/supprimer`, `/api/cron/purge-expired` tous `ƒ (Dynamic)`.
- Smoke HTTP prod (port 3019) : `/fr/community` non-auth → **307 → /fr/admission** (proxy) ; `/api/cron/purge-expired` sans Bearer **401**, mauvais Bearer **401** (AR39).

### Completion Notes List

- **T1 — Migration `account_deletion.sql`** : `alter type ... add value if not exists 'purge_completed'` + `request_account_deletion()` SECURITY DEFINER (auth.uid, soft-delete users+profiles, `display_name='Voisin supprimé'`, log `user_deleted`), `grant execute to authenticated` (self-service, **pas d'admin client** côté action utilisateur). `types.generated.ts` patché **manuellement** (Docker down — `+purge_completed` enum, `+request_account_deletion` Functions) ; **à régénérer `pnpm gen:types -- linked`**.
- **T2 — Shell community** : `lib/auth/require-resident.ts` (garde session, ne gate pas le rôle), `community/layout.tsx` (garde + header lien Settings) + `community/page.tsx` (home placeholder `force-dynamic`) → **résout le 404 `/community/` post-accept de 1.8**. Segment **littéral** `community` (leçon collision 1.8).
- **T3 — `lib/validation/profile.ts`** : `zProfileSettings` (miroir CHECK DB), `DELETE_CONFIRM_PHRASE='SUPPRIMER'` (D2), `zDeleteAccount`. 7 tests.
- **T4 — Page profil** : lecture `users`/`profiles`/`notifications_prefs` (3 reads parallèles, client SSR session RLS), e-mail read-only via `getUser()`, stubs notifs lecture seule, skeleton `loading.tsx`.
- **T5 — Paramètres + `updateProfileSettings`** : `<Checkbox>` Radix existant pour la visibilité (**D7 : pas de react-switch**) + `<select>` langue ; Server Action **session client** `profiles.update(...).eq('user_id')` (RLS self + column-grant), Zod, `router.refresh()` + message « enregistrées ».
- **T6 — Suppression + `deleteAccount`** : Danger Zone (`bg-danger`), input phrase `SUPPRIMER` (bouton destructive désactivé tant que ≠), Server Action → `rpc('request_account_deletion')` (session, auth.uid) → `signOut({scope:'global'})` → redirect `/`. **D1 : pas de `auth.admin.deleteUser` immédiat** (purge dure J+7 par le cron).
- **T7 — `signout-buttons.tsx`** : 2 `<form method=post>` vers `/auth/signout?scope=local|global` — **réutilise la route 1.6 telle quelle** (D6), zéro modif, zéro JS.
- **T8 — Guard re-login** : `lib/auth/is-account-deleted.ts` (admin, fail-open) + hook dans `app/auth/confirm/route.ts` **avant** `resolveRedirect` → si soft-deleted : `signOut global` + redirect `/`. Variance minimale 1.6 (D3).
- **T9 — Cron `app/api/cron/purge-expired/route.ts`** : Bearer `CRON_SECRET` (401 sinon), `users` soft-deleted >7j → par compte : insert `moderation_log 'purge_completed'` (avant) + `auth.admin.deleteUser` (cascade FK), batch resilient (`try/catch` par id), log `count`. `vercel.json` : `crons` `0 3 * * *`.
- **T10 — i18n** : `community.*`, `profil.*` (+ `settings`, `delete`), `errors.profil.*`, `errors.cron.*` FR ; stubs AR vides (fallback FR). `confirmLabel` ICU `{phrase}`. JSON validés.
- **T11 — Tests** : +23, 0 régression (1.7/1.8 verts, `resolveRedirect`/signout inchangés). Mocks `require-resident`/`supabase.server`/`supabase.admin`/`env`/`logger`.
- **T12 — Validation E2E** : gates + smoke verts. **E2E complète (RPC réelle, purge antidatée, re-login guard, signout multi-device) DIFFÉRÉE** pré-bêta (Docker down → pas de session/RPC réelle). **Avant merge prod** : `supabase db push` (migration), `pnpm gen:types -- linked`, configurer `CRON_SECRET` Vercel, dérouler AC12.
- **Note convergence 1.10** : `scripts/grant-comod.ts` (1.8) ⇄ `scripts/invite-co-mods.ts` prévu 1.10 (AR34) — à fusionner là-bas.

### File List

**NEW**

- `supabase/migrations/20260617090000_account_deletion.sql`
- `lib/auth/require-resident.ts`
- `lib/auth/is-account-deleted.ts`
- `lib/validation/profile.ts`
- `lib/validation/profile.test.ts`
- `app/[locale]/community/layout.tsx`
- `app/[locale]/community/page.tsx`
- `app/[locale]/community/profil/page.tsx`
- `app/[locale]/community/profil/loading.tsx`
- `app/[locale]/community/profil/actions.ts`
- `app/[locale]/community/profil/parametres/page.tsx`
- `app/[locale]/community/profil/supprimer/page.tsx`
- `app/[locale]/community/profil/_components/signout-buttons.tsx`
- `app/[locale]/community/profil/_components/settings-form.tsx`
- `app/[locale]/community/profil/_components/delete-account-form.tsx`
- `app/api/cron/purge-expired/route.ts`
- `tests/profil/profile-actions.test.ts`
- `tests/auth/is-account-deleted.test.ts`
- `tests/cron/purge-expired.test.ts`

**MODIFIED**

- `lib/supabase/types.generated.ts` (+`purge_completed` enum, +`request_account_deletion` Functions — patch manuel, à régénérer)
- `app/auth/confirm/route.ts` (+import + guard `isAccountDeleted` avant `resolveRedirect`)
- `vercel.json` (+`crons` purge-expired 03:00 UTC)
- `messages/fr.json` (+`community.*`, `profil.*`, `errors.profil.*`, `errors.cron.*`)
- `messages/ar.json` (+mêmes clés en stubs vides — fallback FR)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-9 `ready-for-dev` → `in-progress` → `review`)

### Change Log

- **2026-06-15** — Implémentation `bmad-dev-story` (Opus 4.8, 1M context). 12/12 tâches livrées : migration `request_account_deletion` SECURITY DEFINER + enum `purge_completed`, shell community (require-resident + layout + home placeholder, résout le 404 post-accept 1.8), Zod profil, page profil + paramètres (visibilité Checkbox + langue, RLS session) + suppression (Danger Zone phrase `SUPPRIMER` → soft-delete + signout global, D1), boutons signout (réutilise route 1.6), guard re-login `isAccountDeleted` dans confirm, cron `purge-expired` (Bearer CRON_SECRET, purge dure J+7 cascade FK) + `vercel.json` crons, i18n FR + stubs AR, +23 tests (157 passed). `typecheck/lint/test/build` + smoke verts (community 307, cron 401). **E2E réelle (RPC/purge/re-login) différée** pré-bêta (Docker down). Status : `review`.
- **2026-06-15** — Story créée par `bmad-create-story` (Opus 4.8, 1M context). Analyse exhaustive via 4 sous-agents parallèles : schéma+RLS (FK cascade/set-null, grants users/profiles, enum `moderation_action` sans `purge_completed`, `identity_mode`/`language` existants, tables epics 2-4 absentes), architecture (AR10 anonymisation, NFR18 J+7, AR39 cron Bearer, deleteAccount flow), code existant (**signout déjà livré**, `/community/` 404, pas de cron/api, confirm sans check deleted_at, CRON_SECRET, PageContainer, ui components), UX (Danger Zone, phrase tapée, danger token, ConfirmDialog, opt-in identité, Voisin supprimé). **7 décisions** : D1 soft-delete+purge J+7 (vs hard-delete immédiat), D2 phrase `SUPPRIMER`, D3 guard re-login, D4 shell community minimal (segment littéral), D5 enum `purge_completed`, D6 réutilise signout, D7 pas de react-switch. Status : `ready-for-dev`.

### Review Findings

- [x] [Review][Patch] SQL `request_account_deletion()` : `INSERT moderation_log` non-idempotent — un 2e appel (double-tab, retry) insère une 2e entrée `user_deleted` car pas de garde `AND deleted_at IS NULL` sur le SELECT [`supabase/migrations/20260617090000_account_deletion.sql:51`]
- [x] [Review][Patch] `deleteAccount` action : `signOut` appelé sans capturer l'erreur retournée — si signOut échoue, l'action retourne `{ ok:true }` mais la session reste active sur un compte soft-deleted [`app/[locale]/community/profil/actions.ts:101`]
- [x] [Review][Patch] `confirm/route.ts` : `signOut` dans la branche `isAccountDeleted` non vérifié — même problème : session peut rester valide si signOut fail [`app/auth/confirm/route.ts:96`]
- [x] [Review][Patch] Cron : `moderation_log.insert()` return non vérifié — si insert échoue, `deleteUser` s'exécute quand même → purge dure sans trace d'audit (NFR55 / AC8) [`app/api/cron/purge-expired/route.ts:52`]
- [x] [Review][Patch] Cron 500 : mauvaise `message_key: 'errors.cron.unauthorized'` pour une query failure — clé sémantiquement fausse ; ajouter `errors.cron.query_failed` ou supprimer le `message_key` du body 500 [`app/api/cron/purge-expired/route.ts:43`]
- [x] [Review][Patch] `updateProfileSettings` : update silencieusement no-op si la ligne `profiles` n'existe pas — retourne `{ok:true}` sans qu'aucune donnée soit écrite [`app/[locale]/community/profil/actions.ts:37`]
- [x] [Review][Patch] `settings-form.tsx` : `save()` pas gardé sur `isPending` — deux changements rapides (checkbox + select) envoient 2 appels Server Action concurrents avec capture de closure potentiellement stale [`app/[locale]/community/profil/_components/settings-form.tsx:26`]
- [x] [Review][Patch] `message_key.replace('errors.profil.', '')` sans guard `startsWith` dans settings-form.tsx et delete-account-form.tsx — si clé future ne commence pas par le préfixe, `tErr()` reçoit la clé brute [`settings-form.tsx:39`, `delete-account-form.tsx:34`]
- [x] [Review][Patch] Test manquant : `updateProfileSettings` quand la DB retourne une erreur — branche error path non couverte [`tests/profil/profile-actions.test.ts`]
- [x] [Review][Patch] Test manquant : `deleteAccount` quand le RPC retourne une erreur — branche `rpc failed` non testée [`tests/profil/profile-actions.test.ts`]
- [x] [Review][Defer] `isAccountDeleted` fail-open (retourne `false` sur erreur DB) — décision spec documentée (cohérent `markAdmissionEmailVerified` 1.7), acceptable MVP [`lib/auth/is-account-deleted.ts:17`] — deferred, design intent
- [x] [Review][Defer] Cron : pas de pagination — `select` ramène tous les comptes expirés en mémoire ; pas un problème à 150 villas MVP [`app/api/cron/purge-expired/route.ts:26`] — deferred, scale concern
- [x] [Review][Defer] Cron : pas de protection anti-replay (stolen CRON_SECRET) — modèle CRON_SECRET standard Vercel ; mitigé par Vercel env isolation — deferred, opérationnel
- [x] [Review][Defer] `profil/parametres/page.tsx` utilise `supabase.auth.getUser()` brut au lieu de `requireResident()` — le layout couvre la défense en profondeur ; fonctionnellement équivalent — deferred, style
- [x] [Review][Defer] `requireResident()` ne vérifie pas `deleted_at` — un utilisateur soft-deleted avec JWT encore valide passerait la garde ; adressé par `signOut({scope:'global'})` dans deleteAccount (P2) — deferred, JWT TTL window acceptable
