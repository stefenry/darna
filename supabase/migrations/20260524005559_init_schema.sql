-- Story 1.3 — Schéma initial admission (6 tables) + auth bridge.
-- Multi-tenant J1 (AR7, NFR25) : residence_id not null partout (sauf
-- residences elle-même). Soft-delete CNDP (AR9, NFR17) sur entités modérables.
-- Naming AR15 : snake_case pluriel + columns _at suffix + FK _id.

-- Extension pour gen_random_uuid() (présente par défaut sur Supabase, idempotent).
create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. residences — racine multi-tenant (1 ligne au MVP, N ligne en V3).
-- ─────────────────────────────────────────────────────────────────────────────
create table public.residences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  villa_count integer not null check (villa_count between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- FK ajoutée via ALTER TABLE après CREATE TABLE users (forward-ref).
  deleted_by uuid,
  deletion_reason text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. users — image projet de auth.users (1↔1, cascade).
--    Ne stocke PAS email/phone (vivent dans auth.users), juste les champs
--    métier (rôle, display_name, lifecycle Pack accueil).
-- ─────────────────────────────────────────────────────────────────────────────
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  residence_id uuid not null references public.residences(id) on delete restrict,
  role public.user_role not null default 'resident',
  display_name text,
  -- Story 3.4 forward-compat (Pack accueil bannière).
  first_login_at timestamptz,
  pack_accueil_dismissed_at timestamptz,
  -- Soft-delete (AR9, NFR17).
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  deletion_reason text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. profiles — données de profil résident (villa, langue, mode identité).
--    PK = user_id (1↔1 avec users).
-- ─────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  residence_id uuid not null references public.residences(id) on delete restrict,
  villa integer not null check (villa between 1 and 150),
  tranche text,
  language text not null default 'fr' check (language in ('fr', 'ar')),
  -- FR16 pseudonyme par défaut, opt-in identité mémorisé.
  identity_mode text not null default 'pseudo' check (identity_mode in ('pseudo', 'identified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  deletion_reason text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. admission_requests — file de demandes d'admission (visiteur → demandeur).
--    state pending au create, transitions accepted/rejected par co-mod.
--    decision_reason CHECK : not null SI rejected, null sinon.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.admission_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  residence_id uuid not null references public.residences(id) on delete restrict,
  villa integer not null check (villa between 1 and 150),
  tranche text,
  first_name text not null,
  contact_channel public.admission_contact_channel not null,
  state public.admission_state not null default 'pending',
  decision_reason public.admission_decision_reason,
  decided_by uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  deletion_reason text,
  -- Cohérence state ↔ decision_reason + audit trail (decided_by/at obligatoires
  -- dès qu'on sort de pending — sinon journal d'admission inutilisable).
  constraint admission_requests_state_decision_check
    check (
      (state = 'rejected' and decision_reason is not null and decided_by is not null and decided_at is not null)
      or (state = 'accepted' and decision_reason is null and decided_by is not null and decided_at is not null)
      or (state = 'pending' and decision_reason is null and decided_by is null and decided_at is null)
    )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. moderation_log — journal public d'actions de modération (FR33, FR34).
--    Lecture publique (transparence radicale), writes système uniquement
--    (Story 1.8+ via fonctions SECURITY DEFINER).
--    Pas de updated_at — log immutable.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete restrict,
  -- actor_id nullable car set null quand l'acteur se supprime (anonymisation).
  actor_id uuid references public.users(id) on delete set null,
  action public.moderation_action not null,
  target_kind text not null,
  target_id uuid,
  reason_code text,
  reason_text_anonymized text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  deletion_reason text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. notifications_prefs — prefs notif 3 catégories (FR40).
--    PK = user_id, cascade hard via delete users.
--    Defaults reflètent politique anti-spam FR43 :
--      - alerts_urgentes opt-out (essentiel)
--      - nouvelles_entrees_annuaire opt-in (marketing-like)
--      - activite_contributions opt-out (perso direct)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.notifications_prefs (
  user_id uuid primary key references public.users(id) on delete cascade,
  residence_id uuid not null references public.residences(id) on delete restrict,
  alerts_urgentes_enabled boolean not null default true,
  nouvelles_entrees_annuaire_enabled boolean not null default false,
  activite_contributions_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Forward-ref FK : residences.deleted_by → users(id) (créée après users).
alter table public.residences
  add constraint residences_deleted_by_fkey
  foreign key (deleted_by) references public.users(id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- AUTH BRIDGE (AC12) — auto-provisioning public.users + notifications_prefs
-- au INSERT dans auth.users. Pattern Supabase standard.
-- SECURITY DEFINER pour pouvoir écrire dans public.* depuis le contexte auth.
-- search_path explicite pour éviter injection via search_path manipulation.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  -- UUID stable de la résidence Darna (cf. migration seed_residence).
  -- MVP mono-résidence : tous les nouveaux comptes attachés à Darna.
  -- V3 multi-tenant : lire new.raw_app_meta_data->>'residence_id' à la place.
  v_residence_id constant uuid := '00000000-0000-0000-0000-000000000001';
begin
  -- ON CONFLICT pour idempotence en cas de restauration auth.users depuis backup
  -- (review 1.3 — Edge Case Hunter #4).
  insert into public.users (id, residence_id, role)
  values (new.id, v_residence_id, 'demandeur')
  on conflict (id) do nothing;

  insert into public.notifications_prefs (user_id, residence_id)
  values (new.id, v_residence_id)
  on conflict (user_id) do nothing;

  return new;
exception
  -- Sans ce handler, toute exception (FK manquante, CHECK, etc.) ROLLBACK la
  -- création auth.users → signup échoue silencieusement (500 brute). On laisse
  -- l'utilisateur être créé côté auth, on log côté Postgres pour Sentry, et la
  -- réconciliation post-incident est faisable via auth.users → public.users.
  when others then
    raise warning '[handle_new_auth_user] auth user % provisioning failed: % (%)',
      new.id, sqlerrm, sqlstate;
    return new;
end;
$$;

-- Empêche toute invocation directe depuis client/anon — seul le trigger système
-- doit pouvoir l'appeler (review 1.3 — Edge Case Hunter #3, défense en profondeur).
revoke execute on function public.handle_new_auth_user() from public;

create trigger trg_auth_users_after_insert
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
