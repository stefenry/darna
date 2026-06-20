-- Story 5.3 — RPC de résolution de signalement par le co_mod (retrait / conservation).
--
-- `moderation_log` est écriture-système (aucune policy INSERT client) + le retrait
-- doit soft-delete une cible POLYMORPHE (6 tables) ET transitionner le report de
-- façon atomique → RPC SECURITY DEFINER (modèle retire_durable_entry 3.5). Le RPC
-- re-vérifie rôle co_mod + résidence EN INTERNE (jamais confiance au client) et
-- garde la transition `state='open'` (anti double-modération concurrente).
--
-- Aucune valeur d'enum ajoutée : `content_removed` existe (Epic 1), `content_kept`
-- ajoutée en 5.1. target_kind = report.target_type::text.

-- ─────────────────────────────────────────────────────────────────────────────
-- moderate_remove_content — co_mod retire le contenu signalé.
--   Retourne l'auteur de la cible (pour notification e-mail côté Server Action).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.moderate_remove_content(
  p_report_id uuid,
  p_motive text,
  p_note text default null
)
returns table (target_author_id uuid, out_target_type text, out_target_id uuid, out_residence_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports;
  v_table text;
  v_author_col text;
  v_author uuid;
  v_deleted timestamptz;
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

  -- Whitelist stricte target_type → (table, colonne auteur). %I ne reçoit que
  -- des littéraux sûrs (anti-injection). alert_comment non câblé (Epic 6.4).
  case v_report.target_type
    when 'artisan' then v_table := 'artisans'; v_author_col := 'created_by';
    when 'rating' then v_table := 'ratings'; v_author_col := 'user_id';
    when 'alert' then v_table := 'alerts'; v_author_col := 'created_by';
    when 'tip' then v_table := 'tips'; v_author_col := 'created_by';
    when 'guide_entry' then v_table := 'guide_entries'; v_author_col := 'created_by';
    when 'useful_number' then v_table := 'useful_numbers'; v_author_col := 'created_by';
    else raise exception 'unsupported_target';
  end case;

  -- Transition atomique open → closed_removed (garde anti-race : 0 ligne si un
  -- autre co_mod a déjà résolu entre-temps).
  update public.reports
    set state = 'closed_removed', resolved_at = now(), resolved_by = auth.uid(),
        resolution_motive = p_motive
    where id = p_report_id and state = 'open';
  if not found then
    raise exception 'already_resolved';
  end if;

  -- Charger l'auteur + état soft-delete de la cible.
  execute format('select %I, deleted_at from public.%I where id = $1', v_author_col, v_table)
    into v_author, v_deleted
    using v_report.target_id;

  -- Soft-delete la cible si pas déjà retirée (idempotent). Le trigger
  -- enforce_deleted_by_actor force deleted_by = auth.uid() (co_mod courant).
  if v_deleted is null then
    execute format(
      'update public.%I set deleted_at = now(), deleted_by = $1, deletion_reason = $2, updated_at = now() where id = $3',
      v_table
    ) using auth.uid(), p_motive, v_report.target_id;
  end if;

  -- Audit content_removed (motif + note ; no-PII de l'auteur).
  insert into public.moderation_log
    (residence_id, actor_id, action, target_kind, target_id, reason_code, reason_text_anonymized, payload_json)
  values
    (v_report.residence_id, auth.uid(), 'content_removed', v_report.target_type::text,
     v_report.target_id, p_motive, p_note,
     jsonb_build_object('target_type', v_report.target_type, 'motive', p_motive));

  return query
    select v_author, v_report.target_type::text, v_report.target_id, v_report.residence_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- moderate_keep_content — co_mod conserve le contenu signalé.
--   Retourne le reporter (pour notification e-mail « signalement examiné »).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.moderate_keep_content(
  p_report_id uuid,
  p_note text default null
)
returns table (out_reporter_id uuid, out_residence_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports;
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

  update public.reports
    set state = 'closed_kept', resolved_at = now(), resolved_by = auth.uid(),
        resolution_motive = p_note
    where id = p_report_id and state = 'open';
  if not found then
    raise exception 'already_resolved';
  end if;

  insert into public.moderation_log
    (residence_id, actor_id, action, target_kind, target_id, reason_text_anonymized, payload_json)
  values
    (v_report.residence_id, auth.uid(), 'content_kept', v_report.target_type::text,
     v_report.target_id, p_note,
     jsonb_build_object('target_type', v_report.target_type));

  return query select v_report.reporter_id, v_report.residence_id;
end;
$$;

-- Appelables par les sessions authentifiées (co_mod) ; re-check interne borne
-- l'effet au co_mod de la bonne résidence.
revoke execute on function public.moderate_remove_content(uuid, text, text) from public, anon;
grant execute on function public.moderate_remove_content(uuid, text, text) to authenticated;
revoke execute on function public.moderate_keep_content(uuid, text) from public, anon;
grant execute on function public.moderate_keep_content(uuid, text) to authenticated;
