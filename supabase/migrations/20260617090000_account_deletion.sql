-- Story 1.9 — Suppression de compte RGPD (self-service) + audit purge.
--
-- Modèle (D1) : soft-delete immédiat sur demande utilisateur, purge dure
-- (auth.admin.deleteUser → cascade FK) à J+7 via le cron app/api/cron/purge-expired.
-- Cohérent NFR18 (« soft-delete immédiat · purge dure à J+7 ») + la copie utilisateur
-- (« purgées sous 7 jours »).
--
-- 1) Ajoute la valeur d'enum `purge_completed` (l'epic exige que moderation_log
--    trace la purge ; l'enum moderation_action ne l'avait pas). Additif, PG15+.
--    Consommée uniquement au runtime cron (jamais dans cette migration), donc OK
--    même si la migration tourne en transaction.
alter type public.moderation_action add value if not exists 'purge_completed';

-- 2) Fonction self-service de demande de suppression. SECURITY DEFINER car
--    users.deleted_at/deletion_reason ne sont pas grantables à authenticated
--    (init_rls.sql:76-78) et moderation_log n'a pas de policy INSERT. Utilise
--    auth.uid() en interne → un utilisateur ne peut supprimer QUE son propre
--    compte (grant execute to authenticated, appel via client session).
create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Soft-delete users : marquage immédiat + anonymisation du display_name
  -- (mention « Voisin supprimé », AR10 / epics.md:774).
  update public.users
     set deleted_at = coalesce(deleted_at, now()),
         deletion_reason = 'self_service_rgpd',
         display_name = 'Voisin supprimé',
         updated_at = now()
   where id = v_uid and deleted_at is null;

  -- Soft-delete profiles (la cascade dure suivra via FK quand l'auth user
  -- sera purgé à J+7).
  update public.profiles
     set deleted_at = coalesce(deleted_at, now()),
         deletion_reason = 'self_service_rgpd',
         updated_at = now()
   where user_id = v_uid and deleted_at is null;

  -- Trace publique anonymisée (transparence FR33). actor_id sera SET NULL au
  -- purge dur (FK on delete set null) → la trace devient anonyme.
  -- Guard idempotence : n'insère qu'une seule entrée user_deleted par utilisateur
  -- (un 2e appel sur un compte déjà soft-deleted ne doit pas créer un doublon).
  insert into public.moderation_log
    (residence_id, actor_id, action, target_kind, target_id)
  select residence_id, v_uid, 'user_deleted', 'user', v_uid
    from public.users
   where id = v_uid
     and not exists (
       select 1 from public.moderation_log
        where action = 'user_deleted'
          and target_id = v_uid
          and target_kind = 'user'
     );
end;
$$;

revoke execute on function public.request_account_deletion() from public;
grant execute on function public.request_account_deletion() to authenticated;
