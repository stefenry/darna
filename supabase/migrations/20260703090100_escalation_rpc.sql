-- Story 5.5 — RPC d'escalade juridique + résolution out-of-band.
--
-- escalate_report_legal : open → closed_kept_pending_legal (la cible reste
-- visible pendant l'avis juridique), log escalation_triggered, retourne les ids
-- (auteur cible + reporter) pour le dossier + e-mail au contact juridique.
-- resolve_legal_escalation : closed_kept_pending_legal → approved (content_kept)
-- ou removed (content_removed + soft-delete cible). SECURITY DEFINER, re-check
-- co_mod + résidence + garde d'état atomique (anti-race). Modèle moderate_*.

-- ─────────────────────────────────────────────────────────────────────────────
-- escalate_report_legal
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.escalate_report_legal(
  p_report_id uuid,
  p_context_note text
)
returns table (
  target_author_id uuid,
  out_target_type text,
  out_target_id uuid,
  out_residence_id uuid,
  out_reporter_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports;
  v_table text;
  v_author_col text;
  v_author uuid;
begin
  if public.auth_role() <> 'co_mod' then
    raise exception 'not_co_mod';
  end if;

  select * into v_report from public.reports where id = p_report_id;
  if v_report.id is null then
    raise exception 'report_not_found';
  end if;
  if v_report.residence_id <> public.auth_residence_id() then
    raise exception 'wrong_residence';
  end if;

  case v_report.target_type
    when 'artisan' then v_table := 'artisans'; v_author_col := 'created_by';
    when 'rating' then v_table := 'ratings'; v_author_col := 'user_id';
    when 'alert' then v_table := 'alerts'; v_author_col := 'created_by';
    when 'tip' then v_table := 'tips'; v_author_col := 'created_by';
    when 'guide_entry' then v_table := 'guide_entries'; v_author_col := 'created_by';
    when 'useful_number' then v_table := 'useful_numbers'; v_author_col := 'created_by';
    else v_table := null;
  end case;
  if v_table is not null then
    execute format('select %I from public.%I where id = $1', v_author_col, v_table)
      into v_author using v_report.target_id;
  end if;

  -- Transition atomique open → pending_legal (la cible reste visible).
  update public.reports
    set state = 'closed_kept_pending_legal', resolved_at = now(), resolved_by = auth.uid(),
        resolution_motive = p_context_note
    where id = p_report_id and state = 'open';
  if not found then
    raise exception 'already_resolved';
  end if;

  insert into public.moderation_log
    (residence_id, actor_id, action, target_kind, target_id, payload_json)
  values
    (v_report.residence_id, auth.uid(), 'escalation_triggered', v_report.target_type::text,
     v_report.target_id, jsonb_build_object('target_type', v_report.target_type));

  return query
    select v_author, v_report.target_type::text, v_report.target_id,
           v_report.residence_id, v_report.reporter_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- resolve_legal_escalation
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.resolve_legal_escalation(
  p_report_id uuid,
  p_decision text,
  p_note text
)
returns table (out_target_type text, out_target_id uuid, out_residence_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports;
  v_table text;
  v_deleted timestamptz;
  v_new_state public.report_state;
  v_action public.moderation_action;
begin
  if public.auth_role() <> 'co_mod' then
    raise exception 'not_co_mod';
  end if;

  if p_decision = 'approved' then
    v_new_state := 'closed_kept_legal_approved';
    v_action := 'content_kept';
  elsif p_decision = 'removed' then
    v_new_state := 'closed_removed_legal_advised';
    v_action := 'content_removed';
  else
    raise exception 'invalid_decision';
  end if;

  select * into v_report from public.reports where id = p_report_id;
  if v_report.id is null then
    raise exception 'report_not_found';
  end if;
  if v_report.residence_id <> public.auth_residence_id() then
    raise exception 'wrong_residence';
  end if;

  -- Transition atomique pending_legal → état final.
  update public.reports
    set state = v_new_state, resolved_at = now(), resolved_by = auth.uid(),
        resolution_motive = p_note
    where id = p_report_id and state = 'closed_kept_pending_legal';
  if not found then
    raise exception 'not_pending_legal';
  end if;

  -- Sur avis de retrait : soft-delete la cible (whitelist table).
  if p_decision = 'removed' then
    case v_report.target_type
      when 'artisan' then v_table := 'artisans';
      when 'rating' then v_table := 'ratings';
      when 'alert' then v_table := 'alerts';
      when 'tip' then v_table := 'tips';
      when 'guide_entry' then v_table := 'guide_entries';
      when 'useful_number' then v_table := 'useful_numbers';
      else v_table := null;
    end case;
    if v_table is not null then
      execute format('select deleted_at from public.%I where id = $1', v_table)
        into v_deleted using v_report.target_id;
      if v_deleted is null then
        execute format(
          'update public.%I set deleted_at = now(), deleted_by = $1, deletion_reason = $2, updated_at = now() where id = $3',
          v_table
        ) using auth.uid(), p_note, v_report.target_id;
      end if;
    end if;
  end if;

  insert into public.moderation_log
    (residence_id, actor_id, action, target_kind, target_id, reason_text_anonymized, payload_json)
  values
    (v_report.residence_id, auth.uid(), v_action, v_report.target_type::text, v_report.target_id,
     p_note, jsonb_build_object('target_type', v_report.target_type, 'legal', true));

  return query select v_report.target_type::text, v_report.target_id, v_report.residence_id;
end;
$$;

revoke execute on function public.escalate_report_legal(uuid, text) from public, anon;
grant execute on function public.escalate_report_legal(uuid, text) to authenticated;
revoke execute on function public.resolve_legal_escalation(uuid, text, text) from public, anon;
grant execute on function public.resolve_legal_escalation(uuid, text, text) to authenticated;
