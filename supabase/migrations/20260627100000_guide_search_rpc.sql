-- Story 3.2 (AC2/AC8) — RPC de recherche plein-texte du Guide.
--
-- `search_guide_entries(p_query, p_locale)` : classement par pertinence (ts_rank)
-- + snippet surligné (ts_headline). Impossible via PostgREST `.textSearch()` seul
-- (pas de rank ni de headline). SECURITY INVOKER → hérite la RLS du résident
-- appelant (`guide_entries_resident_select_residence`) : aucune fuite cross-tenant,
-- jamais SECURITY DEFINER. `set search_path = public` (anti-injection).
--
-- p_locale ∈ {'fr','ar'} → config FTS `french`/`simple` (ADR 0001, AR n'a pas de
-- config Postgres). websearch_to_tsquery est sûr par construction (pas de parse
-- d'opérateurs tsquery bruts). La longueur de p_query est bornée côté data layer
-- (sanitizeQuery, MAX_QUERY_LENGTH).
--
-- NOTE timestamp : story prévoyait 20260623100000 — décalé à 20260627100000 pour
-- la monotonie (slot pris par le travail Epic 2). Voir migration 3.1.

create function public.search_guide_entries(p_query text, p_locale text)
returns table (
  slug text,
  theme_key public.guide_theme_key,
  title text,
  snippet text,
  rank real
)
language sql
stable
security invoker
set search_path = public
as $$
  with cfg as (
    select case when p_locale = 'ar' then 'simple'::regconfig else 'french'::regconfig end as rc
  ),
  q as (
    select websearch_to_tsquery((select rc from cfg), p_query) as tsq
  )
  select
    g.slug,
    g.theme_key,
    coalesce(case when p_locale = 'ar' then g.title_ar else g.title_fr end, g.title_fr) as title,
    ts_headline(
      (select rc from cfg),
      coalesce(case when p_locale = 'ar' then g.title_ar else g.title_fr end, g.title_fr)
        || ' — '
        || coalesce(
             case when p_locale = 'ar' then g.body_ar_markdown else g.body_fr_markdown end,
             g.body_fr_markdown
           ),
      (select tsq from q),
      'StartSel=<mark>,StopSel=</mark>,MaxFragments=1,MinWords=5,MaxWords=20'
    ) as snippet,
    ts_rank(
      case when p_locale = 'ar' then g.search_ar_tsv else g.search_fr_tsv end,
      (select tsq from q)
    ) as rank
  from public.guide_entries g
  where g.deleted_at is null
    and (case when p_locale = 'ar' then g.search_ar_tsv else g.search_fr_tsv end)
        @@ (select tsq from q)
  order by rank desc
  limit 30;
$$;

-- Least privilege : exécutable par les sessions authentifiées uniquement (la RLS
-- INVOKER scope ensuite la résidence). anon n'a aucune résidence → rien à chercher.
revoke execute on function public.search_guide_entries(text, text) from public, anon;
grant execute on function public.search_guide_entries(text, text) to authenticated;
