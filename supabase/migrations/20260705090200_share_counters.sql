-- Story 6.2 — compteur de partages par entité (FR37, NFR16/NFR52 : compteur seul,
-- zéro PII, zéro tracking). `share_count` dénormalisé sur chaque table partageable,
-- incrémenté via RPC SECURITY DEFINER (le résident n'a aucun grant d'écriture sur
-- cette colonne — défense en profondeur ADR 0004).

alter table public.artisans add column if not exists share_count integer not null default 0;
alter table public.alerts add column if not exists share_count integer not null default 0;
alter table public.tips add column if not exists share_count integer not null default 0;
alter table public.guide_entries add column if not exists share_count integer not null default 0;

-- increment_share_count — +1 atomique sur l'entité partagée.
--   Whitelist kind → table (anti-injection, %I littéral sûr). Borné à la résidence
--   de l'appelant (auth_residence_id()) : un résident ne peut gonfler que les
--   compteurs de SA résidence. Idempotence non requise (compteur best-effort).
create or replace function public.increment_share_count(p_kind text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_kind = 'artisan' then v_table := 'artisans';
  elsif p_kind = 'alert' then v_table := 'alerts';
  elsif p_kind = 'tip' then v_table := 'tips';
  elsif p_kind = 'guide_entry' then v_table := 'guide_entries';
  else raise exception 'invalid_kind';
  end if;

  execute format(
    'update public.%I set share_count = share_count + 1 '
    'where id = $1 and residence_id = public.auth_residence_id() and deleted_at is null',
    v_table
  ) using p_id;
end;
$$;

revoke execute on function public.increment_share_count(text, uuid) from public, anon;
grant execute on function public.increment_share_count(text, uuid) to authenticated;
