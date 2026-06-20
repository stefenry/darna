-- Story 2.7 review (2026-06-20) — extension enum `moderation_action`.
--
-- ADD VALUE non-transactionnel : doit être committed AVANT toute migration qui
-- l'utilise dans une policy ou fonction (cf. leçon 2.5 migrations split).

alter type public.moderation_action add value if not exists 'rating_self_retracted';
alter type public.moderation_action add value if not exists 'comment_self_retracted';
alter type public.moderation_action add value if not exists 'artisan_reconsent_accepted';
