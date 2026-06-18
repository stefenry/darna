-- Story 1.7 — Ajoute la colonne email_verified_at sur admission_requests.
-- Set par /auth/confirm via service-role après que le demandeur a cliqué le magic-link
-- (markAdmissionEmailVerified helper). Permet aux co-mods (Story 1.8) de filtrer
-- la queue sur les demandes confirmées vs en attente d'ouverture e-mail.
--
-- Migration additive : aucun seed n'utilise admission_requests (Story 1.3 ne seed
-- que residences), donc aucun backfill nécessaire.

alter table public.admission_requests
  add column email_verified_at timestamptz null;

-- Étendre le column-level grant UPDATE pour autoriser cette colonne côté
-- authenticated (service-role bypasse ce grant, mais on garde la discipline
-- en cas de futur switch vers session demandeur).
-- On replace l'ensemble du grant avec la liste complète des colonnes mutables.
revoke update on public.admission_requests from authenticated;
grant update (state, decision_reason, decided_by, decided_at, updated_at,
              email_verified_at,
              deleted_at, deleted_by, deletion_reason)
  on public.admission_requests to authenticated;
