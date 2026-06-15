-- Story 1.3 — Seed résidence Darna (AR34 : aucun user/co-mod en SQL).
-- UUID stable (constante de migration) : référencé par handle_new_auth_user()
-- pour MVP mono-résidence. Idempotent via ON CONFLICT.
-- Provisioning co-mods = scripts/invite-co-mods.ts (Story 1.6/1.8, post-deploy).

insert into public.residences (id, name, slug, villa_count)
values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Darna',
  'darna',
  150
)
on conflict (id) do nothing;
