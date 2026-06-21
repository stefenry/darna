-- Story 6.5 (FR43c) — suggestions d'évolution produit (texte libre), lues par les
-- co_mods UNIQUEMENT. Jamais public, aucun vote/like (anti-toxicité par
-- construction). RLS asymétrique :
--   - résident : INSERT + SELECT de SES suggestions (historique perso) ;
--   - co_mod   : SELECT toutes celles de sa résidence + UPDATE de l'état
--                ('new' → 'reviewed' = « marquée comme lue »).
-- Aucune policy DELETE (soft-delete réservé système/modération éventuelle).

create type public.suggestion_state as enum ('new', 'reviewed');

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete restrict
    default public.auth_residence_id(),
  user_id uuid references public.users(id) on delete set null default auth.uid(),
  body text not null,
  state public.suggestion_state not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  deletion_reason text,
  constraint suggestions_body_nonempty check (length(btrim(body)) > 0),
  constraint suggestions_body_maxlen check (length(body) <= 1000)
);

-- File co_mod (récentes d'abord) + historique perso résident.
create index idx_suggestions_residence_state on public.suggestions (residence_id, state, created_at desc);
create index idx_suggestions_user on public.suggestions (user_id, created_at desc);

create trigger trg_suggestions_updated_at
  before update on public.suggestions
  for each row execute function public.set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────────
alter table public.suggestions enable row level security;

-- Résident : voit SES propres suggestions (historique privé, jamais celles d'autrui).
create policy suggestions_resident_select_own on public.suggestions
  for select
  using (user_id = auth.uid());

-- Résident : soumet sa suggestion (residence/user figés par défaut).
create policy suggestions_resident_insert_own on public.suggestions
  for insert
  with check (
    user_id = auth.uid()
    and residence_id = public.auth_residence_id()
    and public.auth_role() in ('resident', 'co_mod')
  );

-- co_mod : voit toutes les suggestions de sa résidence.
create policy suggestions_co_mod_select_residence on public.suggestions
  for select
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  );

-- co_mod : marque comme lue (UPDATE state) dans sa résidence.
create policy suggestions_co_mod_update_state on public.suggestions
  for update
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  )
  with check (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  );

-- ── Grants column-level (ADR 0004). ────────────────────────────────────────────
-- INSERT : seul `body` granté (user_id/residence_id/state par défaut).
-- UPDATE : seul `state` (+ updated_at) granté ; RLS borne au co_mod.
revoke insert, update, delete on public.suggestions from authenticated;
grant insert (body) on public.suggestions to authenticated;
grant update (state, updated_at) on public.suggestions to authenticated;
