-- Review Epic 4 (bloquant #2) — durcissement des droits UPDATE de l'AUTEUR sur
-- alerts / tips.
--
-- Faille : la policy `*_author_update_own` (USING created_by = auth.uid(), sans
-- garde sur deleted_at) + le GRANT UPDATE(deleted_at, deleted_by, deletion_reason)
-- laissaient l'auteur, via un UPDATE direct PostgREST, RESTAURER son propre contenu
-- après un retrait de modération co_mod (5.3 `moderate_remove_content` soft-delete
-- ces MÊMES tables) en posant `deleted_at = null` — défaisant la modération et SANS
-- trace moderation_log (l'UPDATE direct n'est pas audité). Idem self-retract non
-- audité (le résident soft-deletait sans passer par la RPC).
--
-- Correctif (défense en profondeur, ADR 0004) :
--   1. RLS : `*_author_update_own` ne s'applique qu'aux lignes VIVANTES
--      (deleted_at IS NULL), en USING et WITH CHECK → une fois retiré (par soi via
--      RPC, par un co_mod, ou expiré par le cron), l'auteur ne peut plus ni éditer
--      ni restaurer la ligne.
--   2. Grants : l'auteur ne conserve QUE les colonnes de contenu en UPDATE. Les
--      colonnes de soft-delete (deleted_at, deleted_by, deletion_reason) sortent du
--      périmètre client : le SEUL chemin de retrait est la RPC `retract_own_ephemeral`
--      (SECURITY DEFINER, owner postgres → bypass RLS + grants), qui garantit l'audit.
--
-- Les autres rôles ne sont pas touchés : le cron (service_role) et les RPC
-- (SECURITY DEFINER) ne sont pas soumis aux grants `authenticated` ni à la RLS.

-- ── alerts ────────────────────────────────────────────────────────────────────
drop policy if exists alerts_author_update_own on public.alerts;
create policy alerts_author_update_own on public.alerts
  for update
  using (
    created_by = auth.uid()
    and residence_id = public.auth_residence_id()
    and deleted_at is null
  )
  with check (
    created_by = auth.uid()
    and residence_id = public.auth_residence_id()
    and deleted_at is null
  );

revoke update on public.alerts from authenticated;
grant update (title_fr, title_ar, body_fr, body_ar, expires_at, updated_at)
  on public.alerts to authenticated;

-- ── tips (miroir) ─────────────────────────────────────────────────────────────
drop policy if exists tips_author_update_own on public.tips;
create policy tips_author_update_own on public.tips
  for update
  using (
    created_by = auth.uid()
    and residence_id = public.auth_residence_id()
    and deleted_at is null
  )
  with check (
    created_by = auth.uid()
    and residence_id = public.auth_residence_id()
    and deleted_at is null
  );

revoke update on public.tips from authenticated;
grant update (title_fr, title_ar, body_fr, body_ar, expires_at, updated_at)
  on public.tips to authenticated;
