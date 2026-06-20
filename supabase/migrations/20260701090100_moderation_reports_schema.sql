-- Story 5.1 — Schéma signalements + extension moderation_log + RLS transparence.
--
-- Tables : reports (signalements résident → co_mod). Extension moderation_log
-- (payload_json). Vue moderation_log_public (redaction transparence FR33/CC#19).
-- Couvre FR31-FR34, AR5, AR6 (RLS), AR7 (multi-tenant), AR9, AR15, NFR17.
-- Modèle exact : 20260630090100_ephemeral_content_schema (DDL+RLS+grants+trigger).
--
-- Décisions techniques (cf. story 5.1 Dev Notes) :
--   - RLS asymétrique : le RÉSIDENT est AUTEUR de SES reports (INSERT/SELECT own,
--     pas d'UPDATE) ; le co_mod voit + résout (UPDATE) tous ceux de sa résidence.
--   - Idempotence : index UNIQUE partiel (reporter_id, target_type, target_id)
--     WHERE state='open' → un seul signalement ouvert par (reporter, cible).
--   - Audit : trigger AFTER INSERT log_report_opened (SECURITY DEFINER) écrit
--     moderation_log report_opened (payload no-PII), le résident n'ayant aucun
--     grant sur moderation_log.
--   - Transparence : vue moderation_log_public SECURITY DEFINER, whitelist
--     colonnes + actions, display_name co_mod only, masque cibles PII.

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 2a — Extension moderation_log : payload_json no-PII (structuré, Epic 5).
--   Le log reste immutable (INSERT seul, pas de soft-delete sur le log).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.moderation_log
  add column if not exists payload_json jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 2b — reports : signalement résident, multi-tenant.
--   reporter_id default auth.uid() (anti-spoof, non granté) → set null
--   (anonymisation RGPD ADR 0006, le report subsiste pour le co_mod).
--   resolution_motive = motif de retrait/conservation (audit, renseigné en 5.3).
-- ─────────────────────────────────────────────────────────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences(id) on delete restrict,
  reporter_id uuid references public.users(id) on delete set null default auth.uid(),
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason public.report_reason not null,
  note_text text,
  state public.report_state not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  resolution_motive text,
  constraint reports_note_maxlen check (note_text is null or length(note_text) <= 200),
  constraint reports_resolution_motive_maxlen
    check (resolution_motive is null or length(resolution_motive) <= 2000)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 2c — Index.
--   Queue co_mod (5.3) : (residence_id, state, created_at) — open, oldest first.
--   Résident : (reporter_id) — « mes signalements ».
--   Actions antérieures sur une cible (5.3 détail) : (target_type, target_id).
--   Idempotence (D5) : UNIQUE partiel un open par (reporter, cible).
-- ─────────────────────────────────────────────────────────────────────────────
create index idx_reports_residence_state_created
  on public.reports (residence_id, state, created_at);
create index idx_reports_reporter on public.reports (reporter_id);
create index idx_reports_target on public.reports (target_type, target_id);
create unique index reports_unique_open_per_reporter_target
  on public.reports (reporter_id, target_type, target_id)
  where state = 'open';

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 4 — Trigger audit : report_opened → moderation_log (AR19).
--   SECURITY DEFINER (owner postgres, BYPASSRLS) : le résident n'a aucun grant
--   sur moderation_log. actor_id = reporter (audit interne anti-abus, jamais
--   exposé — report_opened exclu de la vue publique). payload no-PII : pas de
--   note_text (saisie libre potentiellement PII).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.log_report_opened()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.moderation_log
    (residence_id, actor_id, action, target_kind, target_id, reason_code, payload_json)
  values
    (new.residence_id, new.reporter_id, 'report_opened',
     new.target_type::text, new.target_id, new.reason::text,
     jsonb_build_object('target_type', new.target_type, 'reason', new.reason));
  return new;
end;
$$;

create trigger trg_reports_log_opened
  after insert on public.reports
  for each row execute function public.log_report_opened();

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 3 — RLS (AR6, défense en profondeur ADR 0004).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.reports enable row level security;

-- Résident AUTEUR : signale (INSERT ses propres reports).
create policy reports_reporter_insert_own on public.reports
  for insert
  with check (
    public.auth_role() in ('resident', 'co_mod')
    and reporter_id = auth.uid()
    and residence_id = public.auth_residence_id()
  );

-- Résident : voit SEULEMENT ses propres signalements (jamais ceux des autres).
create policy reports_reporter_select_own on public.reports
  for select
  using (reporter_id = auth.uid());

-- co_mod : voit tous les signalements de sa résidence (queue 5.3).
create policy reports_co_mod_select_residence on public.reports
  for select
  using (
    public.auth_role() = 'co_mod'
    and residence_id = public.auth_residence_id()
  );

-- co_mod : résout (UPDATE state + colonnes de résolution) ceux de sa résidence.
-- (Pas de policy UPDATE résident → AC3 ; pas de policy DELETE → résolution = UPDATE.)
create policy reports_co_mod_update_residence on public.reports
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
-- Task 3b — Grants column-level (ADR 0004 #2). REVOKE total puis GRANT strict.
--   reporter_id NON granté (default auth.uid()). residence_id non granté en
--   UPDATE. Le co_mod ne mute que les colonnes de résolution.
-- ─────────────────────────────────────────────────────────────────────────────
revoke insert, update, delete on public.reports from authenticated, anon;
grant insert (residence_id, target_type, target_id, reason, note_text)
  on public.reports to authenticated;
grant update (state, resolved_at, resolved_by, resolution_motive)
  on public.reports to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 5 — Vue moderation_log_public : redaction transparence (FR33, CC #19).
--   SECURITY DEFINER (security_invoker=false) : bypass RLS moderation_log, mais
--   whiteliste explicitement colonnes ET actions. Aucune colonne PII brute.
--     - display_name exposé UNIQUEMENT pour actor.role='co_mod' (identification
--       acceptée par rôle, cf. 5.4) ; acteurs système / résidents → null.
--     - events PII (user_deleted) : target_id + payload masqués.
--     - actions consent-résidence + report_opened EXCLUES (non publiques).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.moderation_log_public
with (security_invoker = false)
as
select
  ml.id,
  ml.created_at,
  ml.action,
  ml.target_kind,
  case when ml.action = 'user_deleted' then null else ml.target_id end as target_id,
  ml.reason_code,
  case when actor.role = 'co_mod' then actor.display_name end as actor_display_name,
  ml.residence_id,
  case when ml.action = 'user_deleted' then null else ml.payload_json end as payload_json
from public.moderation_log ml
left join public.users actor on actor.id = ml.actor_id
where ml.action not in (
  -- Actions consent-artisan : résidence-scoped, déjà non publiques (2.x).
  'artisan_published', 'artisan_consent_refused', 'artisan_retracted',
  'artisan_reconsent_requested', 'artisan_reconsent_refused',
  'artisan_reconsent_accepted',
  'artisan_response_published', 'artisan_rectification_requested',
  -- Signal privé : un report ouvert ne s'affiche pas sur /transparence (D2).
  'report_opened'
);

-- Lecture publique de la vue (transparence radicale — anon + authenticated).
grant select on public.moderation_log_public to anon, authenticated;
