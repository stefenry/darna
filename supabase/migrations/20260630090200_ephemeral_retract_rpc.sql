-- Story 4.3 (AC4) — RPC de retrait par l'AUTEUR de ses propres alertes / bons plans.
--
-- Miroir de `retract_own_rating` (2.7) + `retire_durable_entry` (3.5) : SECURITY
-- DEFINER, whitelist du kind (anti-injection table), garde d'appartenance
-- (created_by = auth.uid()), soft-delete atomique (UPDATE ... WHERE deleted_at IS
-- NULL RETURNING → idempotent + anti-race), trace moderation_log avec une action
-- DÉDIÉE (alert_self_retracted / tip_self_retracted) distincte du retrait co_mod
-- (transparence Epic 5 : action auteur ≠ action modération).
--
-- Le résident a le grant UPDATE(deleted_at,…) (3.1 pattern) donc pourrait soft-
-- delete via PostgREST, mais SANS écrire moderation_log (deny-all client). La RPC
-- est le SEUL chemin qui garantit l'audit → l'UI passe toujours par elle.

create or replace function public.retract_own_ephemeral(
  p_kind text,
  p_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
  v_action public.moderation_action;
  v_target_kind text;
  v_uid uuid := auth.uid();
  v_residence uuid;
  v_owner uuid;
  v_deleted timestamptz;
  v_updated_id uuid;
  v_reason text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- 1. Whitelist kind → table + action (anti-injection).
  if p_kind = 'alert' then
    v_table := 'alerts';
    v_action := 'alert_self_retracted';
    v_target_kind := 'alert';
  elsif p_kind = 'tip' then
    v_table := 'tips';
    v_action := 'tip_self_retracted';
    v_target_kind := 'tip';
  else
    raise exception 'invalid_kind';
  end if;

  -- 2. Charger la ligne (résidence, propriétaire, état).
  execute format(
    'select residence_id, created_by, deleted_at from public.%I where id = $1', v_table
  ) into v_residence, v_owner, v_deleted using p_id;

  if v_residence is null then
    raise exception 'not_found';
  end if;
  if v_owner is distinct from v_uid then
    raise exception 'forbidden';
  end if;
  if v_deleted is not null then
    return; -- déjà retiré : idempotent.
  end if;

  -- 3. Soft-delete atomique (raison bornée 500 chars).
  v_reason := left(coalesce(nullif(btrim(p_reason), ''), 'author_retract'), 500);
  execute format(
    'update public.%I set deleted_at = now(), deleted_by = $1, deletion_reason = $2, '
    'updated_at = now() where id = $3 and deleted_at is null returning id', v_table
  ) into v_updated_id using v_uid, v_reason, p_id;

  if v_updated_id is null then
    return; -- race perdue : idempotent.
  end if;

  -- 4. Audit (action dédiée auteur).
  insert into public.moderation_log
    (residence_id, actor_id, action, target_kind, target_id, reason_text_anonymized)
  values
    (v_residence, v_uid, v_action, v_target_kind, p_id, v_reason);
end;
$$;

revoke execute on function public.retract_own_ephemeral(text, uuid, text) from public, anon;
grant execute on function public.retract_own_ephemeral(text, uuid, text) to authenticated;
