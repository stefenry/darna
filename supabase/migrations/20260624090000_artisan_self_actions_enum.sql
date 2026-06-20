-- Story 2.7 — valeurs `moderation_action` pour l'édition/retrait contributeur.
-- Additif, committé AVANT les RPC qui les consomment (leçon 2.5 : `ALTER TYPE
-- ADD VALUE` ne peut être utilisé dans la même transaction que son ajout).
-- `rating_removed` / `comment_removed` existent déjà (init_enums.sql l.38-39).
alter type public.moderation_action add value if not exists 'artisan_retracted';
alter type public.moderation_action add value if not exists 'artisan_reconsent_requested';
alter type public.moderation_action add value if not exists 'artisan_reconsent_refused';
