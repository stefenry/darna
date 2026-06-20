-- Story 3.5 (AC5/AC8) — RPC de retrait de contenu durable (co_mod).
--
-- `moderation_log` est écriture-système (aucune policy INSERT client) → le retrait
-- co_mod (soft-delete + log) DOIT passer par un RPC SECURITY DEFINER, sur le modèle
-- de `process_artisan_consent` / `accept_admission`. Le RPC re-vérifie rôle co_mod
-- + résidence EN INTERNE (ne fait jamais confiance au seul paramètre client) :
-- un résident appelant le RPC reçoit `not_co_mod`.
--
-- Une seule action enum réutilisée : `content_removed` (existe déjà) + target_kind
-- in ('guide_entry','useful_number','pack_entry'). Aucune valeur d'enum ajoutée (D3).
--
-- NOTE timestamp : story prévoyait 20260623110000 — décalé à 20260627110000 (slot
-- pris par Epic 2, monotonie ; cf. 3.1/3.2).

create or replace function public.retire_durable_entry(
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
  v_residence uuid;
  v_deleted timestamptz;
begin
  -- Whitelist stricte kind → table (le %I dynamique ne reçoit qu'une valeur sûre).
  v_table := case p_kind
    when 'guide_entry'   then 'guide_entries'
    when 'useful_number' then 'useful_numbers'
    when 'pack_entry'    then 'pack_entries'
    else null
  end;
  if v_table is null then
    raise exception 'invalid_kind';
  end if;

  -- Re-check rôle co_mod (le RPC est DEFINER → ne pas faire confiance au client).
  if public.auth_role() <> 'co_mod' then
    raise exception 'not_co_mod';
  end if;

  -- Charger l'entrée cible (residence + état soft-delete).
  execute format('select residence_id, deleted_at from public.%I where id = $1', v_table)
    into v_residence, v_deleted
    using p_id;

  if v_residence is null then
    raise exception 'not_found';
  end if;
  if v_deleted is not null then
    raise exception 'not_found'; -- déjà retirée → idempotence stricte (pas de double-log)
  end if;
  if v_residence <> public.auth_residence_id() then
    raise exception 'wrong_residence';
  end if;

  -- Soft-delete + log atomiques (une transaction de fonction).
  execute format(
    'update public.%I set deleted_at = now(), deleted_by = $1, deletion_reason = $2, updated_at = now() where id = $3',
    v_table
  ) using auth.uid(), p_reason, p_id;

  insert into public.moderation_log
    (residence_id, actor_id, action, target_kind, target_id, reason_text_anonymized)
  values
    (public.auth_residence_id(), auth.uid(), 'content_removed', p_kind, p_id, p_reason);
end;
$$;

-- Appelable par les sessions authentifiées (co_mod) ; le re-check interne borne
-- l'effet au rôle co_mod de la bonne résidence.
revoke execute on function public.retire_durable_entry(text, uuid, text) from public, anon;
grant execute on function public.retire_durable_entry(text, uuid, text) to authenticated;
