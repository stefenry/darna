-- Story 8.1 (FR51, NFR52, NFR16) — compteurs publics agrégés pour /transparence.
--
-- RPC SECURITY DEFINER : la page /transparence est PUBLIQUE (anon + authenticated),
-- l'anon n'a aucune résidence et la RLS masque les lignes soft-deleted / cross-tenant.
-- Pour calculer des AGRÉGATS cumulatifs (incluant les items expirés/retirés) il faut
-- bypasser la RLS — ce que fait `security definer`. La sortie est STRICTEMENT
-- agrégée (COUNT / SUM) : zéro PII exposée, jamais (NFR52, NFR16). MVP mono-résidence
-- → on agrège sur toute la base (= la résidence Darna). Multi-tenant futur : ajouter
-- un paramètre p_residence_id borné à auth_residence_id() pour l'espace authentifié.
--
-- Définitions des compteurs (cf. story 8.1 AC1) :
--   villas_inscrites   : villas distinctes parmi les profils vivants (non soft-deleted)
--   artisans_publies   : fiches state='published' vivantes
--   avis_postes        : notes/avis vivants (non retirés)
--   alertes_emises     : cumulatif — toutes les alertes jamais émises (incl. expirées)
--   bons_plans_publies : cumulatif — tous les bons plans jamais publiés
--   actions_moderation : cumulatif — toutes les entrées du journal de modération
--   partages_externes  : somme des compteurs de partage dénormalisés (6.2)

create or replace function public.transparency_counters()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'villas_inscrites',
      (select count(distinct villa) from public.profiles where deleted_at is null),
    'artisans_publies',
      (select count(*) from public.artisans where state = 'published' and deleted_at is null),
    'avis_postes',
      (select count(*) from public.ratings where deleted_at is null),
    'alertes_emises',
      (select count(*) from public.alerts),
    'bons_plans_publies',
      (select count(*) from public.tips),
    'actions_moderation',
      (select count(*) from public.moderation_log),
    'partages_externes',
      (
        select coalesce(sum(share_count), 0)::bigint from (
          select share_count from public.artisans
          union all select share_count from public.alerts
          union all select share_count from public.tips
          union all select share_count from public.guide_entries
        ) s
      )
  );
$$;

-- Lecture publique : compteurs agrégés, aucune PII (NFR52). anon + authenticated.
revoke execute on function public.transparency_counters() from public;
grant execute on function public.transparency_counters() to anon, authenticated;
