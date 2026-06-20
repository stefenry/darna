-- Story 4.1 — ENUMs du domaine éphémère (alertes & bons plans).
--
-- ADD VALUE non-transactionnel : ces valeurs doivent être committed AVANT toute
-- migration qui les utilise dans une policy, un trigger ou une RPC (leçon 2.5 /
-- 2.7 migrations split). Le schéma 20260630090100 (triggers log_ephemeral_created),
-- la RPC retract 20260630090200 et le cron 4.5 (moderation_log content_expired)
-- en dépendent.
--
--   - alert_created / tip_created       : audit publication (trigger AFTER INSERT, 4.2/4.3)
--   - alert_self_retracted / tip_self_… : retrait par l'auteur (RPC, 4.3), miroir
--                                         de rating_self_retracted (2.7)
--   - content_expired                   : auto-expiration cron (acteur système, 4.5)
--
-- `if not exists` pour l'idempotence (parité local ↔ prod).

alter type public.moderation_action add value if not exists 'alert_created';
alter type public.moderation_action add value if not exists 'tip_created';
alter type public.moderation_action add value if not exists 'alert_self_retracted';
alter type public.moderation_action add value if not exists 'tip_self_retracted';
alter type public.moderation_action add value if not exists 'content_expired';

-- Catégories de bons plans (FR29). Valeurs littérales i18n-résolues au render
-- (NFR47, pas de colonne display_name), cohérent avec useful_number_category (3.1).
create type public.tip_category as enum (
  'offre_voisin',
  'pret_objet',
  'evenement',
  'autre'
);
