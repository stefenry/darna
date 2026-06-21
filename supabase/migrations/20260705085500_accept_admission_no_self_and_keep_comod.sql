-- Bugs trouvés au test E2E staging (2026-06-21) :
--
-- 1. `accept_admission` permettait au co_mod de valider sa PROPRE demande
--    d'admission — équivalent à un self-validate (interdit par l'esprit de la
--    modération horizontale, AR principe «un co-mod ne décide pas seul de son
--    propre cas»). On bloque par exception `self_validation`.
--
-- 2. Même si la garde 1 saute (cas non testé : co_mod déjà accepté demandant
--    de nouveau pour une autre villa), le UPDATE `set role = 'resident'`
--    dégradait silencieusement un co_mod en simple résident. On garde le
--    rôle au moins co_mod via greatest-priority CASE.
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
  -- Fix #1 — anti self-validation : un co_mod ne valide pas sa propre demande.
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

  -- Fix #2 — ne JAMAIS dégrader un co_mod en resident. Si le user demandeur
  -- était déjà co_mod (rare mais possible : co_mod ayant soumis une demande
  -- avant son onboarding bootstrap), on conserve son rôle co_mod.
  update public.users
     set role = case when role = 'co_mod' then 'co_mod' else 'resident' end,
         updated_at = now()
   where id = v_req.user_id;

  insert into public.moderation_log
    (residence_id, actor_id, action, target_kind, target_id)
  values
    (v_req.residence_id, p_actor_id, 'admission_accepted', 'admission_request', p_admission_id);

  return query select v_req.user_id, v_req.villa, v_req.residence_id;
end;
$$;

-- Grants identiques à la migration originale (idempotent).
revoke execute on function public.accept_admission(uuid, uuid) from public;
grant execute on function public.accept_admission(uuid, uuid) to service_role;
