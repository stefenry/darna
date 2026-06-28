-- Story 8.3 / 8.4 — provisionner le bucket privé `darna-exports`.
--
-- Les exports RGPD résident (8.3) et journal modération co_mod (8.4) sont uploadés
-- dans Supabase Storage (URL signée 24h). R2 (AC) n'est pas provisionné au MVP
-- (env `R2_*` optionnels) → même choix que le bucket `legal-dossiers` (5.5).
--
-- `public=false` : accès uniquement via URL signée générée côté serveur (client
-- admin service-role, qui bypasse la RLS Storage). Aucune policy `storage.objects`
-- nécessaire. Une lifecycle policy purge les objets > 24h (à configurer côté
-- Supabase Storage / R2 en prod ; documenté dans le runbook §6).

insert into storage.buckets (id, name, public)
values ('darna-exports', 'darna-exports', false)
on conflict (id) do nothing;
