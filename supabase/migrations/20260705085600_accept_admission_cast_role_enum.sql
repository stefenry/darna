-- Hotfix de la migration 20260705085500 : le CASE retournait un text littéral,
-- mais public.users.role est de type enum user_role. Postgres ne fait pas le
-- cast implicite → toute validation d'admission échoue avec :
--   "column 'role' is of type user_role but expression is of type text"
-- Fix : cast explicite ::user_role.
--
-- Idempotent (CREATE OR REPLACE). Pas de DROP : signature et grants identiques.

create or replace function public.accept_admission(
  p_admission_id uuid,
  p_actor_id     uuid
)
returns table (requester_user_id uuid, villa int, residence_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req   public.admission_requests;
  v_actor public.users;
begin
  select * into v_actor from public.users where id = p_actor_id;
  if v_actor.id is null or v_actor.role <> 'co_mod' then
    raise exception 'not_co_mod';
  end if;

  select * into v_req from public.admission_requests
    where id = p_admission_id and deleted_at is null
    for update;
  if v_req.id is null then
    raise exception 'not_found';
  end if;
  if v_req.residence_id <> v_actor.residence_id or v_actor.residence_id is null then
    raise exception 'wrong_residence';
  end if;
  if v_req.state <> 'pending' then
    raise exception 'already_decided';
  end if;
  if v_req.user_id = p_actor_id then
    raise exception 'self_validation';
  end if;

  update public.admission_requests
     set state = 'accepted',
         decision_reason = null,
         decided_by = p_actor_id,
         decided_at = now(),
         updated_at = now()
   where id = p_admission_id;

  -- Cast explicite ::user_role pour que Postgres accepte le CASE (qui sinon
  -- résout en text).
  update public.users
     set role = (case when role = 'co_mod' then 'co_mod' else 'resident' end)::user_role,
         updated_at = now()
   where id = v_req.user_id;

  insert into public.moderation_log
    (residence_id, actor_id, action, target_kind, target_id)
  values
    (v_req.residence_id, p_actor_id, 'admission_accepted', 'admission_request', p_admission_id);

  return query select v_req.user_id, v_req.villa, v_req.residence_id;
end;
$$;

revoke execute on function public.accept_admission(uuid, uuid) from public;
grant execute on function public.accept_admission(uuid, uuid) to service_role;
