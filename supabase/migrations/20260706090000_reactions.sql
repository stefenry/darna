-- Story 6.4 (FR43b) — réactions 👍 sur commentaire (rating), alerte, bon plan.
-- PAS de 👎 par construction : aucune colonne `kind`, une seule réaction possible.
--
-- Modèle : 1 ligne par (user, cible). RLS asymétrique :
--   - le résident INSERT/DELETE/SELECT SES propres réactions (toggle + état) ;
--   - PERSONNE ne lit les lignes d'autrui (pas de liste publique de likers — vie
--     privée FR43b) ;
--   - le COMPTE agrégé est exposé par la vue `reaction_counts` (SECURITY DEFINER),
--     lisible de tous les authentifiés, sans révéler QUI a réagi.

create type public.reaction_target_type as enum ('rating', 'alert', 'tip');

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete restrict
    default public.auth_residence_id(),
  user_id uuid not null references public.users(id) on delete cascade default auth.uid(),
  target_type public.reaction_target_type not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  constraint reactions_user_target_unique unique (user_id, target_type, target_id)
);

-- Comptage agrégé (vue 4.4 feed-like) — index sur (type, cible).
create index idx_reactions_target on public.reactions (target_type, target_id);

-- ── RLS ────────────────────────────────────────────────────────────────────────
alter table public.reactions enable row level security;

-- Le résident ne voit QUE ses propres réactions (pour connaître l'état du toggle).
create policy reactions_resident_select_own on public.reactions
  for select
  using (user_id = auth.uid());

-- INSERT : sa propre réaction, dans sa résidence (defaults figés, non grantés).
create policy reactions_resident_insert_own on public.reactions
  for insert
  with check (
    user_id = auth.uid()
    and residence_id = public.auth_residence_id()
    and public.auth_role() in ('resident', 'co_mod')
  );

-- DELETE : retrait de sa propre réaction (toggle off).
create policy reactions_resident_delete_own on public.reactions
  for delete
  using (user_id = auth.uid());

-- ── Grants column-level (ADR 0004) : user_id/residence_id non grantés (defaults). ─
revoke insert, update, delete on public.reactions from authenticated;
grant insert (target_type, target_id) on public.reactions to authenticated;
grant delete on public.reactions to authenticated;

-- ── Vue de comptage agrégé (transparence du COMPTE, opacité des likers). ─────────
-- SECURITY DEFINER (security_invoker=false) : agrège par-dessus la RLS sans
-- exposer les user_id. Aucune PII (juste type, cible, total).
create view public.reaction_counts
with (security_invoker = false)
as
select target_type, target_id, count(*)::int as count
from public.reactions
group by target_type, target_id;

grant select on public.reaction_counts to authenticated;
