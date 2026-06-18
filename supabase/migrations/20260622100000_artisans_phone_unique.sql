-- Story 2.4 code review (D2 — 2026-06-18) : contrainte UNIQUE phone_e164.
--
-- Le check applicatif (lookup session RLS) ne voit pas les `pending_consent`
-- d'autres résidents ni cross-résidence → fenêtre de doublons et race
-- condition. L'index unique partiel rend la contrainte atomique et globale,
-- tout en autorisant la réutilisation d'un téléphone après soft-delete ou
-- refus (lignes `deleted_at IS NOT NULL` ou `state='refused'` exclues).
--
-- Côté action : détecter `23505 unique_violation` sur cet index pour mapper
-- en `phone_duplicate` (avec lookup admin du slug existant).

create unique index artisans_phone_e164_active_unique
  on public.artisans (phone_e164)
  where deleted_at is null and state != 'refused';
