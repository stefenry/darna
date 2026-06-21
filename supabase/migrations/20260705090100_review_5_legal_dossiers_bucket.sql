-- Review Epic 5 (mineur 5.5) — provisionner le bucket privé `legal-dossiers`.
--
-- Le dossier d'escalade juridique (5.5) est uploadé dans Supabase Storage (bucket
-- privé, URL signée 30j). Jusqu'ici le bucket était créé à l'exécution
-- (`createBucket` à chaque escalade) → 1re escalade plus lente + dépendance au
-- droit createBucket du service-role. On le provisionne ici une fois pour toutes.
--
-- `public=false` : accès uniquement via URL signée générée côté serveur (client
-- admin service-role). Aucune policy `storage.objects` nécessaire — le flux
-- upload/sign passe par le service-role, qui bypasse la RLS Storage.

insert into storage.buckets (id, name, public)
values ('legal-dossiers', 'legal-dossiers', false)
on conflict (id) do nothing;
