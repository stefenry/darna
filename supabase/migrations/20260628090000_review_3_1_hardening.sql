-- Story 3.1 code review (2026-06-20) — hardening DB.
--
-- D1   : uniformiser policies résident sur `auth_residence_id()` (vs sous-requête
--        `users` fragile + perf surprise par-ligne).
-- P1   : `deleted_by = auth.uid()` enforcement via trigger BEFORE UPDATE
--        (audit modération non-falsifiable).
-- P2   : CHECK regex E.164 sur `useful_numbers.phone_e164` (anti tel: cassé).
-- P3   : CHECK non-vide sur title_fr / body_fr_markdown × 3 tables.
-- P4   : CHECK format slug + section_key (anti path traversal).
-- P5   : CHECK length max title (200) / body (50000) — anti DoS GIN + perf 3G.
-- P8   : UNIQUE partial sur (residence_id, theme/category/section_key, order_in_*)
--        where deleted_at is null — anti race ordre + ORDER BY déterministe.
-- P9   : UNIQUE partial sur (residence_id, phone_e164) where deleted_at is null
--        — anti doublons useful_numbers.
-- P10  : `created_by default auth.uid()` + retirer du grant insert (trigger
--        pose automatiquement, friction DX en moins).

-- ─────────────────────────────────────────────────────────────────────────────
-- P3 / P5 : CHECK contenu (3 tables × titres + body)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.guide_entries
  add constraint guide_entries_title_fr_nonempty check (length(trim(title_fr)) > 0),
  add constraint guide_entries_title_fr_maxlen check (length(title_fr) <= 200),
  add constraint guide_entries_title_ar_maxlen check (title_ar is null or length(title_ar) <= 200),
  add constraint guide_entries_body_fr_nonempty check (length(trim(body_fr_markdown)) > 0),
  add constraint guide_entries_body_fr_maxlen check (length(body_fr_markdown) <= 50000),
  add constraint guide_entries_body_ar_maxlen check (body_ar_markdown is null or length(body_ar_markdown) <= 50000);

alter table public.useful_numbers
  add constraint useful_numbers_label_fr_nonempty check (length(trim(label_fr)) > 0),
  add constraint useful_numbers_label_fr_maxlen check (length(label_fr) <= 200),
  add constraint useful_numbers_label_ar_maxlen check (label_ar is null or length(label_ar) <= 200),
  add constraint useful_numbers_notes_fr_maxlen check (notes_fr is null or length(notes_fr) <= 2000),
  add constraint useful_numbers_notes_ar_maxlen check (notes_ar is null or length(notes_ar) <= 2000);

alter table public.pack_entries
  add constraint pack_entries_title_fr_nonempty check (length(trim(title_fr)) > 0),
  add constraint pack_entries_title_fr_maxlen check (length(title_fr) <= 200),
  add constraint pack_entries_title_ar_maxlen check (title_ar is null or length(title_ar) <= 200),
  add constraint pack_entries_body_fr_nonempty check (length(trim(body_fr_markdown)) > 0),
  add constraint pack_entries_body_fr_maxlen check (length(body_fr_markdown) <= 50000),
  add constraint pack_entries_body_ar_maxlen check (body_ar_markdown is null or length(body_ar_markdown) <= 50000);

-- ─────────────────────────────────────────────────────────────────────────────
-- P2 : CHECK regex E.164 sur useful_numbers.phone_e164 (tel: 3.3 dépend).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.useful_numbers
  add constraint useful_numbers_phone_e164_format
    check (phone_e164 ~ '^\+[1-9]\d{7,14}$');

-- ─────────────────────────────────────────────────────────────────────────────
-- P4 : CHECK format slug + section_key (anti path traversal `/guide/{slug}`).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.guide_entries
  add constraint guide_entries_slug_format
    check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$');

alter table public.pack_entries
  add constraint pack_entries_section_key_format
    check (section_key ~ '^[a-z0-9_-]{1,64}$');

-- ─────────────────────────────────────────────────────────────────────────────
-- P8 : UNIQUE partial sur ordering — déterministe + anti race.
-- ─────────────────────────────────────────────────────────────────────────────
create unique index guide_entries_theme_order_active_unique
  on public.guide_entries (residence_id, theme_key, order_in_theme)
  where deleted_at is null;

create unique index useful_numbers_category_order_active_unique
  on public.useful_numbers (residence_id, category_key, order_in_category)
  where deleted_at is null;

create unique index pack_entries_section_order_active_unique
  on public.pack_entries (residence_id, section_key, order_in_section)
  where deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- P9 : UNIQUE partial sur (residence_id, phone_e164) useful_numbers — anti doublon.
-- ─────────────────────────────────────────────────────────────────────────────
create unique index useful_numbers_phone_residence_active_unique
  on public.useful_numbers (residence_id, phone_e164)
  where deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- P10 : `created_by default auth.uid()` + retirer du grant insert.
-- Le client n'a plus à le poser ; la policy `with check (created_by = auth.uid())`
-- reste comme défense en profondeur.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.guide_entries
  alter column created_by set default auth.uid();
alter table public.useful_numbers
  alter column created_by set default auth.uid();
alter table public.pack_entries
  alter column created_by set default auth.uid();

-- Retirer `created_by` des grants insert (déjà NOT NULL avec default → client ne pose plus).
revoke insert (slug, residence_id, theme_key, title_fr, title_ar, body_fr_markdown,
               body_ar_markdown, order_in_theme, created_by)
  on public.guide_entries from authenticated;
grant insert (slug, residence_id, theme_key, title_fr, title_ar, body_fr_markdown,
              body_ar_markdown, order_in_theme)
  on public.guide_entries to authenticated;

revoke insert (residence_id, category_key, label_fr, label_ar, phone_e164,
               notes_fr, notes_ar, order_in_category, created_by)
  on public.useful_numbers from authenticated;
grant insert (residence_id, category_key, label_fr, label_ar, phone_e164,
              notes_fr, notes_ar, order_in_category)
  on public.useful_numbers to authenticated;

revoke insert (residence_id, section_key, title_fr, title_ar, body_fr_markdown,
               body_ar_markdown, order_in_section, created_by)
  on public.pack_entries from authenticated;
grant insert (residence_id, section_key, title_fr, title_ar, body_fr_markdown,
              body_ar_markdown, order_in_section)
  on public.pack_entries to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- P1 : trigger BEFORE UPDATE qui force `deleted_by = auth.uid()` quand
-- `deleted_at` transitionne NULL → NOT NULL (et préserve l'audit si déjà set).
-- Empêche un co_mod d'attribuer la suppression à un autre user.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_deleted_by_actor()
returns trigger
language plpgsql
as $$
begin
  if new.deleted_at is not null and (old.deleted_at is null) then
    -- Soft-delete : force deleted_by = caller.
    new.deleted_by := auth.uid();
  elsif new.deleted_at is null and old.deleted_at is not null then
    -- Restauration : reset deleted_by (préserve l'audit log via moderation_log story 3.5).
    new.deleted_by := null;
    new.deletion_reason := null;
  end if;
  return new;
end;
$$;

create trigger trg_guide_entries_enforce_deleted_by
  before update on public.guide_entries
  for each row execute function public.enforce_deleted_by_actor();

create trigger trg_useful_numbers_enforce_deleted_by
  before update on public.useful_numbers
  for each row execute function public.enforce_deleted_by_actor();

create trigger trg_pack_entries_enforce_deleted_by
  before update on public.pack_entries
  for each row execute function public.enforce_deleted_by_actor();

-- ─────────────────────────────────────────────────────────────────────────────
-- D1 : uniformiser policies résident sur `auth_residence_id()` + `auth_role()`
-- (cohérent avec co_mod, perf, découplé de la RLS `users`).
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists guide_entries_resident_select_residence on public.guide_entries;
create policy guide_entries_resident_select_residence on public.guide_entries
  for select
  using (
    deleted_at is null
    and public.auth_role() in ('resident', 'co_mod')
    and residence_id = public.auth_residence_id()
  );

drop policy if exists useful_numbers_resident_select_residence on public.useful_numbers;
create policy useful_numbers_resident_select_residence on public.useful_numbers
  for select
  using (
    deleted_at is null
    and public.auth_role() in ('resident', 'co_mod')
    and residence_id = public.auth_residence_id()
  );

drop policy if exists pack_entries_resident_select_residence on public.pack_entries;
create policy pack_entries_resident_select_residence on public.pack_entries
  for select
  using (
    deleted_at is null
    and public.auth_role() in ('resident', 'co_mod')
    and residence_id = public.auth_residence_id()
  );
