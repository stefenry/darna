-- Bug latent trouvé en bêta 2026-06-22 (compte test Stephane) :
-- `accept_admission` RPC promeut le demandeur en `resident` côté
-- public.users, mais ne crée JAMAIS la row public.profiles (qui contient
-- villa, tranche, language, identity_mode). Conséquence : tout
-- UPDATE profiles depuis le SettingsForm matche 0 row → les modifs ne
-- sont jamais persistées. Le profil reste vide silencieusement.
--
-- Fix :
--   1. accept_admission INSERT profiles à partir des données du demande
--      (villa, tranche déjà saisies à l'admission). ON CONFLICT pour
--      idempotence (rare cas re-validation).
--   2. Backfill : pour tous les role='resident' qui n'ont pas de profile,
--      reconstruire depuis admission_requests.accepted la plus récente.

-- ─── Fix RPC ───────────────────────────────────────────────────────────────
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

  update public.users
     set role = (case when role = 'co_mod' then 'co_mod' else 'resident' end)::user_role,
         updated_at = now()
   where id = v_req.user_id;

  -- 2026-06-22 — Fix : créer la row profiles à partir des données du demande.
  -- ON CONFLICT (user_id) update villa/tranche pour le cas (rare) d'une
  -- 2e admission acceptée (changement de villa).
  insert into public.profiles (user_id, residence_id, villa, tranche)
  values (v_req.user_id, v_req.residence_id, v_req.villa, v_req.tranche)
  on conflict (user_id) do update
    set villa = excluded.villa,
        tranche = excluded.tranche,
        updated_at = now();

  insert into public.moderation_log
    (residence_id, actor_id, action, target_kind, target_id)
  values
    (v_req.residence_id, p_actor_id, 'admission_accepted', 'admission_request', p_admission_id);

  return query select v_req.user_id, v_req.villa, v_req.residence_id;
end;
$$;

revoke execute on function public.accept_admission(uuid, uuid) from public;
grant execute on function public.accept_admission(uuid, uuid) to service_role;

-- ─── Backfill : profiles manquants pour résidents existants ────────────────
-- Pour chaque user role='resident' sans profile, récupère la villa/tranche
-- depuis la dernière admission_request acceptée et insert la row.
insert into public.profiles (user_id, residence_id, villa, tranche)
select distinct on (u.id)
  u.id, u.residence_id, ar.villa, ar.tranche
from public.users u
join public.admission_requests ar on ar.user_id = u.id and ar.state = 'accepted'
left join public.profiles p on p.user_id = u.id
where u.role in ('resident', 'co_mod')
  and p.user_id is null
  and u.deleted_at is null
order by u.id, ar.created_at desc
on conflict (user_id) do nothing;
