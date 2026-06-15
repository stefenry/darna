# lib/supabase/

Clients Supabase (server / client / middleware) livrés par le starter officiel `with-supabase`, étendus avec :

- **types générés** (`types.generated.ts`) — output de `pnpm gen:types`, snake_case end-to-end (AR8, AR20). **Versionné** dans git.
- **clients typés** (`<Database>`) — `createBrowserClient<Database>(...)`, `createServerClient<Database>(...)`.
- **AR3 nouvelles clés Supabase** — `sb_publishable_*` / `sb_secret_*` validées par `lib/env.ts` au module-load.

## Workflow local-first

```bash
# Prérequis : Docker Desktop (ou Colima) en marche.
pnpm supabase start          # boot Postgres + Auth + Storage (~30s première fois)

# Quand on modifie le schéma :
pnpm supabase migration new <name>   # crée supabase/migrations/<ts>_<name>.sql
# … édition SQL …
pnpm supabase db reset       # drop + replay des migrations (idempotent)
pnpm gen:types               # régénère lib/supabase/types.generated.ts
pnpm typecheck               # vérifie que les types matchent
git add supabase/migrations/ lib/supabase/types.generated.ts
git commit -m "feat(db): <name>"

# Stop la stack quand on a fini :
pnpm supabase stop
```

## Production deploy

Tag `release-vX.Y` → `.github/workflows/release.yml` (Story 1.2) exécute `npx supabase db push --linked` → migrations appliquées sur Supabase Cloud EU. Secrets GitHub requis : `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`.

## Bridge `public.users ↔ auth.users`

`public.users.id` est `uuid references auth.users(id) on delete cascade`. Un trigger DB-side `trg_auth_users_after_insert` provisionne automatiquement `public.users` + `public.notifications_prefs` (defaults FR40) quand un user est créé via `supabase.auth.admin.createUser()` ou magic-link.

**Custom claims JWT** (`app_metadata.role`, `app_metadata.residence_id`) : peuplés via `supabase.auth.admin.updateUserById()` côté service role lors de validation admission (Story 1.8). MVP mono-résidence : `residence_id` figé à l'UUID stable de Darna (`00000000-0000-0000-0000-000000000001`). En V3 multi-tenant : extraire de l'admission_request avant `updateUserById`.

## RLS

4 rôles : `resident`, `co_mod`, `demandeur`, `public`. Naming strict `<table>_<role>_<action>` (cf. `supabase/migrations/*_init_rls.sql`). Exception : `moderation_log` lecture publique (FR33 transparence radicale), writes système via fonctions `SECURITY DEFINER` (Story 1.8+).

Tests RLS exhaustifs (alice / bob / eve × 7 tables) : Story 1.10 (Gap #7, ADR 0008). Test minimal local : `tests/rls.test.ts` (skip si `SUPABASE_LOCAL_TEST != 'true'`).

## Voir aussi

- `_bmad-output/planning-artifacts/architecture.md#Data-Architecture` — conventions complètes (AR8, AR20)
- `_bmad-output/planning-artifacts/architecture.md#Implementation-Patterns-Consistency-Rules` — naming AR15
- `supabase/migrations/` — DDL versionnée
- `docs/adr/` — ADRs (variances tooling)
