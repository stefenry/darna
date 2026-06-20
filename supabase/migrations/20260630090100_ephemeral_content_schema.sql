-- Story 4.1 — Schéma contenu éphémère : Alertes + Bons plans + Modèles.
--
-- Tables : alert_templates (référentiel seedé), alerts, tips (fondation Epic 4).
-- Couvre FR27-FR30, AR5, AR6 (RLS), AR7 (multi-tenant residence_id), AR8 (types),
-- AR9 (soft-delete), AR15 (naming), AR19 (audit moderation_log). Fichier additif
-- mêlant DDL + RLS + grants + triggers + seed, sur le modèle exact de
-- 20260627090000_durable_content_schema (3.1).
--
-- Décisions techniques (cf. story 4.1 Dev Notes) :
--   - RLS asymétrique INVERSÉE vs Epic 3 : ici le RÉSIDENT est AUTEUR (INSERT/UPDATE
--     de SES propres alertes/bons plans), pas seulement lecteur. Lecture résident =
--     items NON expirés (expires_at > now()) ET non supprimés de sa résidence. Le
--     co_mod voit tout (modération Epic 5) ; l'auteur voit ses propres items même
--     expirés (gestion/retrait).
--   - Pas de FTS (feed trié par fraîcheur, pas de recherche — AC 4.4).
--   - expires_at : borné par CHECK (backstop anti-abus API directe : ≤ 8j alertes,
--     ≤ 31j bons plans) ; la valeur métier exacte (24/72/168h, ≤30j) est calculée
--     et validée côté Server Action / RPC (4.2/4.3, défense en profondeur).
--   - Audit publication : trigger AFTER INSERT `log_ephemeral_created` (SECURITY
--     DEFINER) écrit moderation_log alert_created/tip_created — garantit la trace
--     quel que soit le chemin d'écriture (AR19), comme le résident n'a aucun grant
--     sur moderation_log.
--   - Soft-delete ADR 0006 : quatuor deleted_*, pas de policy DELETE ; retrait
--     auteur via RPC (4.3) ; auto-expiration via cron (4.5).
--   - alert_templates = référentiel global (pas de residence_id, modèle tags 2.1),
--     seedé idempotent ici (pas de seed.sql, s'applique en prod via db push).

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 1 — alert_templates : modèles pré-rédigés (FR27). Référentiel global.
--   default_body_* nullable (le modèle « autre » = saisie libre, sans corps).
-- ─────────────────────────────────────────────────────────────────────────────
create table public.alert_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  icon text not null,
  label_fr text not null,
  label_ar text,
  default_body_fr text,
  default_body_ar text,
  default_duration_hours integer not null default 24,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint alert_templates_key_format check (template_key ~ '^[a-z0-9_]{1,40}$'),
  constraint alert_templates_duration_valid check (default_duration_hours in (24, 72, 168))
);

-- Seed idempotent des 7 modèles (FR27). Durées par défaut adaptées au type
-- d'alerte (coupures = 24h, opérations = 72h, perdus = 7j).
insert into public.alert_templates
  (template_key, icon, label_fr, label_ar, default_body_fr, default_body_ar, default_duration_hours, sort_order)
values
  ('coupure_eau', 'Droplet', 'Coupure d''eau', 'انقطاع الماء',
   'Une coupure d''eau est prévue ou en cours dans la résidence. Pensez à prévoir une réserve d''eau.',
   'انقطاع في الماء متوقع أو جارٍ في الإقامة. يُرجى تحضير احتياطي من الماء.', 24, 1),
  ('coupure_electricite', 'Zap', 'Coupure d''électricité', 'انقطاع الكهرباء',
   'Une coupure d''électricité est prévue ou en cours dans la résidence.',
   'انقطاع في الكهرباء متوقع أو جارٍ في الإقامة.', 24, 2),
  ('desinsectisation', 'Bug', 'Désinsectisation', 'مكافحة الحشرات',
   'Une opération de désinsectisation est prévue. Merci de suivre les consignes du syndic.',
   'عملية مكافحة الحشرات مبرمجة. يُرجى اتباع تعليمات الإدارة.', 72, 3),
  ('chien_perdu', 'Dog', 'Chien perdu', 'كلب ضائع',
   'Un chien a été perdu ou trouvé dans la résidence. Contactez-moi si vous avez des informations.',
   'تم فقدان أو العثور على كلب في الإقامة. اتصلوا بي إن كانت لديكم معلومات.', 168, 4),
  ('objet_perdu', 'Search', 'Objet perdu', 'غرض ضائع',
   'Un objet a été perdu ou trouvé dans la résidence. Contactez-moi pour le récupérer ou l''identifier.',
   'تم فقدان أو العثور على غرض في الإقامة. اتصلوا بي لاستعادته أو التعرف عليه.', 168, 5),
  ('colis_livre', 'Package', 'Colis livré', 'طرد تم تسليمه',
   'Un colis a été livré et attend son destinataire à la loge.',
   'تم تسليم طرد وهو في انتظار صاحبه عند الحارس.', 24, 6),
  ('autre', 'Megaphone', 'Autre', 'أخرى', null, null, 24, 7)
on conflict (template_key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 2 — alerts : alerte éphémère bilingue, multi-tenant + soft-delete.
--   slug = cible deep-link 4.4, unique PAR RÉSIDENCE (AR7).
--   template_id → set null (le modèle peut être archivé sans casser l'alerte).
--   created_by default auth.uid() (P10 pattern 3.1) → set null (anonymisation 0006).
-- ─────────────────────────────────────────────────────────────────────────────
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  residence_id uuid not null references public.residences(id) on delete restrict,
  template_id uuid references public.alert_templates(id) on delete set null,
  title_fr text not null,
  title_ar text,
  body_fr text not null,
  body_ar text,
  expires_at timestamptz not null,
  created_by uuid references public.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  deletion_reason text,
  constraint alerts_residence_slug_unique unique (residence_id, slug),
  constraint alerts_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint alerts_title_fr_nonempty check (length(trim(title_fr)) > 0),
  constraint alerts_title_fr_maxlen check (length(title_fr) <= 200),
  constraint alerts_title_ar_maxlen check (title_ar is null or length(title_ar) <= 200),
  constraint alerts_body_fr_nonempty check (length(trim(body_fr)) > 0),
  constraint alerts_body_fr_maxlen check (length(body_fr) <= 5000),
  constraint alerts_body_ar_maxlen check (body_ar is null or length(body_ar) <= 5000),
  -- Backstop expiration : future + ≤ 8j (alertes plafonnent à 168h ; slack horloge).
  constraint alerts_expires_future check (expires_at > created_at),
  constraint alerts_expires_cap check (expires_at <= created_at + interval '8 days')
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 3 — tips : bon plan typé expirable (FR29). category_key enum littéral.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.tips (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  residence_id uuid not null references public.residences(id) on delete restrict,
  category_key public.tip_category not null,
  title_fr text not null,
  title_ar text,
  body_fr text not null,
  body_ar text,
  expires_at timestamptz not null,
  created_by uuid references public.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id) on delete set null,
  deletion_reason text,
  constraint tips_residence_slug_unique unique (residence_id, slug),
  constraint tips_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint tips_title_fr_nonempty check (length(trim(title_fr)) > 0),
  constraint tips_title_fr_maxlen check (length(title_fr) <= 200),
  constraint tips_title_ar_maxlen check (title_ar is null or length(title_ar) <= 200),
  constraint tips_body_fr_nonempty check (length(trim(body_fr)) > 0),
  constraint tips_body_fr_maxlen check (length(body_fr) <= 5000),
  constraint tips_body_ar_maxlen check (body_ar is null or length(body_ar) <= 5000),
  -- Backstop expiration : future + ≤ 31j (bons plans plafonnent à 30j ; slack horloge).
  constraint tips_expires_future check (expires_at > created_at),
  constraint tips_expires_cap check (expires_at <= created_at + interval '31 days')
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 4 — Index (AR15 idx_<table>_<colonnes>).
--   Feed (4.4) : (residence_id, expires_at, deleted_at) + tri created_at DESC.
--   Cron (4.5) : (expires_at) where deleted_at is null (scan items à expirer).
-- ─────────────────────────────────────────────────────────────────────────────
create index idx_alerts_residence_expires on public.alerts (residence_id, expires_at, deleted_at);
create index idx_alerts_created_at on public.alerts (created_at desc);
create index idx_alerts_expires_cleanup on public.alerts (expires_at) where deleted_at is null;

create index idx_tips_residence_expires on public.tips (residence_id, expires_at, deleted_at);
create index idx_tips_created_at on public.tips (created_at desc);
create index idx_tips_expires_cleanup on public.tips (expires_at) where deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 5 — Triggers.
--   updated_at : réutilise public.set_updated_at() (1.3).
--   enforce_deleted_by : réutilise public.enforce_deleted_by_actor() (3.1 review P1).
--   log_ephemeral_created : AFTER INSERT → moderation_log (audit publication AR19).
-- ─────────────────────────────────────────────────────────────────────────────
create trigger trg_alerts_updated_at
  before update on public.alerts
  for each row execute function public.set_updated_at();
create trigger trg_tips_updated_at
  before update on public.tips
  for each row execute function public.set_updated_at();

create trigger trg_alerts_enforce_deleted_by
  before update on public.alerts
  for each row execute function public.enforce_deleted_by_actor();
create trigger trg_tips_enforce_deleted_by
  before update on public.tips
  for each row execute function public.enforce_deleted_by_actor();

-- SECURITY DEFINER : le résident n'a aucun grant sur moderation_log ; la trace
-- est écrite par la fonction (propriétaire postgres, BYPASSRLS). actor = created_by
-- (= auth.uid() au défaut). Sans PII au-delà du user_id (AR19).
create or replace function public.log_ephemeral_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'alerts' then
    insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
      values (new.residence_id, new.created_by, 'alert_created', 'alert', new.id);
  elsif tg_table_name = 'tips' then
    insert into public.moderation_log (residence_id, actor_id, action, target_kind, target_id)
      values (new.residence_id, new.created_by, 'tip_created', 'tip', new.id);
  end if;
  return new;
end;
$$;

create trigger trg_alerts_log_created
  after insert on public.alerts
  for each row execute function public.log_ephemeral_created();
create trigger trg_tips_log_created
  after insert on public.tips
  for each row execute function public.log_ephemeral_created();

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 6 — RLS (AR6, défense en profondeur ADR 0004).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.alert_templates enable row level security;
alter table public.alerts enable row level security;
alter table public.tips enable row level security;

-- ── alert_templates : lecture seule pour tout membre authentifié de la résidence
-- (référentiel global, pas de mutation client — curé par migration). ────────────
create policy alert_templates_member_select on public.alert_templates
  for select
  using (public.auth_role() in ('resident', 'co_mod'));

-- ── alerts ───────────────────────────────────────────────────────────────────
-- Lecture résident : actives (non expirées) et non supprimées de SA résidence.
create policy alerts_resident_select_active on public.alerts
  for select
  using (
    deleted_at is null
    and expires_at > now()
    and public.auth_role() in ('resident', 'co_mod')
    and residence_id = public.auth_residence_id()
  );

-- co_mod : voit TOUT (expirées + soft-deleted) de sa résidence (modération Epic 5).
create policy alerts_co_mod_select_all on public.alerts
  for select
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  );

-- Auteur : voit ses propres alertes même expirées (gestion / retrait 4.3).
create policy alerts_author_select_own on public.alerts
  for select
  using (
    created_by = auth.uid()
    and residence_id = public.auth_residence_id()
  );

-- Résident AUTEUR : publie ses propres alertes (4.2).
create policy alerts_resident_insert_own on public.alerts
  for insert
  with check (
    public.auth_role() in ('resident', 'co_mod')
    and residence_id = public.auth_residence_id()
    and created_by = auth.uid()
  );

-- Auteur : édite / soft-delete ses propres alertes (pas de policy DELETE).
create policy alerts_author_update_own on public.alerts
  for update
  using (
    created_by = auth.uid()
    and residence_id = public.auth_residence_id()
  )
  with check (
    created_by = auth.uid()
    and residence_id = public.auth_residence_id()
  );

-- ── tips (mêmes policies, miroir alerts) ──────────────────────────────────────
create policy tips_resident_select_active on public.tips
  for select
  using (
    deleted_at is null
    and expires_at > now()
    and public.auth_role() in ('resident', 'co_mod')
    and residence_id = public.auth_residence_id()
  );

create policy tips_co_mod_select_all on public.tips
  for select
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  );

create policy tips_author_select_own on public.tips
  for select
  using (
    created_by = auth.uid()
    and residence_id = public.auth_residence_id()
  );

create policy tips_resident_insert_own on public.tips
  for insert
  with check (
    public.auth_role() in ('resident', 'co_mod')
    and residence_id = public.auth_residence_id()
    and created_by = auth.uid()
  );

create policy tips_author_update_own on public.tips
  for update
  using (
    created_by = auth.uid()
    and residence_id = public.auth_residence_id()
  )
  with check (
    created_by = auth.uid()
    and residence_id = public.auth_residence_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 7 — Grants column-level (ADR 0004 #2). REVOKE total puis GRANT du strict
-- périmètre auteur. created_by NON granté (default auth.uid()). residence_id non
-- granté en UPDATE (tenant figé). created_at / template_id non mutables (UPDATE).
-- ─────────────────────────────────────────────────────────────────────────────
revoke insert, update, delete on public.alerts from authenticated;
grant insert (slug, residence_id, template_id, title_fr, title_ar, body_fr, body_ar, expires_at)
  on public.alerts to authenticated;
grant update (title_fr, title_ar, body_fr, body_ar, expires_at,
              deleted_at, deleted_by, deletion_reason, updated_at)
  on public.alerts to authenticated;

revoke insert, update, delete on public.tips from authenticated;
grant insert (slug, residence_id, category_key, title_fr, title_ar, body_fr, body_ar, expires_at)
  on public.tips to authenticated;
grant update (title_fr, title_ar, body_fr, body_ar, expires_at,
              deleted_at, deleted_by, deletion_reason, updated_at)
  on public.tips to authenticated;

-- alert_templates : lecture seule (SELECT granté par base grants). Aucune écriture
-- client → REVOKE explicite (référentiel curé par migration uniquement).
revoke insert, update, delete on public.alert_templates from authenticated, anon;
