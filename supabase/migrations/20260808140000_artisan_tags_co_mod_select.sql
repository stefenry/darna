-- Feedback bêta 2026-08-08 — un co_mod ne voyait PAS les compétences de l'artisan
-- sur l'écran de validation, alors qu'elles sont nécessaires pour décider.
--
-- Ce n'était pas un manque d'affichage : la fiche interroge et rend déjà les tags
-- (artisan-header.tsx). Le trou est côté RLS. `artisans` a bien sa policy co_mod
-- tous-états (`artisans_co_mod_select_residence`, 20260619090000), mais
-- `artisan_tags` n'a JAMAIS eu son équivalent — sa seule policy de lecture,
-- `artisan_tags_resident_select`, exige :
--
--     (state = 'published' AND même résidence)  OR  created_by = auth.uid()
--
-- Or une fiche à valider est en `pending_consent`, et le co_mod validant n'est en
-- général pas celui qui l'a créée. La jointure embarquée
-- `artisan_tags ( tags ( … ) )` renvoyait donc un tableau VIDE, et le rendu masque
-- la section quand la liste est vide (`tags.length > 0 &&`) : les compétences
-- disparaissaient silencieusement, sans erreur ni indice.
--
-- Reproduit avant correctif sur cette base : fiche pending_consent visible par le
-- co_mod (1 ligne), ses compétences invisibles (0 ligne) alors que 2 existaient.
--
-- On ajoute donc le miroir exact de la policy `artisans`. Les policies étant
-- OR-ées, cela n'élargit rien pour les résidents : seul un co_mod de LA résidence
-- de la fiche gagne la lecture, et uniquement hors soft-delete.
--
-- La table `tags` (référentiel) est déjà en `using (true)` : rien à y faire.

drop policy if exists artisan_tags_co_mod_select_residence on public.artisan_tags;

create policy artisan_tags_co_mod_select_residence on public.artisan_tags
  for select
  using (
    public.auth_role() = 'co_mod'
    and exists (
      select 1
        from public.artisans a
       where a.id = artisan_tags.artisan_id
         and a.residence_id = public.auth_residence_id()
         and a.deleted_at is null
    )
  );
