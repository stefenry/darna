-- Ops/infra — grants de base explicites (parité stack locale ↔ Supabase Cloud).
--
-- CONTEXTE. Le DML de base des rôles PostgREST (anon, authenticated,
-- service_role) provient normalement des DEFAULT PRIVILEGES de la plateforme
-- Supabase, appliqués HORS migration. La stack CLI locale ne les applique pas →
-- ces rôles n'avaient, sur les tables `public`, que REFERENCES/TRIGGER/TRUNCATE
-- (aucun SELECT/INSERT/UPDATE/DELETE de base). Effet en LOCAL : les lectures
-- `authenticated` de l'app ET la suite `tests/rls.test.ts` (helpers service_role)
-- renvoyaient `42501 permission denied`. Découvert en lançant `pnpm test:rls`
-- pour la 1re fois (suite toujours gated/skip → jamais exécutée).
--
-- AUCUN IMPACT PROD. En Cloud ces grants existent déjà → migration IDEMPOTENTE
-- (n'ajoute que des privilèges déjà acquis, n'en retire AUCUN).
--
-- PRINCIPE DE PRÉCISION (corrige une 1re version trop large) : on n'accorde QUE
-- le strict nécessaire, sans jamais perturber la sécurité column-level :
--   - service_role (admin server-only, jamais exposé client) → DML complet ;
--   - authenticated / anon → SEULEMENT le SELECT de base manquant. On ne touche
--     PAS à leur INSERT/UPDATE/DELETE → les GRANT column-level (artisans/ratings,
--     migration 2.1) et les REVOKE existants restent intacts.

-- service_role : parité Cloud (BYPASSRLS + DML complet).
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;

-- authenticated / anon : uniquement le SELECT de base (RLS reste la garde).
grant select on all tables in schema public to authenticated, anon;

-- Tables/séquences futures : même posture (sans toucher aux écritures
-- authenticated, gérées au cas par cas par les migrations de feature).
alter default privileges in schema public
  grant select on tables to authenticated, anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select, update on sequences to service_role;
