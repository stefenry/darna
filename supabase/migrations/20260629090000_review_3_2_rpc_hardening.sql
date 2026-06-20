-- Story 3.2 code review (2026-06-20) — hardening RPC + cohérence FR48 list/detail.
--
-- P6  : RPC defense-in-depth — ajouter `g.residence_id = auth_residence_id()` en
--       plus de la RLS (preuve d'isolation indépendante d'une régression policy).
-- P8  : CTE `matched` → ts_headline calculé sur les 30 lignes triées (post-limit),
--       au lieu d'être calculé sur toutes les lignes matchées (perf 5000→30).
-- P13 : Splitter en 2 paths PLPGSQL (`p_locale='ar'` vs 'fr') pour que le planneur
--       Postgres utilise les index GIN partial sur la bonne colonne (`search_*_tsv`).
--       Le `WHERE (CASE…) @@ tsq` précédent forçait un seq scan.
-- P15 : Valider `p_locale ∈ ('fr','ar')` — refus explicite vs tolérance silencieuse.
-- P17 : Generated col `ar_complete` sur guide_entries — permet à la liste de
--       déterminer la complétude AR sans bandwidth body (FR48 cohérent list/detail).

-- ─────────────────────────────────────────────────────────────────────────────
-- P17 : colonne générée `ar_complete` — true ssi titre ET corps AR présents/non-vides.
-- Utilisée par `fetchGuideEntries` (liste) pour calculer le flag `untranslated`
-- (FR48) sans charger `body_ar_markdown` (50KB max × N entrées = bandwidth 3G).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.guide_entries
  add column ar_complete boolean
  generated always as (
    title_ar is not null
    and length(trim(title_ar)) > 0
    and body_ar_markdown is not null
    and length(trim(body_ar_markdown)) > 0
  ) stored;

-- Grant select sur la nouvelle colonne (cohérence avec les autres colonnes lues).
grant select (ar_complete) on public.guide_entries to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- P6/P8/P13/P15 : refonte RPC `search_guide_entries` en PLPGSQL avec 2 branches.
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.search_guide_entries(text, text);

create function public.search_guide_entries(p_query text, p_locale text)
returns table (
  slug text,
  theme_key public.guide_theme_key,
  title text,
  snippet text,
  rank real
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_residence uuid := public.auth_residence_id();
  v_tsq tsquery;
begin
  -- P15 : whitelister la locale (NFR47 — enums littéraux côté DB).
  if p_locale is null or p_locale not in ('fr', 'ar') then
    raise exception 'invalid_locale' using errcode = '22023';
  end if;

  -- Pas de résidence dans le JWT → 0 résultats (RLS aurait filtré, mais
  -- court-circuit explicite — P6 defense-in-depth).
  if v_residence is null then
    return;
  end if;

  if p_locale = 'ar' then
    v_tsq := websearch_to_tsquery('simple', p_query);
    -- P8 : CTE pour limiter ts_headline aux 30 lignes triées.
    return query
      with matched as (
        select
          g.slug,
          g.theme_key,
          g.title_fr,
          g.title_ar,
          g.body_fr_markdown,
          g.body_ar_markdown,
          ts_rank(g.search_ar_tsv, v_tsq) as rank
        from public.guide_entries g
        where g.deleted_at is null
          and g.residence_id = v_residence              -- P6
          and g.search_ar_tsv @@ v_tsq                  -- P13 (index GIN ar)
        order by rank desc
        limit 30
      )
      select
        m.slug,
        m.theme_key,
        coalesce(nullif(trim(m.title_ar), ''), m.title_fr) as title,
        ts_headline(
          'simple',
          coalesce(nullif(trim(m.title_ar), ''), m.title_fr)
            || ' — '
            || coalesce(nullif(trim(m.body_ar_markdown), ''), m.body_fr_markdown),
          v_tsq,
          'StartSel=<mark>,StopSel=</mark>,MaxFragments=1,MinWords=5,MaxWords=20'
        ) as snippet,
        m.rank
      from matched m
      order by m.rank desc;
  else
    v_tsq := websearch_to_tsquery('french', p_query);
    return query
      with matched as (
        select
          g.slug,
          g.theme_key,
          g.title_fr,
          g.body_fr_markdown,
          ts_rank(g.search_fr_tsv, v_tsq) as rank
        from public.guide_entries g
        where g.deleted_at is null
          and g.residence_id = v_residence              -- P6
          and g.search_fr_tsv @@ v_tsq                  -- P13 (index GIN fr)
        order by rank desc
        limit 30
      )
      select
        m.slug,
        m.theme_key,
        m.title_fr as title,
        ts_headline(
          'french',
          m.title_fr || ' — ' || m.body_fr_markdown,
          v_tsq,
          'StartSel=<mark>,StopSel=</mark>,MaxFragments=1,MinWords=5,MaxWords=20'
        ) as snippet,
        m.rank
      from matched m
      order by m.rank desc;
  end if;
end;
$$;

-- Least privilege (idem avant).
revoke execute on function public.search_guide_entries(text, text) from public, anon;
grant execute on function public.search_guide_entries(text, text) to authenticated;

-- NOTE — XSS via ts_headline : le rendu du `snippet` côté client utilise désormais
-- un parser React (split sur `<mark>`/`</mark>`) — voir
-- `app/[locale]/community/guide/_components/guide-search-results.tsx`. Le RPC
-- garde `<mark>` comme délimiteur, mais le caractère `<` du source utilisateur
-- est désormais inerte (React échappe par défaut), même si Postgres ne l'échappe pas.
