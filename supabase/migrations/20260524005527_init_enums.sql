-- Story 1.3 — ENUMs Postgres pour le flow admission (FR1-FR11, AR15).
-- snake_case partout (AR15). Extensible : story 5.x utilise ALTER TYPE pour
-- ajouter des valeurs au moderation_action.

create type public.user_role as enum (
  'resident',
  'co_mod',
  'demandeur',
  'public'
);

create type public.admission_state as enum (
  'pending',
  'accepted',
  'rejected'
);

-- Liste fermée (AC validation co-mod, UX spec ligne 884).
create type public.admission_decision_reason as enum (
  'villa_out_of_range',
  'duplicate',
  'incomplete_info',
  'manual_review_needed'
);

-- Canal magic-link choisi par le demandeur (PRD ligne 840).
create type public.admission_contact_channel as enum (
  'email',
  'sms'
);

-- Extensible — Story 5.x ajoutera report_*, escalation_* via ALTER TYPE.
create type public.moderation_action as enum (
  'admission_accepted',
  'admission_rejected',
  'user_deleted',
  'content_removed',
  'rating_removed',
  'comment_removed'
);
