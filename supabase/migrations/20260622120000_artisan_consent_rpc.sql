-- Story 2.5 — RPC transactionnelle de consentement artisan.
--
-- La page/route de consentement est PUBLIQUE (artisan sans compte, sans session)
-- → impossible d'écrire via RLS client. Cette RPC `SECURITY DEFINER` est le SEUL
-- chemin d'écriture : elle valide le token (existence/expiry/used) et applique la
-- décision en UNE transaction (state + used_at + moderation_log). Idempotente
-- (un token `used` ne change rien). [ADR 0004 §écritures sensibles SECURITY DEFINER]
--
-- Statuts renvoyés : not_found / expired / already_used / accepted / refused /
-- invalid_decision. La route mappe vers 401 (not_found, AR38) / page dédiée.

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
  state public.artisan_state
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  select
    t.id as token_id,
    t.used_at,
    t.expires_at,
    a.id as a_id,
    a.slug as a_slug,
    a.created_by,
    a.display_name_fr,
    a.state as a_state,
    a.residence_id as a_res
  into v
  from public.artisan_consent_tokens t
  join public.artisans a on a.id = t.artisan_id
  where t.token_hash = p_token_hash;

  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::uuid, null::text,
                        null::public.artisan_state;
    return;
  end if;

  if v.used_at is not null then
    return query select 'already_used'::text, v.a_id, v.a_slug, v.created_by, v.display_name_fr, v.a_state;
    return;
  end if;

  if v.expires_at < now() then
    return query select 'expired'::text, v.a_id, v.a_slug, v.created_by, v.display_name_fr, v.a_state;
    return;
  end if;

  if p_decision = 'accept' then
    update public.artisans
      set state = 'published', published_at = now(), updated_at = now()
      where id = v.a_id;
    update public.artisan_consent_tokens set used_at = now() where id = v.token_id;
    insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
      values (v.a_res, null, 'artisan_published', 'artisan', v.a_id);
    return query select 'accepted'::text, v.a_id, v.a_slug, v.created_by, v.display_name_fr,
                        'published'::public.artisan_state;

  elsif p_decision = 'refuse' then
    update public.artisans
      set state = 'refused', deleted_at = now(), deletion_reason = 'consent_refused', updated_at = now()
      where id = v.a_id;
    update public.artisan_consent_tokens set used_at = now() where id = v.token_id;
    insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
      values (v.a_res, null, 'artisan_consent_refused', 'artisan', v.a_id);
    return query select 'refused'::text, v.a_id, v.a_slug, v.created_by, v.display_name_fr,
                        'refused'::public.artisan_state;

  else
    return query select 'invalid_decision'::text, null::uuid, null::text, null::uuid, null::text,
                        null::public.artisan_state;
  end if;
end;
$$;

-- Appelant public (artisan sans session) via le webhook.
grant execute on function public.process_artisan_consent(text, text) to anon, authenticated;
