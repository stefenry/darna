# Gestion des compétences artisan par les co_mods — design

> Date : 2026-07-23 · Statut : validé (approche B) · Demande : pouvoir enrichir la
> liste des compétences des artisans sans migration SQL.

## Contexte

Le référentiel de compétences vit dans la table **globale** `tags` (`key` unique,
`label_fr`, `label_ar` nullable — pas de `residence_id`). Seed initial + extension
unique par migration (`20260706085500_more_tags`). Les filtres de l'annuaire et les
formulaires de création/édition d'artisan lisent la table dynamiquement : tout tag
ajouté apparaît sans code supplémentaire. Aucun outil d'ajout n'existe dans l'app.

Le système de suggestions (Epic 6.5) permet déjà à tout résident de proposer une
compétence manquante (Profil → Paramètres → Suggestion → lu par les co_mods dans
`/comod/suggestions`) — il manque le maillon final : l'outil d'ajout côté co_mod.

## Décisions

| Question             | Décision                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qui enrichit         | Co_mods, via une section « Compétences » de `/comod/admin`                                                                                                                                    |
| Opérations           | Ajout + renommage des libellés. Pas de suppression (fiches référencées), pas de désactivation (YAGNI MVP)                                                                                     |
| Clé (`key`)          | Générée en SQL depuis `label_fr` (slug snake_case, unaccent), **immuable** après création                                                                                                     |
| Architecture         | **B** : RPC `SECURITY DEFINER` (`comod_add_tag`, `comod_rename_tag`) — `tags` est globale, pas de policy d'écriture ouverte ; dédup et slug atomiques en SQL. Pattern `comod_remove_resident` |
| Suggestions résident | Flux existant réutilisé tel quel + pont UX : lien « Une compétence manque ? Suggérez-la » sous le sélecteur de tags des formulaires artisan (création + édition)                              |
| Audit                | Logs applicatifs `comod.tag_added` / `comod.tag_renamed` (pas un acte de modération → pas de `moderation_log`, cohérent avec `comod.promoted`)                                                |

## Composants

1. **Migration** `comod_tag_rpcs` : extension `unaccent` si absente ;
   `comod_add_tag(p_label_fr, p_label_ar default null)` → gardes (`forbidden` si non
   co_mod, `invalid_label` hors 2–40 chars trim, `duplicate` si clé slug OU libellé
   normalisé déjà pris) → insert → retourne `(key, label_fr)` ;
   `comod_rename_tag(p_key, p_label_fr, p_label_ar default null)` → gardes
   (`forbidden`, `not_found`, `invalid_label`, `duplicate` vs autres tags) → update
   des libellés uniquement. `GRANT EXECUTE TO authenticated`, gardes en SQL.
2. **Types** : entrées `comod_add_tag` / `comod_rename_tag` dans
   `types.generated.ts` (identiques au générateur, vérifié via stack locale).
3. **Server Actions** `app/[locale]/comod/admin/_actions/tags.ts` ('use server',
   fonctions async uniquement — types partagés dans `tags-state.ts`) : `addTag`,
   `renameTag` → `requireComod()` + RPC via client session, mapping des codes
   d'erreur, `revalidatePath`, logs applicatifs.
4. **UI** : tuile « Compétences » dans le hub `/comod` (pattern tuiles existantes) ;
   page `/comod/admin/competences` : formulaire d'ajout (libellé FR requis, AR
   optionnel) + liste des tags (libellés + nombre d'artisans de la résidence les
   utilisant) avec édition inline. Composants client sur le modèle des sections
   admin existantes.
5. **Pont UX** : ligne « Une compétence manque ? Suggérez-la » (lien vers
   `/{locale}/community/profil/parametres/suggestion`) sous le sélecteur de
   compétences de `create-artisan-form` et du formulaire d'édition.
6. **i18n** : clés `comod.admin.competences.*` + clé du lien côté formulaire
   artisan, `fr.json` (AR : fallback FR, dette V1.5).

## Sécurité / invariants

- Un résident qui forge l'appel RPC est rejeté en SQL (`auth_role()`).
- `key` immuable → aucune fiche artisan ne peut se retrouver orpheline.
- Dédup par clé ET par libellé normalisé (pas de « Plombier » / « plombier »).
- Table globale : un tag ajouté sert toutes les résidences (assumé au MVP
  mono-résidence ; scoping éventuel = décision V2 documentée ici).

## Tests

- Unitaires `tests/comod/tags-admin.test.ts` : forbidden, libellés invalides,
  mapping `duplicate`/`not_found`, happy paths add + rename, pas de PII loggée.
- RLS `tests/rls.test.ts` : résident rejeté sur les 2 RPC ; co_mod ajoute (slug
  vérifié), renomme, doublon rejeté.
- Suite existante (544) au vert ; CI PR complète avant merge.
