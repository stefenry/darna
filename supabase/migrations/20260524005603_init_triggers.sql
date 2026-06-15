-- Story 1.3 — Triggers updated_at (AR15 naming trg_<table>_<event>).
-- 1 fonction partagée + 5 triggers BEFORE UPDATE.
-- Pas de trigger sur moderation_log (log immutable, pas de updated_at).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
-- search_path figé pour éviter shadowing de now() via search_path manipulation
-- (review 1.3 — hygiène Postgres 15+).
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_residences_updated_at
  before update on public.residences
  for each row
  execute function public.set_updated_at();

create trigger trg_users_updated_at
  before update on public.users
  for each row
  execute function public.set_updated_at();

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

create trigger trg_admission_requests_updated_at
  before update on public.admission_requests
  for each row
  execute function public.set_updated_at();

create trigger trg_notifications_prefs_updated_at
  before update on public.notifications_prefs
  for each row
  execute function public.set_updated_at();
