-- Chantier « suggestions : anonyme ou signée » — le suggérant choisit à l'envoi si
-- les co_mods voient son nom. Le choix est FIGÉ sur la ligne : changer
-- `profiles.identity_mode` plus tard ne dé-anonymise jamais rétroactivement une
-- suggestion déjà envoyée.
--
-- `default false` → les suggestions déjà en base restent anonymes, conformément à
-- la promesse sous laquelle elles ont été écrites (story 6.5 : auteur toujours
-- pseudonymisé côté co_mod).

alter table public.suggestions
  add column signed boolean not null default false;

comment on column public.suggestions.signed is
  'true = le suggérant a choisi que les co_mods voient son nom et sa villa. Figé à l''envoi.';

-- ADR 0004 — grants colonne : le résident peut désormais écrire `body` ET `signed`.
-- `user_id` / `residence_id` restent posés par défaut, `state` reste réservé au
-- co_mod (grant update séparé, inchangé).
grant insert (body, signed) on public.suggestions to authenticated;
