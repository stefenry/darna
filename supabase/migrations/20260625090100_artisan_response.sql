-- Story 2.8 — droit de réponse artisan : chemin token-based public sans session.
--
-- (1) `artisan_consent_tokens.purpose` enum ('consent'|'respond') — réutilisation
--     propre du store HMAC 2.4/2.5 ; les RPC filtrent par purpose (cross-purpose
--     attack → not_found).
-- (2) table `artisan_responses` (FR22 droit de réponse identifié, target listing|rating).
-- (3) table `artisan_rectification_requests` (queue passive — traitement co-mod Epic 5).
-- (4) RPC `request_artisan_contact_link` (AR38 : not_found sans raise) + RPC
--     `process_artisan_response` (response/rectification, gate atomique 2.5/P1).
-- (5) `process_artisan_consent` : filtre `purpose='consent'` (symétrie cross-purpose).
-- (6) `moderation_log` policy split étendue (anti side-channel AR38, 2.5/P5).
--
-- Écritures sensibles via SECURITY DEFINER uniquement (revoke anon/authenticated,
-- grant service_role — pattern 2.5/P2). Tables deny-all client en écriture.

-- ─────────────────────────────────────────────────────────────────────────────
-- (1) purpose enum + colonne tokens
-- ─────────────────────────────────────────────────────────────────────────────
create type public.consent_token_purpose as enum ('consent', 'respond');
alter table public.artisan_consent_tokens
  add column purpose public.consent_token_purpose not null default 'consent';
create index idx_artisan_consent_tokens_purpose_hash
  on public.artisan_consent_tokens (purpose, token_hash);

-- ─────────────────────────────────────────────────────────────────────────────
-- (2) artisan_responses (droit de réponse, lecture publique scopée résidence)
-- ─────────────────────────────────────────────────────────────────────────────
create type public.artisan_response_target as enum ('listing', 'rating');
create table public.artisan_responses (
  id uuid primary key default gen_random_uuid(),
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  residence_id uuid not null references public.residences(id) on delete restrict,
  target_kind public.artisan_response_target not null,
  target_id uuid,
  response_text text not null check (length(response_text) between 1 and 500),
  response_tsv tsvector generated always as
    (to_tsvector('french', coalesce(response_text, ''))) stored,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  deletion_reason text
);
create index idx_artisan_responses_artisan_id
  on public.artisan_responses (artisan_id, created_at desc);
create index idx_artisan_responses_tsv on public.artisan_responses using gin (response_tsv);
alter table public.artisan_responses enable row level security;

create policy artisan_responses_resident_select on public.artisan_responses
  for select
  using (
    deleted_at is null
    and exists (
      select 1 from public.artisans a
      where a.id = artisan_id
        and a.state = 'published'
        and a.deleted_at is null
        and a.residence_id = (
          select residence_id from public.users
          where id = auth.uid()
            and role in ('resident', 'co_mod')
            and deleted_at is null
        )
    )
  );
-- Pas de policy INSERT/UPDATE/DELETE → écriture via RPC SECURITY DEFINER seule.

-- ─────────────────────────────────────────────────────────────────────────────
-- (3) artisan_rectification_requests (queue passive co-mod, traitement Epic 5)
-- ─────────────────────────────────────────────────────────────────────────────
create type public.artisan_rectification_state as enum ('pending', 'accepted', 'rejected');
create type public.artisan_rectification_field as enum (
  'display_name_fr', 'display_name_ar', 'phone_e164',
  'competences', 'price_relative', 'has_invoice'
);
create table public.artisan_rectification_requests (
  id uuid primary key default gen_random_uuid(),
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  residence_id uuid not null references public.residences(id) on delete restrict,
  field_target public.artisan_rectification_field not null,
  requested_value text not null check (length(requested_value) between 1 and 200),
  justification_text text not null check (length(justification_text) between 1 and 500),
  state public.artisan_rectification_state not null default 'pending',
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_artisan_rectification_requests_state
  on public.artisan_rectification_requests (state, created_at);
create trigger trg_artisan_rectification_updated_at
  before update on public.artisan_rectification_requests
  for each row execute function public.set_updated_at();
alter table public.artisan_rectification_requests enable row level security;

-- Queue privée : co-mods de la résidence uniquement (protège les PII demandées).
create policy artisan_rectification_resident_select_comod on public.artisan_rectification_requests
  for select
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  );
-- Pas de policy write → RPC SECURITY DEFINER (insertion 2.8, traitement Epic 5).

-- ─────────────────────────────────────────────────────────────────────────────
-- (4a) RPC request_artisan_contact_link — AR38 : not_found SANS raise.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.request_artisan_contact_link(
  p_phone_e164 text,
  p_token_hash text,
  p_expires_at timestamptz
)
returns table (status text, sms_target_phone text, sms_artisan_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
begin
  select id, residence_id, display_name_fr, phone_e164
    into a
    from public.artisans
   where phone_e164 = p_phone_e164
     and state = 'published'
     and deleted_at is null
   order by published_at desc
   limit 1;

  if not found then
    -- Indistinguabilité AR38 : pas de raise, la Server Action mappe vers la même
    -- réponse générique côté UI.
    return query select 'not_found'::text, null::text, null::text;
    return;
  end if;

  insert into public.artisan_consent_tokens (artisan_id, residence_id, token_hash, expires_at, purpose)
    values (a.id, a.residence_id, p_token_hash, p_expires_at, 'respond');

  return query select 'sent'::text, a.phone_e164, a.display_name_fr;
end;
$$;
revoke execute on function public.request_artisan_contact_link(text, text, timestamptz) from public;
revoke execute on function public.request_artisan_contact_link(text, text, timestamptz) from anon;
revoke execute on function public.request_artisan_contact_link(text, text, timestamptz) from authenticated;
grant execute on function public.request_artisan_contact_link(text, text, timestamptz) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- (4b) RPC process_artisan_response — response | rectification (gate atomique).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.process_artisan_response(
  p_token_hash text,
  p_kind text,
  p_payload jsonb
)
returns table (status text, artisan_id uuid, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_token_id uuid;
  v_target_kind text;
  v_target_id uuid;
  v_response_text text;
  v_field text;
  v_value text;
  v_justif text;
begin
  select
    t.id as token_id, t.used_at, t.expires_at, t.purpose,
    a.id as a_id, a.slug as a_slug, a.state as a_state,
    a.deleted_at as a_deleted_at, a.residence_id as a_res
  into v
  from public.artisan_consent_tokens t
  join public.artisans a on a.id = t.artisan_id
  where t.token_hash = p_token_hash;

  -- AR38 : token introuvable OU cross-purpose (consent sur /respond) → not_found.
  if not found or v.purpose <> 'respond' then
    return query select 'not_found'::text, null::uuid, null::text; return;
  end if;
  -- Artisan retiré entre-temps → not_found (AR38).
  if v.a_state <> 'published' or v.a_deleted_at is not null then
    return query select 'not_found'::text, null::uuid, null::text; return;
  end if;
  if v.used_at is not null then
    return query select 'already_used'::text, v.a_id, v.a_slug; return;
  end if;
  if v.expires_at < now() then
    return query select 'expired'::text, v.a_id, v.a_slug; return;
  end if;

  -- Validation du payload AVANT la gate atomique (un payload invalide ne brûle
  -- pas le token).
  if p_kind = 'response' then
    v_response_text := p_payload->>'response_text';
    v_target_kind := coalesce(p_payload->>'target_kind', 'listing');
    if v_target_kind not in ('listing', 'rating') then
      v_target_kind := 'listing';
    end if;
    if v_response_text is null or length(v_response_text) < 1 or length(v_response_text) > 500 then
      return query select 'invalid_decision'::text, null::uuid, null::text; return;
    end if;
  elsif p_kind = 'rectification' then
    v_field := p_payload->>'field_target';
    v_value := p_payload->>'requested_value';
    v_justif := p_payload->>'justification_text';
    if v_field is null
       or v_field not in ('display_name_fr', 'display_name_ar', 'phone_e164',
                          'competences', 'price_relative', 'has_invoice')
       or v_value is null or length(v_value) < 1 or length(v_value) > 200
       or v_justif is null or length(v_justif) < 1 or length(v_justif) > 500 then
      return query select 'invalid_decision'::text, null::uuid, null::text; return;
    end if;
  else
    return query select 'invalid_decision'::text, null::uuid, null::text; return;
  end if;

  -- Gate atomique anti-race (2.5/P1) : un seul appel concurrent consomme le token.
  update public.artisan_consent_tokens
    set used_at = now()
    where id = v.token_id and used_at is null
    returning id into v_token_id;
  if v_token_id is null then
    return query select 'already_used'::text, v.a_id, v.a_slug; return;
  end if;

  if p_kind = 'response' then
    v_target_id := null;
    if v_target_kind = 'rating' and (p_payload->>'target_id') is not null then
      -- Le rating ciblé doit appartenir à cet artisan ET être vivant ; sinon dégrade
      -- en 'listing' (un rating supprimé entre-temps ne plante pas la publication — FR22,
      -- §Cas limite « dégrade silencieusement à target_id=null »).
      -- Alias `r` : `artisan_id` non-qualifié serait ambigu avec le param OUT (42702).
      select r.id into v_target_id
        from public.ratings r
       where r.id = (p_payload->>'target_id')::uuid
         and r.artisan_id = v.a_id
         and r.deleted_at is null;
      if v_target_id is null then
        v_target_kind := 'listing';
      end if;
    end if;
    insert into public.artisan_responses
      (artisan_id, residence_id, target_kind, target_id, response_text)
      values (v.a_id, v.a_res, v_target_kind::public.artisan_response_target, v_target_id, v_response_text);
    insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
      values (v.a_res, null, 'artisan_response_published', 'artisan', v.a_id);
    return query select 'published'::text, v.a_id, v.a_slug; return;
  else
    insert into public.artisan_rectification_requests
      (artisan_id, residence_id, field_target, requested_value, justification_text)
      values (v.a_id, v.a_res, v_field::public.artisan_rectification_field, v_value, v_justif);
    insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
      values (v.a_res, null, 'artisan_rectification_requested', 'artisan', v.a_id);
    return query select 'rectification_pending'::text, v.a_id, v.a_slug; return;
  end if;
end;
$$;
revoke execute on function public.process_artisan_response(text, text, jsonb) from public;
revoke execute on function public.process_artisan_response(text, text, jsonb) from anon;
revoke execute on function public.process_artisan_response(text, text, jsonb) from authenticated;
grant execute on function public.process_artisan_response(text, text, jsonb) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- (5) process_artisan_consent : filtre purpose='consent' (symétrie cross-purpose).
--     CREATE OR REPLACE reprend la version 2.7 (draft) + ajoute le filtre WHERE.
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
  v_is_reconsent boolean;
  v_final_name text;
begin
  select
    t.id as token_id, t.used_at, t.expires_at,
    a.id as a_id, a.slug as a_slug, a.created_by,
    a.display_name_fr, a.display_name_ar, a.phone_e164 as a_phone,
    a.state as a_state, a.deleted_at as a_deleted_at, a.residence_id as a_res,
    a.pending_display_name_fr as a_pending_name, a.pending_phone_e164 as a_pending_phone
  into v
  from public.artisan_consent_tokens t
  join public.artisans a on a.id = t.artisan_id
  where t.token_hash = p_token_hash and t.purpose = 'consent';

  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::uuid, null::text,
                        null::text, null::public.artisan_state;
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

  v_is_reconsent := (v.a_state = 'published'
                     and (v.a_pending_name is not null or v.a_pending_phone is not null));

  if v.a_deleted_at is not null then
    return query select 'already_used'::text, v.a_id, v.a_slug, v.created_by,
                        v.display_name_fr, v.display_name_ar, v.a_state;
    return;
  end if;
  if v.a_state <> 'pending_consent' and not v_is_reconsent then
    return query select 'already_used'::text, v.a_id, v.a_slug, v.created_by,
                        v.display_name_fr, v.display_name_ar, v.a_state;
    return;
  end if;

  if p_decision not in ('accept', 'refuse') then
    return query select 'invalid_decision'::text, null::uuid, null::text, null::uuid,
                        null::text, null::text, null::public.artisan_state;
    return;
  end if;

  update public.artisan_consent_tokens
    set used_at = now()
    where id = v.token_id and used_at is null
    returning id into v_token_id;
  if v_token_id is null then
    return query select 'already_used'::text, v.a_id, v.a_slug, v.created_by,
                        v.display_name_fr, v.display_name_ar, v.a_state;
    return;
  end if;

  if p_decision = 'accept' then
    v_final_name := coalesce(v.a_pending_name, v.display_name_fr);
    if v.a_state = 'pending_consent' then
      update public.artisans
        set state = 'published', published_at = now(),
            display_name_fr = coalesce(v.a_pending_name, v.display_name_fr),
            phone_e164 = coalesce(v.a_pending_phone, v.a_phone),
            pending_display_name_fr = null, pending_phone_e164 = null, updated_at = now()
        where id = v.a_id;
    else
      update public.artisans
        set display_name_fr = coalesce(v.a_pending_name, v.display_name_fr),
            phone_e164 = coalesce(v.a_pending_phone, v.a_phone),
            pending_display_name_fr = null, pending_phone_e164 = null, updated_at = now()
        where id = v.a_id;
    end if;
    insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
      values (v.a_res, null, 'artisan_published', 'artisan', v.a_id);
    return query select 'accepted'::text, v.a_id, v.a_slug, v.created_by,
                        v_final_name, v.display_name_ar, 'published'::public.artisan_state;
  else
    if v_is_reconsent then
      update public.artisans
        set pending_display_name_fr = null, pending_phone_e164 = null, updated_at = now()
        where id = v.a_id;
      insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
        values (v.a_res, null, 'artisan_reconsent_refused', 'artisan', v.a_id);
      return query select 'refused'::text, v.a_id, v.a_slug, v.created_by,
                          v.display_name_fr, v.display_name_ar, 'published'::public.artisan_state;
    else
      update public.artisans
        set state = 'refused', deleted_at = now(),
            deletion_reason = 'consent_refused', updated_at = now()
        where id = v.a_id;
      insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
        values (v.a_res, null, 'artisan_consent_refused', 'artisan', v.a_id);
      return query select 'refused'::text, v.a_id, v.a_slug, v.created_by,
                          v.display_name_fr, v.display_name_ar, 'refused'::public.artisan_state;
    end if;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (6) moderation_log policy split — étendre aux 2 nouvelles actions (anti side-channel).
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists moderation_log_public_select on public.moderation_log;
drop policy if exists moderation_log_consent_residence_select on public.moderation_log;

create policy moderation_log_public_select on public.moderation_log
  for select
  using (
    action not in (
      'artisan_published', 'artisan_consent_refused',
      'artisan_retracted', 'artisan_reconsent_requested', 'artisan_reconsent_refused',
      'artisan_response_published', 'artisan_rectification_requested'
    )
  );

create policy moderation_log_consent_residence_select on public.moderation_log
  for select
  to authenticated
  using (
    action in (
      'artisan_published', 'artisan_consent_refused',
      'artisan_retracted', 'artisan_reconsent_requested', 'artisan_reconsent_refused',
      'artisan_response_published', 'artisan_rectification_requested'
    )
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.residence_id = moderation_log.residence_id
        and u.deleted_at is null
    )
  );
