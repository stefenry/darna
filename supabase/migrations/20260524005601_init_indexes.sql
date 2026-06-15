-- Story 1.3 — Indexes pour performance (AR15 naming idx_<table>_<colonnes>).
-- FTS GIN tsvector (annuaire bilingue) : différé Epic 2.

-- File co-mod : "donne-moi les demandes pending de ma résidence".
create index idx_admission_requests_residence_id_state
  on public.admission_requests (residence_id, state);

-- Lookup self : "donne-moi mes demandes".
create index idx_admission_requests_user_id
  on public.admission_requests (user_id);

-- Scope résidence (filtre users).
create index idx_users_residence_id
  on public.users (residence_id);

-- Annuaire résidence.
create index idx_profiles_residence_id
  on public.profiles (residence_id);

-- Page transparence : "journal des actions de ma résidence trié par date desc".
create index idx_moderation_log_residence_id_created_at
  on public.moderation_log (residence_id, created_at desc);

-- Composite multi-tenant V3 — la PK user_id suffit aujourd'hui, mais ce
-- composite anticipera les query "prefs d'une résidence" sans full scan.
create index idx_notifications_prefs_residence_id_user_id
  on public.notifications_prefs (residence_id, user_id);
