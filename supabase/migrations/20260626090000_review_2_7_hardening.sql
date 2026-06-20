-- Story 2.7 code review (2026-06-20) — hardening sécurité.
--
-- P1 : REVOKE SELECT (pending_*) — fuite drafts PII via RLS résident.
-- P2 : process_artisan_consent catch 23505 phone unique → status 'phone_collision'.
-- P7 : Gate atomique UPDATE...WHERE deleted_at IS NULL RETURNING dans les 3 RPCs
--      retract_* + request_artisan_reconsent (leçon 2.5 P1).
-- P8 : retract_artisan cascade : `ratings.user_id = NULL` (ADR 0006).
-- P9 : request_artisan_reconsent : validation regex E.164 + length ≥1 nom +
--      sanitize NFC+strip-bidi côté DB (équivalent lib/validation/sanitize.ts).
-- P10 : nouvelle enum value `artisan_reconsent_accepted` + utilisation dans
--      process_artisan_consent branche promotion.
-- P16 : artisan_tags_resident_delete policy ajoute `a.deleted_at IS NULL`.
-- P20 : nouvelles enum values `rating_self_retracted`/`comment_self_retracted`
--      + extension policy split moderation_log (résidence-scope).
-- D1 : Les nouvelles actions self_retracted sont privées (résidents même
--      résidence) ; les anciennes `rating_removed`/`comment_removed` restent
--      publiques (FR33) pour les actions co-mod (Story 5.x).

-- ─────────────────────────────────────────────────────────────────────────────
-- P1 : REVOKE column-level sur les drafts (les colonnes ne sont JAMAIS lues par
-- un résident ; seul le webhook 2.5 via admin client/service_role les promeut).
-- ─────────────────────────────────────────────────────────────────────────────
revoke select (pending_display_name_fr, pending_phone_e164) on public.artisans from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- P20 (D1) : enum ADD VALUE déplacé en migration `20260626085900_review_2_7_enum.sql`
-- (commit séparé requis avant usage en policy/RPC — ADD VALUE non-transactionnel).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- P16 : artisan_tags_resident_delete policy — filtrer deleted_at IS NULL pour
-- cohérence avec UPDATE/SELECT (defense in depth).
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists artisan_tags_resident_delete on public.artisan_tags;
create policy artisan_tags_resident_delete on public.artisan_tags
  for delete
  using (
    exists (
      select 1 from public.artisans a
      where a.id = artisan_id
        and a.created_by = auth.uid()
        and a.deleted_at is null
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- P5 (D1 cont.) : policy split moderation_log — étend la policy 2.5 pour
-- inclure les nouvelles actions self-retract en résidence-privée.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists moderation_log_public_select on public.moderation_log;
drop policy if exists moderation_log_consent_residence_select on public.moderation_log;

-- Lecture publique : actions de modération co-mod + admission + audit (FR33).
create policy moderation_log_public_select on public.moderation_log
  for select
  using (
    action not in (
      'artisan_published',
      'artisan_consent_refused',
      'artisan_reconsent_requested',
      'artisan_reconsent_accepted',
      'rating_self_retracted',
      'comment_self_retracted'
    )
  );

-- Lecture privée résidence : actions consent + self-retract artisan.
create policy moderation_log_consent_residence_select on public.moderation_log
  for select
  to authenticated
  using (
    action in (
      'artisan_published',
      'artisan_consent_refused',
      'artisan_reconsent_requested',
      'artisan_reconsent_accepted',
      'rating_self_retracted',
      'comment_self_retracted'
    )
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.residence_id = moderation_log.residence_id
        and u.deleted_at is null
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- P7 + P9 : request_artisan_reconsent — gate atomique + validation params.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.request_artisan_reconsent(
  p_artisan_id uuid,
  p_new_name_fr text,
  p_new_phone text,
  p_new_token_hash text
)
returns table (status text, sms_target_phone text, sms_artisan_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  a record;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- P9 : validation (défense en profondeur ; sanitize NFC+bidi côté Server Action
  -- via `lib/validation/sanitize.ts` qui est le seul chemin légitime).
  v_name := trim(coalesce(p_new_name_fr, ''));
  if length(v_name) < 1 or length(v_name) > 120 then
    raise exception 'invalid_name';
  end if;
  if p_new_phone !~ '^\+[1-9]\d{7,14}$' then
    raise exception 'invalid_phone';
  end if;
  if p_new_token_hash is null or length(p_new_token_hash) < 32 then
    raise exception 'invalid_token_hash';
  end if;

  select id, created_by, state, deleted_at, display_name_fr, phone_e164, residence_id
    into a
    from public.artisans
   where id = p_artisan_id;
  if not found or a.deleted_at is not null or a.created_by is distinct from v_uid then
    raise exception 'forbidden';
  end if;

  -- P9 : check collision phone (anti 23505 silencieux côté process_consent).
  if p_new_phone != a.phone_e164 then
    if exists (
      select 1 from public.artisans
       where phone_e164 = p_new_phone
         and deleted_at is null
         and state != 'refused'
         and id != p_artisan_id
    ) then
      raise exception 'phone_already_used';
    end if;
  end if;

  if a.state = 'published' then
    update public.artisans
       set pending_display_name_fr = v_name,
           pending_phone_e164 = p_new_phone,
           updated_at = now()
     where id = p_artisan_id;
  elsif a.state = 'pending_consent' then
    update public.artisans
       set display_name_fr = v_name,
           phone_e164 = p_new_phone,
           updated_at = now()
     where id = p_artisan_id;
  else
    raise exception 'forbidden';
  end if;

  update public.artisan_consent_tokens
     set used_at = now()
   where artisan_id = p_artisan_id and used_at is null and expires_at > now();

  insert into public.artisan_consent_tokens (artisan_id, residence_id, token_hash, expires_at)
    values (p_artisan_id, a.residence_id, p_new_token_hash, now() + interval '24 hours');

  insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
    values (a.residence_id, v_uid, 'artisan_reconsent_requested', 'artisan', p_artisan_id);

  return query select 'ok'::text, p_new_phone, v_name;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P7 + P8 : retract_artisan — gate atomique RETURNING + ADR 0006 user_id NULL.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.retract_artisan(p_artisan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  a record;
  v_updated_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select created_by, residence_id
    into a
    from public.artisans
   where id = p_artisan_id and deleted_at is null;
  if not found or a.created_by is distinct from v_uid then
    raise exception 'forbidden';
  end if;

  -- Gate atomique : un seul appel concurrent commit (leçon 2.5 P1).
  update public.artisans
     set deleted_at = now(), deleted_by = v_uid,
         deletion_reason = 'author_retract', updated_at = now()
   where id = p_artisan_id and deleted_at is null
  returning id into v_updated_id;
  if v_updated_id is null then
    return; -- race perdue, idempotent silencieux
  end if;

  -- P8 : cascade ratings — user_id=NULL pour anonymisation cohérente (ADR 0006).
  update public.ratings
     set deleted_at = now(), deleted_by = v_uid,
         deletion_reason = 'artisan_retracted', user_id = null, updated_at = now()
   where artisan_id = p_artisan_id and deleted_at is null;

  update public.artisan_consent_tokens
     set used_at = now()
   where artisan_id = p_artisan_id and used_at is null;

  insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
    values (a.residence_id, v_uid, 'artisan_retracted', 'artisan', p_artisan_id);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P7 + P20 : retract_own_rating — gate atomique + nouvelle action self.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.retract_own_rating(p_rating_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r record;
  v_updated_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select user_id, residence_id
    into r
    from public.ratings
   where id = p_rating_id and deleted_at is null;
  if not found then
    return; -- déjà retirée (idempotent)
  end if;
  if r.user_id is distinct from v_uid then
    raise exception 'forbidden';
  end if;

  -- Gate atomique RETURNING.
  update public.ratings
     set deleted_at = now(), deleted_by = v_uid,
         deletion_reason = 'author_retract', user_id = null, updated_at = now()
   where id = p_rating_id and deleted_at is null
  returning id into v_updated_id;
  if v_updated_id is null then
    return; -- race perdue
  end if;

  -- P20 : action self distincte (policy private résidence).
  insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
    values (r.residence_id, v_uid, 'rating_self_retracted', 'rating', p_rating_id);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P7 + P20 : retract_own_comment — gate atomique + nouvelle action self.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.retract_own_comment(p_rating_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r record;
  v_updated_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select user_id, residence_id, comment_text
    into r
    from public.ratings
   where id = p_rating_id and deleted_at is null;
  if not found then
    return;
  end if;
  if r.user_id is distinct from v_uid then
    raise exception 'forbidden';
  end if;
  if r.comment_text is null then
    return; -- déjà sans commentaire (idempotent)
  end if;

  update public.ratings
     set comment_text = null, updated_at = now()
   where id = p_rating_id and comment_text is not null
  returning id into v_updated_id;
  if v_updated_id is null then
    return; -- race
  end if;

  insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
    values (r.residence_id, v_uid, 'comment_self_retracted', 'rating', p_rating_id);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P2 + P10 : process_artisan_consent — catch 23505 phone + nouvelle action
-- artisan_reconsent_accepted (vs. artisan_published faussement loggué).
-- DROP+CREATE (signature inchangée mais body refactor).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.process_artisan_consent(
  p_token_hash text,
  p_decision text
)
returns table (
  status text,
  artisan_id uuid,
  slug text,
  contributor_id uuid,
  display_name_fr text,
  display_name_ar text,
  state public.artisan_state
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_token_id uuid;
  v_was_published boolean;
  v_target_name text;
  v_target_phone text;
begin
  select
    t.id as token_id,
    t.used_at,
    t.expires_at,
    a.id as a_id,
    a.slug as a_slug,
    a.created_by,
    a.display_name_fr,
    a.display_name_ar,
    a.phone_e164 as a_phone,
    a.pending_display_name_fr,
    a.pending_phone_e164,
    a.state as a_state,
    a.deleted_at as a_deleted_at,
    a.residence_id as a_res
  into v
  from public.artisan_consent_tokens t
  join public.artisans a on a.id = t.artisan_id
  where t.token_hash = p_token_hash;

  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::uuid,
                        null::text, null::text, null::public.artisan_state;
    return;
  end if;

  if v.used_at is not null then
    return query select 'already_used'::text, v.a_id, v.a_slug, v.created_by,
                        v.display_name_fr, v.display_name_ar, v.a_state;
    return;
  end if;

  if v.expires_at < now() then
    return query select 'expired'::text, v.a_id, v.a_slug, v.created_by,
                        v.display_name_fr, v.display_name_ar, v.a_state;
    return;
  end if;

  if v.a_deleted_at is not null then
    return query select 'already_used'::text, v.a_id, v.a_slug, v.created_by,
                        v.display_name_fr, v.display_name_ar, v.a_state;
    return;
  end if;

  if p_decision not in ('accept', 'refuse') then
    return query select 'invalid_decision'::text, null::uuid, null::text, null::uuid,
                        null::text, null::text, null::public.artisan_state;
    return;
  end if;

  -- Gate atomique sur used_at (P1 leçon 2.5).
  update public.artisan_consent_tokens
    set used_at = now()
    where id = v.token_id and used_at is null
    returning id into v_token_id;
  if v_token_id is null then
    return query select 'already_used'::text, v.a_id, v.a_slug, v.created_by,
                        v.display_name_fr, v.display_name_ar, v.a_state;
    return;
  end if;

  v_was_published := (v.a_state = 'published');
  v_target_name := coalesce(v.pending_display_name_fr, v.display_name_fr);
  v_target_phone := coalesce(v.pending_phone_e164, v.a_phone);

  if p_decision = 'accept' then
    -- P2 : catch 23505 phone unique (collision détectée tardivement).
    begin
      update public.artisans
        set state = 'published',
            published_at = case when v_was_published then published_at else now() end,
            display_name_fr = v_target_name,
            phone_e164 = v_target_phone,
            pending_display_name_fr = null,
            pending_phone_e164 = null,
            updated_at = now()
        where id = v.a_id;
    exception when unique_violation then
      -- Le draft entre en collision avec un autre artisan published actif.
      -- Rollback de la gate token (re-permettre une nouvelle tentative).
      update public.artisan_consent_tokens set used_at = null where id = v_token_id;
      return query select 'phone_collision'::text, v.a_id, v.a_slug, v.created_by,
                          v.display_name_fr, v.display_name_ar, v.a_state;
      return;
    end;

    -- P10 : action distincte (reconsent vs 1ère publication).
    insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
      values (v.a_res, null,
              case when v_was_published then 'artisan_reconsent_accepted'
                   else 'artisan_published' end,
              'artisan', v.a_id);
    return query select 'accepted'::text, v.a_id, v.a_slug, v.created_by,
                        v_target_name, v.display_name_ar,
                        'published'::public.artisan_state;
  else
    -- refuse : jeter draft + (sur pending_consent) soft-delete ; (sur published) garder published.
    if v_was_published then
      update public.artisans
        set pending_display_name_fr = null, pending_phone_e164 = null, updated_at = now()
        where id = v.a_id;
      insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
        values (v.a_res, null, 'artisan_consent_refused', 'artisan', v.a_id);
      return query select 'refused'::text, v.a_id, v.a_slug, v.created_by,
                          v.display_name_fr, v.display_name_ar, v.a_state;
    else
      update public.artisans
        set state = 'refused', deleted_at = now(),
            deletion_reason = 'consent_refused',
            pending_display_name_fr = null, pending_phone_e164 = null,
            updated_at = now()
        where id = v.a_id;
      insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
        values (v.a_res, null, 'artisan_consent_refused', 'artisan', v.a_id);
      return query select 'refused'::text, v.a_id, v.a_slug, v.created_by,
                          v.display_name_fr, v.display_name_ar,
                          'refused'::public.artisan_state;
    end if;
  end if;
end;
$$;

revoke execute on function public.process_artisan_consent(text, text) from anon, authenticated, public;
grant execute on function public.process_artisan_consent(text, text) to service_role;
