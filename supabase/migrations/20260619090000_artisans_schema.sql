-- Story 2.1 — Schéma domaine artisan : annuaire noté (killer feature Epic 2).
--
-- Tables : artisans, ratings, tags, artisan_tags, artisan_consent_tokens.
-- Couvre AR5 (FTS), AR6 (RLS), AR7 (multi-tenant residence_id), AR8 (types),
-- AR9 (soft-delete), AR15 (naming). Fichier additif unique mêlant DDL + RLS +
-- grants + FTS, dans le pattern des migrations 1.7-1.9.
--
-- Décisions techniques (cf. story 2.1 Dev Notes) :
--   - FTS : config `french` (FR) + `simple` (AR — Postgres n'a pas de config
--     `arabic`, ADR 0001) + pg_trgm sur phone_e164 (dédup) et display_name_ar.
--   - comment_text vit sur `ratings` → tsvector commentaires sur ratings, pas
--     sur artisans (2 tsvector distincts, recombinés par jointure en story 2.2).
--   - Défense en profondeur ADR 0004 : policies par rôle + column GRANT/REVOKE.
--   - Soft-delete ADR 0006 : quatuor deleted_*, pas de policy DELETE.
--   - artisan_consent_tokens : RLS deny-all (accès service-role / RPC en 2.4/2.5).
--   - `tags` : référentiel global (pas de residence_id), seedé idempotent ici.

-- ─────────────────────────────────────────────────────────────────────────────
-- Extension pg_trgm — fuzzy/dédup téléphone + recherche AR (sur modèle pgcrypto).
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists pg_trgm;

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 1 — ENUMs du domaine artisan (AR15, valeurs littérales).
-- NE PAS recréer moderation_action ('rating_removed'/'comment_removed' présents).
-- ─────────────────────────────────────────────────────────────────────────────
create type public.artisan_price_relative as enum ('$', '$$', '$$$', '$$$$');
create type public.artisan_has_invoice as enum ('oui', 'non', 'sur_demande');
create type public.artisan_state as enum ('pending_consent', 'published', 'refused');
create type public.rating_visibility as enum ('pseudonym', 'named');

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 2 — tags : référentiel global de compétences (pas de residence_id).
--   label_ar nullable (MVP FR-only, slot AR prêt V1.5).
-- ─────────────────────────────────────────────────────────────────────────────
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label_fr text not null,
  label_ar text,
  created_at timestamptz not null default now()
);

-- Seed idempotent du jeu de compétences de départ (dans la migration, pas de
-- seed.sql séparé — s'applique aussi en prod via db push, AR34 : pas de user).
insert into public.tags (key, label_fr, label_ar) values
  ('plomberie',     'Plomberie',      null),
  ('electricite',   'Électricité',    null),
  ('peinture',      'Peinture',       null),
  ('menuiserie',    'Menuiserie',     null),
  ('maconnerie',    'Maçonnerie',     null),
  ('jardinage',     'Jardinage',      null),
  ('climatisation', 'Climatisation',  null),
  ('serrurerie',    'Serrurerie',     null)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 3 — artisans : entité métier multi-tenant + soft-delete.
--   slug unique y compris sur lignes soft-deleted (tombstoning CC #19).
--   created_by → set null (anonymisation contributeur, ADR 0006).
--   FTS : colonnes générées STORED (french FR / simple AR) — index en Task 7.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.artisans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  residence_id uuid not null references public.residences(id) on delete restrict,
  display_name_fr text not null,
  display_name_ar text,
  phone_e164 text not null,
  price_relative public.artisan_price_relative,
  has_invoice public.artisan_has_invoice,
  state public.artisan_state not null default 'pending_consent',
  published_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  -- FTS générés (STORED requis pour index GIN). AR=`simple` (ADR 0001).
  display_name_fr_tsv tsvector generated always as
    (to_tsvector('french', coalesce(display_name_fr, ''))) stored,
  display_name_ar_tsv tsvector generated always as
    (to_tsvector('simple', coalesce(display_name_ar, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  deletion_reason text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 4 — ratings : notation typée 4 axes (≥ 1 axe noté), 1 note/(artisan,user).
--   user_id nullable (anonymisation purge → set null, ADR 0006).
-- ─────────────────────────────────────────────────────────────────────────────
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  residence_id uuid not null references public.residences(id) on delete restrict,
  score_depannage smallint check (score_depannage between 1 and 5),
  score_petits_travaux smallint check (score_petits_travaux between 1 and 5),
  score_travail_soigne smallint check (score_travail_soigne between 1 and 5),
  score_urgences smallint check (score_urgences between 1 and 5),
  comment_text text,
  visibility public.rating_visibility not null default 'pseudonym',
  -- FTS commentaires (french). Recombiné aux noms artisans par jointure en 2.2.
  comment_tsv tsvector generated always as
    (to_tsvector('french', coalesce(comment_text, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  deletion_reason text,
  -- Au moins un axe noté (sinon une "note" vide ne veut rien dire).
  constraint ratings_at_least_one_score_check
    check (num_nonnulls(score_depannage, score_petits_travaux,
                        score_travail_soigne, score_urgences) >= 1),
  -- Une note par (artisan, contributeur) — l'UX = "mise à jour", pas doublon.
  -- NULLs distincts en Postgres → OK pour lignes anonymisées (user_id null).
  constraint ratings_artisan_user_unique unique (artisan_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 5 — artisan_tags (N-N) + artisan_consent_tokens (lifecycle consentement).
-- ─────────────────────────────────────────────────────────────────────────────
create table public.artisan_tags (
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  primary key (artisan_id, tag_id)
);

create table public.artisan_consent_tokens (
  id uuid primary key default gen_random_uuid(),
  artisan_id uuid not null references public.artisans(id) on delete cascade,
  residence_id uuid not null references public.residences(id) on delete restrict,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 6 — Triggers updated_at (réutilise public.set_updated_at() existant).
--   Pas de trigger sur tags/artisan_tags/artisan_consent_tokens (pas d'updated_at).
-- ─────────────────────────────────────────────────────────────────────────────
create trigger trg_artisans_updated_at
  before update on public.artisans
  for each row
  execute function public.set_updated_at();

create trigger trg_ratings_updated_at
  before update on public.ratings
  for each row
  execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 7 — Index (AR15 idx_<table>_<colonnes>).
-- ─────────────────────────────────────────────────────────────────────────────
-- FTS GIN : noms artisans (FR + AR) et commentaires ratings.
create index idx_artisans_display_name_fr_tsv
  on public.artisans using gin (display_name_fr_tsv);
create index idx_artisans_display_name_ar_tsv
  on public.artisans using gin (display_name_ar_tsv);
create index idx_ratings_comment_tsv
  on public.ratings using gin (comment_tsv);

-- Dédup téléphone (fuzzy trigram).
create index idx_artisans_phone_e164_trgm
  on public.artisans using gin (phone_e164 gin_trgm_ops);

-- Scope / tri.
create index idx_artisans_residence_id_state
  on public.artisans (residence_id, state);
create index idx_artisans_created_at
  on public.artisans (created_at desc);
create index idx_ratings_artisan_id_created_at
  on public.ratings (artisan_id, created_at);
create index idx_artisan_tags_tag_id
  on public.artisan_tags (tag_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 8 — RLS (AR6, défense en profondeur ADR 0004).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.artisans enable row level security;
alter table public.ratings enable row level security;
alter table public.tags enable row level security;
alter table public.artisan_tags enable row level security;
alter table public.artisan_consent_tokens enable row level security;

-- ── artisans ─────────────────────────────────────────────────────────────────
-- Lecture annuaire : artisans publiés de SA résidence. Sous-requête sur users
-- (app_metadata.residence_id pas encore peuplé pour tous — même pattern que
-- profiles_resident_select_residence).
create policy artisans_resident_select_published on public.artisans
  for select
  using (
    deleted_at is null
    and state = 'published'
    and residence_id = (
      select residence_id from public.users
      where id = auth.uid()
        and role in ('resident', 'co_mod')
        and deleted_at is null
    )
  );

-- AC3 : un résident ne voit QUE ses propres soumissions en pending_consent
-- (celles des autres restent masquées jusqu'au consentement de l'artisan).
create policy artisans_resident_select_own_pending on public.artisans
  for select
  using (deleted_at is null and created_by = auth.uid());

-- co_mod : voit tous les artisans (tous états) de sa résidence (modération 2.x).
create policy artisans_co_mod_select_residence on public.artisans
  for select
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
    and deleted_at is null
  );

create policy artisans_resident_insert on public.artisans
  for insert
  with check (
    created_by = auth.uid()
    and residence_id = (
      select residence_id from public.users
      where id = auth.uid()
        and role in ('resident', 'co_mod')
        and deleted_at is null
    )
  );

-- UPDATE limité au contributeur sur ses propres lignes. Pas de policy DELETE
-- (soft-delete via UPDATE de deleted_at). Le périmètre de colonnes est borné
-- par le GRANT column-level ci-dessous.
create policy artisans_resident_update_own on public.artisans
  for update
  using (created_by = auth.uid() and deleted_at is null)
  with check (created_by = auth.uid());

-- Column-level GRANT/REVOKE (ADR 0004 #2) : REVOKE total puis GRANT colonnes.
-- INSERT : un contributeur ne renseigne QUE les colonnes du formulaire fiche.
-- state reste à son défaut 'pending_consent' (le passage à 'published' relève
-- du flow de consentement service-role en 2.5).
revoke insert on public.artisans from authenticated;
grant insert (slug, residence_id, display_name_fr, display_name_ar, phone_e164,
              price_relative, has_invoice, created_by)
  on public.artisans to authenticated;
-- UPDATE : édition des champs de fiche uniquement. Jamais state/published_at
-- (modération/consentement) ni soft-delete (service-role).
revoke update on public.artisans from authenticated;
grant update (display_name_fr, display_name_ar, phone_e164, price_relative,
              has_invoice, updated_at)
  on public.artisans to authenticated;

-- ── ratings ──────────────────────────────────────────────────────────────────
-- Lecture : notes (non supprimées) des artisans publiés de sa résidence.
create policy ratings_resident_select_residence on public.ratings
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

-- INSERT : self (user_id), résidence du noteur, ET cohérence avec l'artisan —
-- la FK artisan_id ne contrôle que l'existence, pas l'état/le tenant. Sans
-- l'exists ci-dessous un résident pourrait noter un artisan pending_consent,
-- soft-deleted ou d'une AUTRE résidence (code review 2026-06-17, P1).
create policy ratings_resident_insert on public.ratings
  for insert
  with check (
    user_id = auth.uid()
    and residence_id = (
      select residence_id from public.users
      where id = auth.uid()
        and role in ('resident', 'co_mod')
        and deleted_at is null
    )
    and exists (
      select 1 from public.artisans a
      where a.id = artisan_id
        and a.state = 'published'
        and a.deleted_at is null
        and a.residence_id = ratings.residence_id
    )
  );

create policy ratings_resident_update_own on public.ratings
  for update
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

-- Column-level : INSERT/UPDATE des seules colonnes autorisées — jamais de
-- colonnes de modération (deleted_*).
revoke insert on public.ratings from authenticated;
grant insert (artisan_id, user_id, residence_id, score_depannage,
              score_petits_travaux, score_travail_soigne, score_urgences,
              comment_text, visibility)
  on public.ratings to authenticated;
revoke update on public.ratings from authenticated;
grant update (score_depannage, score_petits_travaux, score_travail_soigne,
              score_urgences, comment_text, visibility, updated_at)
  on public.ratings to authenticated;

-- ── tags ─────────────────────────────────────────────────────────────────────
-- Référentiel lisible par tous, pas d'écriture client.
create policy tags_public_select on public.tags
  for select
  using (true);

-- ── artisan_tags ─────────────────────────────────────────────────────────────
-- SELECT scopé par la VISIBILITÉ de l'artisan parent (pas juste son existence) :
-- publié de sa résidence OU sa propre soumission pending. Sinon les tags d'un
-- artisan pending_consent / d'une autre résidence fuiraient, contournant le
-- masquage AC3 garanti côté artisans (code review 2026-06-17, P2).
-- INSERT par le contributeur de l'artisan uniquement.
create policy artisan_tags_resident_select on public.artisan_tags
  for select
  using (
    exists (
      select 1 from public.artisans a
      where a.id = artisan_id
        and a.deleted_at is null
        and (
          (
            a.state = 'published'
            and a.residence_id = (
              select residence_id from public.users
              where id = auth.uid()
                and role in ('resident', 'co_mod')
                and deleted_at is null
            )
          )
          or a.created_by = auth.uid()
        )
    )
  );

create policy artisan_tags_resident_insert on public.artisan_tags
  for insert
  with check (
    exists (
      select 1 from public.artisans a
      where a.id = artisan_id and a.created_by = auth.uid()
    )
  );

-- ── artisan_consent_tokens ───────────────────────────────────────────────────
-- RLS activée, AUCUNE policy : deny-all côté `authenticated`. Lecture/écriture
-- réservées service-role / RPC SECURITY DEFINER (stories 2.4 / 2.5).
-- (alter ... enable row level security ci-dessus suffit.)
