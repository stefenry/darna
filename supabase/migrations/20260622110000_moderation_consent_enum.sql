-- Story 2.5 — valeurs d'événement consentement pour moderation_log.
--
-- `ALTER TYPE ... ADD VALUE` ne peut pas être UTILISÉ dans la même transaction
-- qui l'ajoute → migration DÉDIÉE (commitée avant la RPC `process_artisan_consent`
-- qui s'en sert, migration suivante).

alter type public.moderation_action add value if not exists 'artisan_published';
alter type public.moderation_action add value if not exists 'artisan_consent_refused';
