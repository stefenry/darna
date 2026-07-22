-- Gestion des compétences artisan par les co_mods (spec docs/superpowers/specs/
-- 2026-07-23-comod-tags-admin-design.md).
--
-- La table `tags` est GLOBALE (pas de residence_id) : plutôt que d'ouvrir des
-- policies d'écriture non scopées, les écritures passent par deux RPC
-- SECURITY DEFINER avec gardes SQL (pattern comod_remove_resident) —
-- génération du slug `key` et déduplication atomiques côté base.
--
-- Codes d'erreur (RAISE EXCEPTION, mappés dans app/[locale]/comod/admin/
-- _actions/tags.ts) : forbidden, invalid_label, duplicate, not_found.

-- Slugification des libellés (électricité → electricite). Convention Supabase :
-- les extensions vivent dans le schéma `extensions`.
create extension if not exists unaccent with schema extensions;

-- Normalisation partagée add/rename : minuscules + sans accents + trim.
-- `stable` (pas immutable) : unaccent dépend de son dictionnaire.
create or replace function public.normalize_tag_label(p_label text)
returns text
language sql
stable
set search_path = public
as $$
  select lower(extensions.unaccent(btrim(coalesce(p_label, ''))));
$$;

create or replace function public.comod_add_tag(
  p_label_fr text,
  p_label_ar text default null
)
returns table (key text, label_fr text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text := btrim(coalesce(p_label_fr, ''));
  v_label_ar text := nullif(btrim(coalesce(p_label_ar, '')), '');
  v_norm text;
  v_key text;
begin
  if auth.uid() is null or auth_role() <> 'co_mod' then
    raise exception 'forbidden';
  end if;

  if char_length(v_label) < 2 or char_length(v_label) > 40 then
    raise exception 'invalid_label';
  end if;

  v_norm := normalize_tag_label(v_label);
  -- Slug snake_case aligné sur le seed existant (iptv_satellite, internet_wifi…).
  v_key := btrim(regexp_replace(v_norm, '[^a-z0-9]+', '_', 'g'), '_');
  if v_key = '' then
    raise exception 'invalid_label';
  end if;

  -- Dédup par clé ET par libellé normalisé (« Plombier » vs « plombier  »).
  if exists (
    select 1 from public.tags t
     where t.key = v_key or normalize_tag_label(t.label_fr) = v_norm
  ) then
    raise exception 'duplicate';
  end if;

  return query
  insert into public.tags as t (key, label_fr, label_ar)
  values (v_key, v_label, v_label_ar)
  returning t.key, t.label_fr;
end;
$$;

revoke execute on function public.comod_add_tag(text, text) from public;
grant execute on function public.comod_add_tag(text, text) to authenticated;

create or replace function public.comod_rename_tag(
  p_key text,
  p_label_fr text,
  p_label_ar text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text := btrim(coalesce(p_label_fr, ''));
  v_label_ar text := nullif(btrim(coalesce(p_label_ar, '')), '');
  v_norm text;
begin
  if auth.uid() is null or auth_role() <> 'co_mod' then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.tags t where t.key = p_key) then
    raise exception 'not_found';
  end if;

  if char_length(v_label) < 2 or char_length(v_label) > 40 then
    raise exception 'invalid_label';
  end if;

  v_norm := normalize_tag_label(v_label);
  -- Le libellé ne doit pas entrer en collision avec un AUTRE tag.
  if exists (
    select 1 from public.tags t
     where t.key <> p_key and normalize_tag_label(t.label_fr) = v_norm
  ) then
    raise exception 'duplicate';
  end if;

  -- `key` immuable (référencée par artisan_tags + filtres) : seuls les libellés bougent.
  update public.tags t
     set label_fr = v_label,
         label_ar = v_label_ar
   where t.key = p_key;
end;
$$;

revoke execute on function public.comod_rename_tag(text, text, text) from public;
grant execute on function public.comod_rename_tag(text, text, text) to authenticated;
