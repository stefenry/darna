-- Story 2.7 — édition / retrait des contributions par leur auteur.
--
-- Colonnes draft PII (re-consent en place sur fiche published, Décision 1 option a)
-- + policy DELETE artisan_tags (diff tags à l'édition) + 4 RPCs SECURITY DEFINER :
--   - request_artisan_reconsent : édition PII → invalide tokens, crée un token,
--     écrit le draft (published) ou mute en place (pending_consent), log.
--   - retract_artisan : soft-delete cascade artisan → ratings → tokens + log.
--   - retract_own_rating : soft-delete d'une note (CHECK ≥1 axe interdit l'UPDATE
--     à NULL → soft-delete ; user_id=NULL, ADR 0006) + log.
--   - retract_own_comment : efface comment_text (note conservée) + log.
--
-- Chaque RPC valide `auth.uid()` en interne (pas un bypass d'autorité — seulement
-- des grants column-level deleted_*/pending_*). revoke public/anon, grant authenticated
-- (appel via client session du contributeur — divergence de 2.5 qui était service_role).

-- ─────────────────────────────────────────────────────────────────────────────
-- Schéma additif — colonnes draft PII (écrites UNIQUEMENT par la RPC ; pas de
-- grant column-level → invisible aux UPDATE résident ; pas de FTS dessus).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.artisans
  add column if not exists pending_display_name_fr text,
  add column if not exists pending_phone_e164 text;

-- ─────────────────────────────────────────────────────────────────────────────
-- artisan_tags : policy DELETE manquante (le schéma 2.1 n'a que SELECT/INSERT).
-- Nécessaire au diff tags de l'édition (DELETE puis INSERT). Gate par ownership
-- de l'artisan parent.
-- ─────────────────────────────────────────────────────────────────────────────
create policy artisan_tags_resident_delete on public.artisan_tags
  for delete
  using (
    exists (
      select 1 from public.artisans a
      where a.id = artisan_id and a.created_by = auth.uid()
    )
  );
grant delete on public.artisan_tags to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC request_artisan_reconsent (AC3/AC4) — le raw token est généré côté Server
-- Action (lib/consent/token) ; seul le hash est passé ici.
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
  a record;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select id, created_by, state, deleted_at, display_name_fr, phone_e164, residence_id
    into a
    from public.artisans
   where id = p_artisan_id;
  if not found or a.deleted_at is not null or a.created_by is distinct from v_uid then
    raise exception 'forbidden';
  end if;

  if a.state = 'published' then
    -- Draft : la fiche publiée reste inchangée et visible ; la nouvelle PII est
    -- stockée en pending_* (promue à l'acceptation par process_artisan_consent).
    update public.artisans
       set pending_display_name_fr = p_new_name_fr,
           pending_phone_e164 = p_new_phone,
           updated_at = now()
     where id = p_artisan_id;
  elsif a.state = 'pending_consent' then
    -- Jamais visible (RLS published) → mutation directe en place, pas de draft.
    update public.artisans
       set display_name_fr = p_new_name_fr,
           phone_e164 = p_new_phone,
           updated_at = now()
     where id = p_artisan_id;
  else
    raise exception 'forbidden'; -- refused / état inattendu
  end if;

  -- Invalide les tokens pending (un seul re-consent actif à la fois).
  update public.artisan_consent_tokens
     set used_at = now()
   where artisan_id = p_artisan_id and used_at is null and expires_at > now();

  -- Nouveau token (expiry 24h, aligné 2.5/P28).
  insert into public.artisan_consent_tokens (artisan_id, residence_id, token_hash, expires_at)
    values (p_artisan_id, a.residence_id, p_new_token_hash, now() + interval '24 hours');

  insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
    values (a.residence_id, v_uid, 'artisan_reconsent_requested', 'artisan', p_artisan_id);

  -- L'appelant passe déjà la cible (nouveau phone si change, sinon ancien) et le
  -- nom à afficher dans le SMS.
  return query select 'ok'::text, p_new_phone, p_new_name_fr;
end;
$$;

revoke execute on function public.request_artisan_reconsent(uuid, text, text, text) from public;
revoke execute on function public.request_artisan_reconsent(uuid, text, text, text) from anon;
grant execute on function public.request_artisan_reconsent(uuid, text, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC retract_artisan (AC8) — soft-delete cascade transactionnel.
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
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select created_by, deleted_at, residence_id
    into a
    from public.artisans
   where id = p_artisan_id;
  if not found or a.created_by is distinct from v_uid then
    raise exception 'forbidden';
  end if;
  if a.deleted_at is not null then
    return; -- idempotent
  end if;

  update public.artisans
     set deleted_at = now(), deleted_by = v_uid,
         deletion_reason = 'author_retract', updated_at = now()
   where id = p_artisan_id;

  update public.ratings
     set deleted_at = now(), deleted_by = v_uid,
         deletion_reason = 'artisan_retracted', updated_at = now()
   where artisan_id = p_artisan_id and deleted_at is null;

  update public.artisan_consent_tokens
     set used_at = now()
   where artisan_id = p_artisan_id and used_at is null;

  insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
    values (a.residence_id, v_uid, 'artisan_retracted', 'artisan', p_artisan_id);
end;
$$;

revoke execute on function public.retract_artisan(uuid) from public;
revoke execute on function public.retract_artisan(uuid) from anon;
grant execute on function public.retract_artisan(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC retract_own_rating (AC6) — soft-delete d'une note (user_id=NULL, ADR 0006).
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
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select user_id, deleted_at, residence_id
    into r
    from public.ratings
   where id = p_rating_id;
  if not found then
    raise exception 'forbidden';
  end if;
  if r.deleted_at is not null then
    return; -- idempotent (déjà retirée)
  end if;
  if r.user_id is distinct from v_uid then
    raise exception 'forbidden';
  end if;

  update public.ratings
     set deleted_at = now(), deleted_by = v_uid,
         deletion_reason = 'author_retract', user_id = null, updated_at = now()
   where id = p_rating_id;

  insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
    values (r.residence_id, v_uid, 'rating_removed', 'rating', p_rating_id);
end;
$$;

revoke execute on function public.retract_own_rating(uuid) from public;
revoke execute on function public.retract_own_rating(uuid) from anon;
grant execute on function public.retract_own_rating(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC retract_own_comment (AC7) — efface comment_text (note conservée) + log.
-- (comment_text est grantée en UPDATE, mais l'INSERT moderation_log demande
-- SECURITY DEFINER → on fait les deux atomiquement ici.)
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
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select user_id, deleted_at, residence_id
    into r
    from public.ratings
   where id = p_rating_id;
  if not found then
    raise exception 'forbidden';
  end if;
  if r.deleted_at is not null then
    return; -- idempotent
  end if;
  if r.user_id is distinct from v_uid then
    raise exception 'forbidden';
  end if;

  update public.ratings
     set comment_text = null, updated_at = now()
   where id = p_rating_id;

  insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
    values (r.residence_id, v_uid, 'comment_removed', 'rating', p_rating_id);
end;
$$;

revoke execute on function public.retract_own_comment(uuid) from public;
revoke execute on function public.retract_own_comment(uuid) from anon;
grant execute on function public.retract_own_comment(uuid) to authenticated;
