-- Story 2.8 — valeurs `moderation_action` pour le droit de réponse artisan.
-- Additives, committées AVANT les RPC qui les consomment (leçon 2.5 : `ALTER TYPE
-- ADD VALUE` ne peut être utilisé dans la même transaction que son ajout).
alter type public.moderation_action add value if not exists 'artisan_response_published';
alter type public.moderation_action add value if not exists 'artisan_rectification_requested';
