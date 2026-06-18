-- Story 1.10a — Hardening admission (dette deferred 1.7).
--
-- 1) Index unique partiel : empêche deux demandes 'pending' simultanées pour le
--    même user (race condition 2 soumissions, deferred-work 1.7). La Server
--    Action catch le conflit 23505 → renvoie `duplicate_pending`.
create unique index if not exists admission_requests_one_pending_per_user
  on public.admission_requests (user_id)
  where state = 'pending' and deleted_at is null;

-- 2) Resserrer le column-grant UPDATE (deferred-work 1.7 #97) : retirer
--    deleted_at / deleted_by / deletion_reason du grant `authenticated`. Le
--    soft-delete passe désormais uniquement par service-role / SECURITY DEFINER
--    (cohérent avec le modèle de suppression 1.9). La RLS bloquait déjà en
--    pratique, mais le grant était sur-permissif.
revoke update on public.admission_requests from authenticated;
grant update (state, decision_reason, decided_by, decided_at, updated_at, email_verified_at)
  on public.admission_requests to authenticated;
