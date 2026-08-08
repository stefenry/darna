-- Feedback bêta 2026-08-08 — la « recommandation » saisie à la création d'une
-- fiche artisan était PERDUE, et absente de l'écran de validation du co_mod.
--
-- Ce n'était pas un bug d'affichage : le champ n'a jamais été persisté. La story
-- 2.4 l'avait acté explicitement — `ratings` impose
-- `num_nonnulls(score_*) >= 1`, donc un commentaire SANS note n'est pas
-- insérable comme rating ; la persistance fut « différée à 2.6 », avec la
-- mention « le champ peut être collecté puis ignoré, OU retiré du formulaire —
-- à acter ». La 2.6 a livré les avis notés, mais personne n'est revenu : le
-- formulaire promettait « Votre recommandation (optionnel) » et jetait la saisie.
-- `createArtisan` lisait `comment` puis ne s'en servait plus jamais.
--
-- Arbitrage 2026-08-08 : la recommandation est le MOTIF du contributeur, pas un
-- avis noté. Elle vit donc sur la fiche, et non dans `ratings` — ce qui évite de
-- relâcher le CHECK ≥1 note (agrégats, « Avis des voisins », modération) et la
-- policy d'insertion qui exige une fiche déjà publiée.
--
-- ⚠️ Les recommandations saisies AVANT cette migration sont irrécupérables :
-- elles n'ont jamais atteint la base. Aucun backfill possible.

alter table public.artisans
  add column if not exists recommendation_text text;

-- Miroir du Zod `comment: zOptionalText(500)` (lib/validation/artisan.ts).
alter table public.artisans
  drop constraint if exists artisans_recommendation_text_len_check;
alter table public.artisans
  add constraint artisans_recommendation_text_len_check
  check (recommendation_text is null or char_length(recommendation_text) <= 500);

-- GRANTs colonne par colonne : `artisans` est en REVOKE total + GRANT explicite
-- (story 2.1). Sans ces lignes, l'INSERT du contributeur échouerait en 42501 et
-- la colonne resterait invisible en lecture.
--
-- Volontairement PAS de `update` : le formulaire d'édition
-- (artisan/[slug]/modifier) ne porte pas encore ce champ. À ajouter le jour où
-- il le portera — moindre privilège d'ici là.
grant select (recommendation_text) on public.artisans to anon, authenticated;
grant insert (recommendation_text) on public.artisans to authenticated;
