-- Story 2.7 Task 8 — extension de `process_artisan_consent` (2.5) pour le
-- re-consent avec draft PII (AC3) :
--   - accept sur `pending_consent` : publie + promeut les drafts éventuels.
--   - accept sur `published` avec draft (re-consent) : promeut les drafts, reste
--     publié (pas de re-publication d'état).
--   - refuse sur re-consent (published + draft) : jette le draft, la fiche reste
--     publiée à l'ancien contenu (PAS de soft-delete) ; log artisan_reconsent_refused.
--   - refuse classique (pending_consent) : comportement 2.5 (refused + soft-delete).
-- Signature/return inchangés → CREATE OR REPLACE (les grants service_role de 2.5
-- sont préservés par REPLACE).

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
    t.id as token_id,
    t.used_at,
    t.expires_at,
    a.id as a_id,
    a.slug as a_slug,
    a.created_by,
    a.display_name_fr,
    a.display_name_ar,
    a.phone_e164 as a_phone,
    a.state as a_state,
    a.deleted_at as a_deleted_at,
    a.residence_id as a_res,
    a.pending_display_name_fr as a_pending_name,
    a.pending_phone_e164 as a_pending_phone
  into v
  from public.artisan_consent_tokens t
  join public.artisans a on a.id = t.artisan_id
  where t.token_hash = p_token_hash;

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

  -- Guards : soft-deleted → already_used. Autorisé si pending_consent OU re-consent
  -- draft sur une fiche published (Story 2.7 AC3). Tout autre état → already_used.
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

  -- Gate atomique anti-race (2.5/P1).
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
    -- Valeurs lues via le record `v` (qualifié) pour éviter l'ambiguïté avec les
    -- paramètres OUT homonymes `display_name_fr` (erreur 42702).
    if v.a_state = 'pending_consent' then
      update public.artisans
        set state = 'published',
            published_at = now(),
            display_name_fr = coalesce(v.a_pending_name, v.display_name_fr),
            phone_e164 = coalesce(v.a_pending_phone, v.a_phone),
            pending_display_name_fr = null,
            pending_phone_e164 = null,
            updated_at = now()
        where id = v.a_id;
    else
      -- Re-consent draft sur fiche published : promouvoir les drafts, rester publié.
      update public.artisans
        set display_name_fr = coalesce(v.a_pending_name, v.display_name_fr),
            phone_e164 = coalesce(v.a_pending_phone, v.a_phone),
            pending_display_name_fr = null,
            pending_phone_e164 = null,
            updated_at = now()
        where id = v.a_id;
    end if;
    insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
      values (v.a_res, null, 'artisan_published', 'artisan', v.a_id);
    return query select 'accepted'::text, v.a_id, v.a_slug, v.created_by,
                        v_final_name, v.display_name_ar, 'published'::public.artisan_state;
  else
    -- refuse
    if v_is_reconsent then
      -- La fiche reste publiée à l'ancien contenu ; on jette uniquement le draft.
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
-- moderation_log — étendre la restriction résidence aux nouvelles actions de
-- consentement self-action (anti side-channel AR38, §Sécurité 2.7). Les actions
-- de modération co-mod restent publiques (FR33 transparence radicale).
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists moderation_log_public_select on public.moderation_log;
drop policy if exists moderation_log_consent_residence_select on public.moderation_log;

create policy moderation_log_public_select on public.moderation_log
  for select
  using (
    action not in (
      'artisan_published',
      'artisan_consent_refused',
      'artisan_retracted',
      'artisan_reconsent_requested',
      'artisan_reconsent_refused'
    )
  );

create policy moderation_log_consent_residence_select on public.moderation_log
  for select
  to authenticated
  using (
    action in (
      'artisan_published',
      'artisan_consent_refused',
      'artisan_retracted',
      'artisan_reconsent_requested',
      'artisan_reconsent_refused'
    )
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.residence_id = moderation_log.residence_id
        and u.deleted_at is null
    )
  );
