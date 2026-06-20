-- Story 5.1 — ENUMs modération réactive (fichier séparé : ADD VALUE doit être
-- committé AVANT d'être utilisé dans une colonne/fonction — pattern
-- 20260630090000_ephemeral_enums). Couvre AR5 (enums fermés), AR15.
--
-- Décisions (cf. story 5.1 Dev Notes) :
--   - target_type élargi à `useful_number` (signalable en 5.2) et conserve
--     `alert_comment` (forward-compat Epic 6.4).
--   - report_state minimal {open, closed_removed, closed_kept} — les états
--     juridiques sont ajoutés en 5.5 (ADD VALUE incrémental).
--   - moderation_action += report_opened / content_kept / escalation_triggered.
--     content_removed / rating_removed / comment_removed / user_deleted existent
--     déjà (Epic 1) et sont réutilisés pour les retraits (5.3).

-- Type de cible d'un signalement (liste fermée — anti-injection table en RPC).
create type public.report_target_type as enum (
  'artisan',
  'rating',
  'alert',
  'alert_comment',
  'tip',
  'guide_entry',
  'useful_number'
);

-- Motif de signalement (raison fermée — FR31).
create type public.report_reason as enum (
  'diffamation',
  'info_erronee',
  'harcelement',
  'spam',
  'hors_charte',
  'autre'
);

-- État du cycle de vie d'un signalement.
create type public.report_state as enum (
  'open',
  'closed_removed',
  'closed_kept'
);

-- Extension du journal de modération (Epic 1). `if not exists` = idempotent.
alter type public.moderation_action add value if not exists 'report_opened';
alter type public.moderation_action add value if not exists 'content_kept';
alter type public.moderation_action add value if not exists 'escalation_triggered';
