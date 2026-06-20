-- Review Epic 4 (mineur) — exclure les auto-retraits d'auteur du journal PUBLIC.
--
-- `moderation_log_public` (5.4) alimente /transparence : c'est le journal des
-- DÉCISIONS DE MODÉRATION (responsabilité co_mod + actions système). Les actions
-- `*_self_retracted` sont des gestes de gestion par l'AUTEUR de son propre contenu,
-- pas des décisions de modération. Les afficher publiquement ajoute du bruit et
-- révèle qu'un contenu a existé puis été auto-retiré, sans servir la redevabilité
-- de modération — même raisonnement que l'exclusion de `report_opened` (signal
-- privé, D2). Elles restent dans `moderation_log` (audit interne / CNDP intact).
--
-- Recrée la vue à l'identique (5.1) en étendant la whitelist d'exclusion. Pas de
-- changement de colonnes ni de sémantique de redaction (actor_id jamais exposé ;
-- display_name seulement pour role='co_mod').

create or replace view public.moderation_log_public
with (security_invoker = false)
as
select
  ml.id,
  ml.created_at,
  ml.action,
  ml.target_kind,
  case when ml.action = 'user_deleted' then null else ml.target_id end as target_id,
  ml.reason_code,
  case when actor.role = 'co_mod' then actor.display_name end as actor_display_name,
  ml.residence_id,
  case when ml.action = 'user_deleted' then null else ml.payload_json end as payload_json
from public.moderation_log ml
left join public.users actor on actor.id = ml.actor_id
where ml.action not in (
  -- Actions consent-artisan : résidence-scoped, déjà non publiques (2.x).
  'artisan_published', 'artisan_consent_refused', 'artisan_retracted',
  'artisan_reconsent_requested', 'artisan_reconsent_refused',
  'artisan_reconsent_accepted',
  'artisan_response_published', 'artisan_rectification_requested',
  -- Signal privé : un report ouvert ne s'affiche pas sur /transparence (D2).
  'report_opened',
  -- Auto-retraits d'auteur : gestion perso, pas une décision de modération.
  'rating_self_retracted', 'alert_self_retracted', 'tip_self_retracted'
);

grant select on public.moderation_log_public to anon, authenticated;
