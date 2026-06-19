-- Story 2.5 code review (2026-06-19) — hardening sécurité.
--
-- P1 : RPC `process_artisan_consent` — atomicité via gate `UPDATE ... WHERE
--      used_at IS NULL RETURNING` + check `state='pending_consent' AND
--      deleted_at IS NULL` côté JOIN. Empêche double accept/refuse sous race,
--      empêche résurrection d'un artisan soft-deleted.
-- P2 : RPC GRANT — RÉVOQUER `anon, authenticated` (court-circuite le rate-limit
--      du webhook si appelée directement depuis un client web). Le webhook
--      utilise `createAdminClient` (service_role) → seul ce path est légitime.
-- P4 : `artisan_consent_tokens.token_hash` — index UNIQUE (collision théorique
--      HMAC + drift applicatif rendent `maybeSingle()` PGRST116 → faux négatif
--      AR38 ; `SELECT INTO` indéterministe).
-- P5 : `moderation_log` — la lecture publique (FR33 transparence radicale) est
--      OK pour les actions de modération co-mod (admission, contenu), mais
--      révèle un side-channel AR38 pour les events de consentement artisan
--      (un attaquant connaissant `artisan.id` voit si l'artisan a accepté ou
--      refusé). Restreindre la lecture des 2 actions consent aux résidents
--      même résidence (les autres actions restent publiques pour FR33).

-- ─────────────────────────────────────────────────────────────────────────────
-- P4 : UNIQUE token_hash
-- ─────────────────────────────────────────────────────────────────────────────
create unique index if not exists artisan_consent_tokens_token_hash_unique
  on public.artisan_consent_tokens (token_hash);

-- ─────────────────────────────────────────────────────────────────────────────
-- P1 : RPC durcie — gate atomique + guards state/deleted_at
-- Le return type change (ajout `display_name_ar`) → DROP + CREATE (CREATE OR
-- REPLACE ne peut pas modifier la signature).
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.process_artisan_consent(text, text);

create function public.process_artisan_consent(
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
begin
  -- Lookup minimal : juste pour détecter not_found / expired / already_used.
  select
    t.id as token_id,
    t.used_at,
    t.expires_at,
    a.id as a_id,
    a.slug as a_slug,
    a.created_by,
    a.display_name_fr,
    a.display_name_ar,
    a.state as a_state,
    a.deleted_at as a_deleted_at,
    a.residence_id as a_res
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

  -- Guards state/deleted_at : un artisan soft-deleted ou hors `pending_consent`
  -- ne doit pas pouvoir changer d'état via cette RPC (review P1).
  if v.a_state != 'pending_consent' or v.a_deleted_at is not null then
    return query select 'already_used'::text, v.a_id, v.a_slug, v.created_by,
                        v.display_name_fr, v.display_name_ar, v.a_state;
    return;
  end if;

  if p_decision not in ('accept', 'refuse') then
    return query select 'invalid_decision'::text, null::uuid, null::text, null::uuid,
                        null::text, null::text, null::public.artisan_state;
    return;
  end if;

  -- Gate atomique : un seul des appels concurrents fera l'UPDATE et obtiendra
  -- un id retourné ; les autres voient 0 lignes → bail out via "already_used".
  update public.artisan_consent_tokens
    set used_at = now()
    where id = v.token_id and used_at is null
    returning id into v_token_id;

  if v_token_id is null then
    -- Race perdue : un autre appel concurrent a flaggé used_at entre-temps.
    return query select 'already_used'::text, v.a_id, v.a_slug, v.created_by,
                        v.display_name_fr, v.display_name_ar, v.a_state;
    return;
  end if;

  if p_decision = 'accept' then
    update public.artisans
      set state = 'published', published_at = now(), updated_at = now()
      where id = v.a_id;
    insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
      values (v.a_res, null, 'artisan_published', 'artisan', v.a_id);
    return query select 'accepted'::text, v.a_id, v.a_slug, v.created_by,
                        v.display_name_fr, v.display_name_ar,
                        'published'::public.artisan_state;
  else
    -- refuse
    update public.artisans
      set state = 'refused', deleted_at = now(), deletion_reason = 'consent_refused', updated_at = now()
      where id = v.a_id;
    insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
      values (v.a_res, null, 'artisan_consent_refused', 'artisan', v.a_id);
    return query select 'refused'::text, v.a_id, v.a_slug, v.created_by,
                        v.display_name_fr, v.display_name_ar,
                        'refused'::public.artisan_state;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P2 : GRANT EXECUTE → service_role uniquement (révoquer anon/authenticated).
-- ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.process_artisan_consent(text, text) from anon;
revoke execute on function public.process_artisan_consent(text, text) from authenticated;
revoke execute on function public.process_artisan_consent(text, text) from public;
grant execute on function public.process_artisan_consent(text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- P5 : moderation_log — restreindre les actions consent au résident résidence.
-- Les autres actions (admission, etc.) restent publiques (FR33 transparence).
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists moderation_log_public_select on public.moderation_log;

-- Lecture publique des actions non-consent (FR33 transparence radicale conservée).
create policy moderation_log_public_select on public.moderation_log
  for select
  using (
    action not in ('artisan_published', 'artisan_consent_refused')
  );

-- Lecture des actions consent : résident de la même résidence uniquement.
create policy moderation_log_consent_residence_select on public.moderation_log
  for select
  to authenticated
  using (
    action in ('artisan_published', 'artisan_consent_refused')
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.residence_id = moderation_log.residence_id
        and u.deleted_at is null
    )
  );
