-- Story 2.3 code review (D2 — 2026-06-17) : matérialiser `author_display_name`
-- sur `ratings`.
--
-- La policy RLS `users_resident_select_self` n'autorise un résident à lire
-- `users.display_name` que pour `auth.uid() = id`. PostgREST applique la RLS
-- sur les jointures embedded → `select users(display_name)` retourne `null`
-- pour TOUS les avis nommés d'autres résidents. Conséquence : 100 % des
-- commentaires `visibility='named'` s'affichaient « Un voisin ».
--
-- Choix : dénormaliser le nom au write (snapshot dans `ratings`). Trade-off :
-- décohérence si l'utilisateur renomme son profil post-rating — acceptable
-- pour des avis qui sont par nature ancrés dans le temps.

alter table public.ratings
  add column author_display_name text;

-- Trigger : populate au INSERT (et au UPDATE de user_id si jamais).
create or replace function public.set_rating_author_display_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    select display_name into new.author_display_name
      from public.users
      where id = new.user_id;
  else
    new.author_display_name := null;
  end if;
  return new;
end;
$$;

create trigger trg_ratings_set_author_display_name
  before insert or update of user_id on public.ratings
  for each row
  execute function public.set_rating_author_display_name();

-- Backfill : nom courant au moment de l'application.
update public.ratings r
set author_display_name = u.display_name
from public.users u
where u.id = r.user_id
  and r.author_display_name is null;

-- INSERT grant : `author_display_name` est posé par trigger ; pas besoin de
-- l'autoriser côté client. UPDATE grant : idem, contrôlé par trigger.
-- (Aucun GRANT modifié — voir 20260619090000 § grants ratings.)
