-- Story 1.8 — Fonctions de décision d'admission (validation co-mod).
--
-- Deux fonctions SECURITY DEFINER qui exécutent ATOMIQUEMENT la transition
-- d'état d'une admission + l'écriture dans moderation_log (transparence E3/FR33)
-- + la promotion de rôle (accept). Justification du pattern RPC plutôt que des
-- appels séquentiels (story 1.8 D1) :
--   - moderation_log n'a AUCUNE policy INSERT (écriture system-only par design,
--     init_rls.sql:182-186) → une fonction définisseur est le chemin d'écriture
--     intentionnel ;
--   - users.role n'est PAS grantable à authenticated (init_rls.sql:76-78) ;
--   - le CHECK admission_requests_state_decision_check (init_schema.sql:89-94)
--     exige une transition cohérente (accepted ⇒ decision_reason NULL,
--     decided_by/at NOT NULL ; rejected ⇒ decision_reason NOT NULL).
--
-- Appelées UNIQUEMENT via l'admin client (service-role) côté Server Action
-- (app/[locale]/(comod)/admission/actions.ts). Le service-role mappe sur le
-- rôle Postgres `service_role` → `grant execute to service_role` seulement.
--
-- Discrimination d'erreur : on lève des exceptions avec un MESSAGE stable
-- (not_co_mod / not_found / wrong_residence / already_decided). PostgREST
-- surface ce message dans `error.message` côté JS — la Server Action mappe
-- sur un Result.error (pas de dépendance à un SQLSTATE custom, plus robuste).
--
-- Migration purement additive (2 fonctions, aucune table altérée).

-- ---------------------------------------------------------------------------
-- accept_admission : pending → accepted + promotion role resident + log.
-- ---------------------------------------------------------------------------
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
  -- Garde : l'acteur doit être un co_mod.
  select * into v_actor from public.users where id = p_actor_id;
  if v_actor.id is null or v_actor.role <> 'co_mod' then
    raise exception 'not_co_mod';
  end if;

  -- Verrou ligne + exigence d'état pending (anti double-validation, race 2 co-mods).
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

  update public.admission_requests
     set state = 'accepted',
         decision_reason = null,
         decided_by = p_actor_id,
         decided_at = now(),
         updated_at = now()
   where id = p_admission_id;

  update public.users
     set role = 'resident',
         updated_at = now()
   where id = v_req.user_id;

  insert into public.moderation_log
    (residence_id, actor_id, action, target_kind, target_id)
  values
    (v_req.residence_id, p_actor_id, 'admission_accepted', 'admission_request', p_admission_id);

  return query select v_req.user_id, v_req.villa, v_req.residence_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- reject_admission : pending → rejected + motif + log. PAS de promotion role
-- (le demandeur reste 'demandeur' et peut re-soumettre).
-- ---------------------------------------------------------------------------
create or replace function public.reject_admission(
  p_admission_id uuid,
  p_actor_id     uuid,
  p_reason       public.admission_decision_reason
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

  update public.admission_requests
     set state = 'rejected',
         decision_reason = p_reason,
         decided_by = p_actor_id,
         decided_at = now(),
         updated_at = now()
   where id = p_admission_id;

  insert into public.moderation_log
    (residence_id, actor_id, action, target_kind, target_id, reason_code)
  values
    (v_req.residence_id, p_actor_id, 'admission_rejected', 'admission_request', p_admission_id, p_reason::text);

  return query select v_req.user_id, v_req.villa, v_req.residence_id;
end;
$$;

-- Exécution réservée au service-role (admin client). Jamais exposée au client.
revoke execute on function public.accept_admission(uuid, uuid) from public;
revoke execute on function public.reject_admission(uuid, uuid, public.admission_decision_reason) from public;
grant execute on function public.accept_admission(uuid, uuid) to service_role;
grant execute on function public.reject_admission(uuid, uuid, public.admission_decision_reason) to service_role;
