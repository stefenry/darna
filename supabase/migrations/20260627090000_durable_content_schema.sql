-- Story 3.1 — Schéma contenu durable : Guide + Numéros utiles + Pack accueil.
--
-- Tables : guide_entries, useful_numbers, pack_entries (fondation Epic 3).
-- Couvre FR23-FR26, NFR47, AR5 (FTS), AR6 (RLS), AR7 (multi-tenant residence_id),
-- AR8 (types), AR9 (soft-delete), AR15 (naming). Fichier additif unique mêlant
-- DDL + RLS + grants + FTS, sur le modèle exact de 20260619090000_artisans_schema.
--
-- Décisions techniques (cf. story 3.1 Dev Notes) :
--   - RLS asymétrique : résident LECTURE SEULE (aucun grant écrit issu du rôle
--     résident) ; co_mod CRUD complet de SA résidence (policies + grants colonne
--     posés ICI, même si les Server Actions co_mod arrivent en 3.5).
--   - theme_key / category_key = enums littéraux (i18n résolu au render, NFR47,
--     pas de colonne display_name). section_key (pack) = text libre (curé co_mod).
--   - FTS : config `french` (FR) + `simple` (AR — Postgres n'a pas de config
--     `arabic`, ADR 0001) générées STORED, sur guide_entries + pack_entries.
--     Pas de FTS sur useful_numbers (accès par catégorie, pas de recherche).
--   - Soft-delete ADR 0006 : quatuor deleted_*, pas de policy DELETE.
--   - Slug unique scopé résidence (multi-tenant AR7), pas global.
--   - moderation_log NON touché : le retrait co_mod (3.5) loggue via RPC SECURITY
--     DEFINER, réutilisant l'action enum existante `content_removed`.
--
-- NOTE timestamp : la story prévoyait 20260623090000 mais ce slot (et les suivants
-- jusqu'à 20260626090000) a été pris par le travail Epic 2 entre la rédaction et
-- le dev. Décalé à 20260627090000 pour préserver la monotonie stricte des migrations.

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 1 — ENUMs du domaine durable (AR15, valeurs littérales, i18n au render).
-- NE PAS recréer moderation_action (réutilisé tel quel en 3.5 via content_removed).
-- Pas d'enum pour section_key (pack) → text (D3).
-- ─────────────────────────────────────────────────────────────────────────────
create type public.guide_theme_key as enum (
  'codes_portails',
  'horaires_gardien',
  'regles_jardin',
  'dechets',
  'traditions',
  'securite',
  'autre'
);

create type public.useful_number_category as enum (
  'securite',
  'syndic',
  'urgences',
  'sante',
  'autre'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 2 — guide_entries : FAQ structurée bilingue, multi-tenant + soft-delete.
--   slug = cible deep-link 3.2, unique PAR RÉSIDENCE (D2, pas global).
--   created_by → set null (anonymisation contributeur, ADR 0006).
--   FTS : colonnes générées STORED (french FR / simple AR) — index en Task 6.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.guide_entries (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  residence_id uuid not null references public.residences(id) on delete restrict,
  theme_key public.guide_theme_key not null,
  title_fr text not null,
  title_ar text,
  body_fr_markdown text not null,
  body_ar_markdown text,
  order_in_theme integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  -- FTS générés (STORED requis pour index GIN). AR=`simple` (ADR 0001).
  search_fr_tsv tsvector generated always as
    (to_tsvector('french',
      coalesce(title_fr, '') || ' ' || coalesce(body_fr_markdown, ''))) stored,
  search_ar_tsv tsvector generated always as
    (to_tsvector('simple',
      coalesce(title_ar, '') || ' ' || coalesce(body_ar_markdown, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  deletion_reason text,
  -- Slug unique scopé résidence (multi-tenant AR7) — deux résidences peuvent avoir
  -- une entrée `codes-portails`. Unique y compris sur lignes soft-deleted
  -- (tombstoning, cohérent artisans CC #19 ; réémission fine = Epic 6).
  constraint guide_entries_residence_slug_unique unique (residence_id, slug)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 3 — useful_numbers : accès rapide par catégorie + action tel: (3.3).
--   Pas de FTS (accès catégorie, pas de recherche). Pas de slug (pas
--   deep-linkable individuellement — la page entière est la cible, FR36).
-- ─────────────────────────────────────────────────────────────────────────────
create table public.useful_numbers (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete restrict,
  category_key public.useful_number_category not null,
  label_fr text not null,
  label_ar text,
  phone_e164 text not null,
  notes_fr text,
  notes_ar text,
  order_in_category integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  deletion_reason text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 4 — pack_entries : pack accueil éditorial (3.4), sections text libre (D3).
--   FTS générés identiques à guide_entries (homogénéité 3.2, évite un futur ALTER
--   même si la recherche pack n'est pas un AC).
-- ─────────────────────────────────────────────────────────────────────────────
create table public.pack_entries (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete restrict,
  section_key text not null,
  title_fr text not null,
  title_ar text,
  body_fr_markdown text not null,
  body_ar_markdown text,
  order_in_section integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  search_fr_tsv tsvector generated always as
    (to_tsvector('french',
      coalesce(title_fr, '') || ' ' || coalesce(body_fr_markdown, ''))) stored,
  search_ar_tsv tsvector generated always as
    (to_tsvector('simple',
      coalesce(title_ar, '') || ' ' || coalesce(body_ar_markdown, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  deletion_reason text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 5 — Triggers updated_at (réutilise public.set_updated_at() existant).
-- ─────────────────────────────────────────────────────────────────────────────
create trigger trg_guide_entries_updated_at
  before update on public.guide_entries
  for each row
  execute function public.set_updated_at();

create trigger trg_useful_numbers_updated_at
  before update on public.useful_numbers
  for each row
  execute function public.set_updated_at();

create trigger trg_pack_entries_updated_at
  before update on public.pack_entries
  for each row
  execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 6 — Index (AR15 idx_<table>_<colonnes>).
-- ─────────────────────────────────────────────────────────────────────────────
-- FTS GIN : guide + pack (FR + AR).
create index idx_guide_entries_search_fr_tsv
  on public.guide_entries using gin (search_fr_tsv);
create index idx_guide_entries_search_ar_tsv
  on public.guide_entries using gin (search_ar_tsv);
create index idx_pack_entries_search_fr_tsv
  on public.pack_entries using gin (search_fr_tsv);
create index idx_pack_entries_search_ar_tsv
  on public.pack_entries using gin (search_ar_tsv);

-- Scope / tri.
create index idx_guide_entries_residence_theme_order
  on public.guide_entries (residence_id, theme_key, order_in_theme);
create index idx_useful_numbers_residence_category_order
  on public.useful_numbers (residence_id, category_key, order_in_category);
create index idx_pack_entries_residence_section_order
  on public.pack_entries (residence_id, section_key, order_in_section);

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 7+8 — RLS (AR6, défense en profondeur ADR 0004).
--   Résident : LECTURE SEULE (SELECT scopé résidence, hors soft-deleted).
--   co_mod : CRUD de SA résidence (SELECT incl. soft-deleted pour restaurer 3.5,
--   INSERT, UPDATE incl. soft-delete). Pas de policy DELETE.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.guide_entries enable row level security;
alter table public.useful_numbers enable row level security;
alter table public.pack_entries enable row level security;

-- ── guide_entries ────────────────────────────────────────────────────────────
-- Lecture résident : entrées non supprimées de SA résidence. Sous-requête sur
-- users (app_metadata.residence_id pas garanti pour tous les résidents).
create policy guide_entries_resident_select_residence on public.guide_entries
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

-- co_mod : voit TOUTES les entrées (y compris soft-deleted) de sa résidence
-- (réafficher/restaurer en 3.5).
create policy guide_entries_co_mod_select_residence on public.guide_entries
  for select
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  );

create policy guide_entries_co_mod_insert on public.guide_entries
  for insert
  with check (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
    and created_by = auth.uid()
  );

-- UPDATE co_mod (édition + soft-delete via deleted_at). Pas de policy DELETE.
create policy guide_entries_co_mod_update on public.guide_entries
  for update
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  )
  with check (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  );

-- ── useful_numbers ───────────────────────────────────────────────────────────
create policy useful_numbers_resident_select_residence on public.useful_numbers
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

create policy useful_numbers_co_mod_select_residence on public.useful_numbers
  for select
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  );

create policy useful_numbers_co_mod_insert on public.useful_numbers
  for insert
  with check (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
    and created_by = auth.uid()
  );

create policy useful_numbers_co_mod_update on public.useful_numbers
  for update
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  )
  with check (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  );

-- ── pack_entries ─────────────────────────────────────────────────────────────
create policy pack_entries_resident_select_residence on public.pack_entries
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

create policy pack_entries_co_mod_select_residence on public.pack_entries
  for select
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  );

create policy pack_entries_co_mod_insert on public.pack_entries
  for insert
  with check (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
    and created_by = auth.uid()
  );

create policy pack_entries_co_mod_update on public.pack_entries
  for update
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  )
  with check (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants column-level (ADR 0004 #2). Supabase grant ALL aux tables nouvelles à
-- `authenticated` par défaut → REVOKE insert/update/delete total puis GRANT des
-- SEULES colonnes du périmètre co_mod. SELECT reste granté par défaut (RLS scope).
--
-- IMPORTANT : aucun grant écrit n'est issu du rôle résident. Les grants ci-dessous
-- sont posés sur `authenticated` (Supabase n'a pas de rôle SQL par co_mod) mais
-- l'enforcement du rôle co_mod est porté par le `with check (auth_role()='co_mod')`
-- des policies, pas par le grant. Un résident n'a AUCUNE policy d'écriture → tout
-- INSERT/UPDATE résident échoue 42501 (lecture seule, AC2). Aucune policy DELETE
-- + revoke delete jamais re-granté → soft-delete par UPDATE de deleted_at.
--
-- Jamais grant sur created_at, search_*_tsv (générées), ni residence_id en UPDATE
-- (tenant figé). Le grant update(deleted_at, deleted_by, deletion_reason) autorise
-- le soft-delete co_mod ; le log modération associé reste un RPC (3.5).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── guide_entries ──
revoke insert, update, delete on public.guide_entries from authenticated;
grant insert (slug, residence_id, theme_key, title_fr, title_ar,
              body_fr_markdown, body_ar_markdown, order_in_theme, created_by)
  on public.guide_entries to authenticated;
grant update (slug, theme_key, title_fr, title_ar, body_fr_markdown,
              body_ar_markdown, order_in_theme, deleted_at, deleted_by,
              deletion_reason, updated_at)
  on public.guide_entries to authenticated;

-- ── useful_numbers ──
revoke insert, update, delete on public.useful_numbers from authenticated;
grant insert (residence_id, category_key, label_fr, label_ar, phone_e164,
              notes_fr, notes_ar, order_in_category, created_by)
  on public.useful_numbers to authenticated;
grant update (category_key, label_fr, label_ar, phone_e164, notes_fr, notes_ar,
              order_in_category, deleted_at, deleted_by, deletion_reason, updated_at)
  on public.useful_numbers to authenticated;

-- ── pack_entries ──
revoke insert, update, delete on public.pack_entries from authenticated;
grant insert (residence_id, section_key, title_fr, title_ar, body_fr_markdown,
              body_ar_markdown, order_in_section, created_by)
  on public.pack_entries to authenticated;
grant update (section_key, title_fr, title_ar, body_fr_markdown, body_ar_markdown,
              order_in_section, deleted_at, deleted_by, deletion_reason, updated_at)
  on public.pack_entries to authenticated;
