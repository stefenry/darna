-- Story 2.2 — Vue d'agrégat de notation par axe pour l'annuaire.
--
-- L'annuaire (liste + fiche) affiche, par artisan, la moyenne et le nombre de
-- voix sur chacun des 4 axes typés (Dépannage / Petits travaux / Travail soigné
-- / Urgences). `supabase-js` n'exprime pas proprement un GROUP BY agrégé inline
-- → on encapsule le calcul dans une vue.
--
-- SÉCURITÉ (ADR 0004) : `security_invoker = true` (Postgres 15+) → la vue
-- s'exécute avec les droits ET la RLS du LECTEUR, pas du créateur. La policy
-- `ratings_resident_select_residence` (story 2.1) s'applique donc : un résident
-- ne voit que les notes de sa résidence. JAMAIS `security definer` ici (cela
-- bypasserait le scoping multi-tenant).
--
-- Notes anonymisées (`user_id IS NULL`, purge ADR 0006) : non dédupables
-- (résidu connu story 2.1) → l'agrégat moyenne simplement toutes les lignes
-- `deleted_at is null`. Comportement assumé.

create view public.artisan_rating_aggregates
  with (security_invoker = true)
as
  select
    artisan_id,
    avg(score_depannage)::numeric(3, 2)        as avg_depannage,
    count(score_depannage)                      as n_depannage,
    avg(score_petits_travaux)::numeric(3, 2)   as avg_petits_travaux,
    count(score_petits_travaux)                 as n_petits_travaux,
    avg(score_travail_soigne)::numeric(3, 2)   as avg_travail_soigne,
    count(score_travail_soigne)                 as n_travail_soigne,
    avg(score_urgences)::numeric(3, 2)         as avg_urgences,
    count(score_urgences)                       as n_urgences,
    count(*)                                     as n_total
  from public.ratings
  where deleted_at is null
  group by artisan_id;

-- Lecture réservée aux résidents authentifiés (l'annuaire est privé). La RLS de
-- `ratings` fait l'isolation effective ; ce GRANT expose la vue à PostgREST.
grant select on public.artisan_rating_aggregates to authenticated;
