-- Retrait d'un résident par un co_mod (spec docs/superpowers/specs/
-- 2026-07-21-comod-remove-resident-design.md).
--
-- Réutilise le pipeline de request_account_deletion (20260617090000, ADR 0006) :
-- soft-delete immédiat + anonymisation, purge dure J+7 par le cron purge-expired,
-- blocage re-login via isAccountDeleted. Différences : un acteur (le co_mod) est
-- tracé (deleted_by, moderation_log.actor_id) et un motif court est journalisé.
--
-- SECURITY DEFINER + appel via client SESSION : les gardes vivent en SQL
-- (auth_role()/auth_residence_id() lisent le JWT) → testable dans tests/rls.test.ts,
-- et un résident qui forge l'appel est rejeté par la fonction elle-même.
--
-- Codes d'erreur (RAISE EXCEPTION, mappés dans app/[locale]/comod/residents/
-- actions.ts) : forbidden, invalid_reason, invalid, cross_residence,
-- target_not_resident, already_deleted.
create or replace function public.comod_remove_resident(
  p_target_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_target public.users%rowtype;
begin
  if v_uid is null or auth_role() <> 'co_mod' then
    raise exception 'forbidden';
  end if;

  if v_reason = '' or char_length(v_reason) > 200 then
    raise exception 'invalid_reason';
  end if;

  select * into v_target from public.users where id = p_target_user_id;
  if not found then
    raise exception 'invalid';
  end if;
  if v_target.residence_id is distinct from auth_residence_id() then
    raise exception 'cross_residence';
  end if;
  if v_target.deleted_at is not null then
    raise exception 'already_deleted';
  end if;
  -- Un co_mod ne se retire pas via l'app (rétrogradation script-only, asymétrie
  -- assumée cf. promoteToComod) — couvre aussi l'auto-suppression de l'appelant.
  if v_target.role <> 'resident' then
    raise exception 'target_not_resident';
  end if;

  -- Soft-delete users : mêmes écritures que request_account_deletion, plus
  -- deleted_by (acteur co_mod) et un deletion_reason dédié.
  update public.users
     set deleted_at = now(),
         deleted_by = v_uid,
         deletion_reason = 'removed_by_comod',
         display_name = 'Voisin supprimé',
         updated_at = now()
   where id = p_target_user_id
     and deleted_at is null;

  -- Soft-delete profiles miroir (la cascade dure suivra à la purge J+7).
  update public.profiles
     set deleted_at = coalesce(deleted_at, now()),
         deleted_by = v_uid,
         deletion_reason = 'removed_by_comod',
         updated_at = now()
   where user_id = p_target_user_id
     and deleted_at is null;

  -- Trace publique (transparence FR33). reason_text_anonymized : motif saisi par
  -- le co_mod (l'UI rappelle de ne pas y mettre de données personnelles).
  -- Guard idempotence identique au flux RGPD : une seule entrée user_deleted
  -- par utilisateur.
  insert into public.moderation_log
    (residence_id, actor_id, action, target_kind, target_id, reason_code, reason_text_anonymized)
  select residence_id, v_uid, 'user_deleted', 'user', id, 'removed_by_comod', v_reason
    from public.users
   where id = p_target_user_id
     and not exists (
       select 1 from public.moderation_log
        where action = 'user_deleted'
          and target_id = p_target_user_id
          and target_kind = 'user'
     );
end;
$$;

revoke execute on function public.comod_remove_resident(uuid, text) from public;
grant execute on function public.comod_remove_resident(uuid, text) to authenticated;
