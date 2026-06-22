-- 2026-06-22 — extension du référentiel de compétences artisan (Story UX 2.2
-- post-feedback Stephane). Demande utilisateur en bêta : nombre de tags trop
-- réduit, manquait notamment solaire / IPTV / piscine — usages très courants
-- dans une résidence marocaine.
--
-- 8 nouveaux tags : solaire, iptv_satellite, internet_wifi, piscine, alarme,
-- nettoyage, ferronnerie, vitrerie.
-- Idempotent via ON CONFLICT (la table tags a `key text unique`).

insert into public.tags (key, label_fr, label_ar) values
  ('solaire',         'Solaire',                null),
  ('iptv_satellite',  'IPTV / Satellite',       null),
  ('internet_wifi',   'Internet / Wi-Fi',       null),
  ('piscine',         'Piscine',                null),
  ('alarme',          'Alarme & sécurité',      null),
  ('nettoyage',       'Nettoyage / Ménage',     null),
  ('ferronnerie',     'Ferronnerie',            null),
  ('vitrerie',        'Vitrerie',               null)
on conflict (key) do nothing;
