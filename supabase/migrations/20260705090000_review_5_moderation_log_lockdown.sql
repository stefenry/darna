-- Review Epic 5 (BLOQUANT) — fermer la lecture DIRECTE de la table moderation_log.
--
-- Contexte : `moderation_log` portait une policy SELECT « publique »
-- (`action not in (...)`) + un grant select table-wide à anon/authenticated
-- (parité locale, 20260621090000). La vue de redaction `moderation_log_public`
-- (5.1 / 5.4) masque correctement les colonnes PII (actor_id,
-- reason_text_anonymized) et les actions privées (report_opened, *_self_retracted)
-- — MAIS la table BRUTE restait directement interrogeable via PostgREST, ce qui
-- court-circuitait la vue :
--   • `report_opened` exposait l'identité du signalant (actor_id) + cible + motif
--     → effet glaçant, exactement ce que 5.1 D2 prétend empêcher ;
--   • `reason_text_anonymized` exposait la note libre du co_mod (RPC 5.3 / 5.5).
--
-- Correctif : la VUE devient l'UNIQUE chemin de lecture publique (5.4 D4). On
-- révoque le SELECT direct sur la table pour anon + authenticated et on supprime
-- la policy publique devenue trompeuse. RLS reste activée → deny-by-default si un
-- grant venait à être re-posé par erreur. Les writes restent système-only
-- (trigger log_report_opened + fonctions SECURITY DEFINER) ; service_role conserve
-- l'accès complet (cron purge, RPC). Les lectures co_mod (« actions antérieures »
-- de la file de modération) passent désormais par `moderation_log_public`, qui
-- expose ces actions de gouvernance sans les colonnes/actions sensibles.

revoke select on public.moderation_log from anon, authenticated;

-- Policy publique sur la table brute : supprimée. La redaction passe exclusivement
-- par la vue SECURITY DEFINER `moderation_log_public` (security_invoker=false →
-- elle lit la table avec les droits du propriétaire, indépendamment de ce revoke).
drop policy if exists moderation_log_public_select on public.moderation_log;
