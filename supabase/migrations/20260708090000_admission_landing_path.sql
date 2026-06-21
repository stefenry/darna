-- Story 6.3 (FR39) — capture du contexte pré-login. Un visiteur ouvrant une URL
-- canonique d'entité est invité à s'inscrire ; le chemin cible (`landing_path`)
-- est mémorisé sur sa demande d'admission, et restitué dans le magic-link de
-- BIENVENUE (post-acceptation) → il atterrit directement sur l'entité.
--
-- Écrit en service-role à l'INSERT (story 1.7) ; lu en service-role à l'accept
-- (sendWelcome). Aucun grant client (la colonne n'est jamais posée par PostgREST).
-- CHECK : null ou chemin canonique d'entité (`/artisan|alerte|bon-plan|guide/<slug>`)
-- — défense en profondeur vs open-redirect, miroir du validateur applicatif.

alter table public.admission_requests
  add column if not exists landing_path text;

alter table public.admission_requests
  add constraint admission_requests_landing_path_format check (
    landing_path is null
    or landing_path ~ '^/(artisan|alerte|bon-plan|guide)/[a-z0-9][a-z0-9-]{0,79}$'
  );
