-- Story 1.3 — Row-Level Security multi-tenant (AR6, AR15).
-- 4 rôles : resident, co_mod, demandeur, public.
-- Naming strict : <table>_<role>_<action>.
-- Source rôle/residence : auth.jwt() → 'app_metadata' (peuplé par Story 1.8
-- via supabase.auth.admin.updateUserById côté service role).
-- Tests RLS exhaustifs alice/bob/eve : différés Story 1.10 (Gap #7, ADR 0008).

-- Helpers : extraire role et residence_id du JWT app_metadata.
-- STABLE permet au planner de cacher le résultat dans une requête.
create or replace function public.auth_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'public');
$$;

-- PL/pgSQL avec EXCEPTION pour ne pas crasher si app_metadata.residence_id
-- contient une chaîne non-UUID (review 1.3 — Edge Case Hunter #11).
create or replace function public.auth_residence_id()
returns uuid
language plpgsql
stable
as $$
declare
  v text;
begin
  v := nullif(auth.jwt() -> 'app_metadata' ->> 'residence_id', '');
  if v is null then
    return null;
  end if;
  return v::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- residences — lecture publique (1 résidence MVP, scope public).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.residences enable row level security;

create policy residences_public_select on public.residences
  for select
  using (deleted_at is null);

-- ─────────────────────────────────────────────────────────────────────────────
-- users — chaque user lit/met à jour son propre profil ; co_mod scope résidence.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.users enable row level security;

create policy users_resident_select_self on public.users
  for select
  using (auth.uid() = id);

create policy users_co_mod_select_residence on public.users
  for select
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  );

create policy users_resident_update_self on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Empêche auto-promotion : un user authentifié ne peut modifier QUE
-- display_name + lifecycle Pack accueil + updated_at. role, residence_id, et
-- colonnes soft-delete sont réservés au service_role (Server Actions Story
-- 1.6/1.8). Review 1.3 — Blind Hunter #10 (critique).
-- service_role bypass RLS et garde tous les privilèges.
-- Pattern obligatoire : REVOKE total puis GRANT colonnes autorisées (un REVOKE
-- column-level ne diminue pas un GRANT table-level Supabase préexistant).
revoke update on public.users from authenticated;
grant update (display_name, first_login_at, pack_accueil_dismissed_at, updated_at)
  on public.users to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles — résident lit les profils de sa résidence (annuaire post-MVP) ;
-- met à jour le sien uniquement.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- Annuaire résidence : seuls les rôles 'resident' et 'co_mod' (= admission
-- validée) voient les profils. Demandeurs en attente exclus. Soft-deleted
-- profiles et users masqués. Review 1.3 — Blind Hunter #9 (high).
-- TODO Story 1.8 : remplacer la sous-requête par auth_residence_id() une fois
-- que app_metadata.residence_id sera peuplé pour tous les résidents.
create policy profiles_resident_select_residence on public.profiles
  for select
  using (
    deleted_at is null
    and residence_id = (
      select residence_id from public.users
      where id = auth.uid()
        and role in ('resident', 'co_mod')
        and deleted_at is null
    )
  );

-- Policy SELECT explicite pour co_mod : dépendance modération Story 1.8.
-- Review 1.3 — Edge Case Hunter #5.
create policy profiles_co_mod_select_residence on public.profiles
  for select
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
    and deleted_at is null
  );

create policy profiles_resident_update_self on public.profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Idem users : un résident ne peut muter QUE villa, tranche, language,
-- identity_mode (champs profil) et updated_at. residence_id et soft-delete
-- sont réservés au service_role.
revoke update on public.profiles from authenticated;
grant update (villa, tranche, language, identity_mode, updated_at)
  on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- admission_requests — demandeur insère/lit la sienne ; co_mod scope résidence.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.admission_requests enable row level security;

create policy admission_requests_demandeur_select on public.admission_requests
  for select
  using (auth.uid() = user_id);

create policy admission_requests_demandeur_insert on public.admission_requests
  for insert
  with check (auth.uid() = user_id);

create policy admission_requests_co_mod_select on public.admission_requests
  for select
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  );

create policy admission_requests_co_mod_update on public.admission_requests
  for update
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  )
  with check (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  );

-- Aucune policy DELETE (soft-delete uniquement via UPDATE de deleted_at).

-- ── Défense en profondeur column-level sur admission_requests ──
-- (review 1.3 — Blind Hunter #11 critique + #12 high)
--
-- 1. INSERT : un demandeur ne peut renseigner QUE les colonnes du formulaire.
--    state/decision_reason/decided_*/timestamps sont gérés par défaut ou par
--    Server Actions service_role (Story 1.8). Sans ça, un demandeur pouvait
--    INSERT directement state='accepted', decided_by=self → auto-validation.
revoke insert on public.admission_requests from authenticated;
grant insert (user_id, residence_id, villa, tranche, first_name, contact_channel)
  on public.admission_requests to authenticated;
--
-- 2. UPDATE : co_mod ne peut muter QUE l'état décisionnel et soft-delete.
--    user_id/residence_id/villa/first_name/contact_channel/created_at sont
--    immutables après création (sinon un co_mod peut détourner une demande).
revoke update on public.admission_requests from authenticated;
grant update (state, decision_reason, decided_by, decided_at, updated_at,
              deleted_at, deleted_by, deletion_reason)
  on public.admission_requests to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- moderation_log — lecture publique (FR33 transparence radicale).
-- Pas de policy INSERT/UPDATE/DELETE côté client : writes système uniquement
-- via fonctions SECURITY DEFINER (Story 1.8+).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.moderation_log enable row level security;

create policy moderation_log_public_select on public.moderation_log
  for select
  using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- notifications_prefs — chaque user lit/écrit ses propres prefs.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.notifications_prefs enable row level security;

create policy notifications_prefs_resident_select_self on public.notifications_prefs
  for select
  using (auth.uid() = user_id);

create policy notifications_prefs_resident_insert_self on public.notifications_prefs
  for insert
  with check (auth.uid() = user_id);

create policy notifications_prefs_resident_update_self on public.notifications_prefs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
