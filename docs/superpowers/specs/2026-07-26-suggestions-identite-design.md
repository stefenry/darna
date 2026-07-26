# Suggestions : anonyme ou signée — design

> Date : 2026-07-26 · Statut : validé · Demande : « les suggestions devraient pouvoir
> être au choix anonymes ou indiquer le nom du suggérant ».

## Contexte

Story 6.5 (FR43c) : un résident envoie une suggestion d'évolution (texte libre
≤ 1000) lue par les co_mods seuls — jamais public, aucun vote. La table
`public.suggestions` stocke `user_id` (défaut `auth.uid()`), mais la page
`/comod/suggestions` affiche **toujours** un pseudonyme HMAC (« Voisin #A3F2 »,
`pseudonymSuffix(user_id, 'suggestions')`), choix délibéré pour réduire la
pression sociale.

Conséquence : un voisin qui veut assumer sa suggestion — pour qu'un co_mod puisse
en discuter avec lui — n'a aucun moyen de le faire.

Le projet a par ailleurs une préférence globale `profiles.identity_mode`
(`pseudo` | `identified`, FR16) qui gouverne l'attribution des bons plans et des
notations artisan, résolue par `lib/content/author-label.ts`.

## Décisions

| Question                   | Décision                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Où se fait le choix        | **Par suggestion**, case à cocher « Signer avec mon nom » dans le formulaire                                                                          |
| Valeur par défaut          | Pré-cochée si `profiles.identity_mode = 'identified'`, sinon décochée                                                                                 |
| Persistance                | Colonne `signed` sur la ligne : le choix est **figé à l'envoi**. Changer sa préférence de profil ne dé-anonymise jamais rétroactivement               |
| Suggestions existantes     | `default false` → restent anonymes, conformément à la promesse sous laquelle elles ont été écrites                                                    |
| Affichage co_mod si signée | `display_name` + villa — « Salma — villa 42 »                                                                                                         |
| Repli                      | `display_name` vide ou profil manquant → pseudonyme (jamais un blanc, jamais un nom par accident) ; `user_id` null (purge RGPD) → « Voisin supprimé » |
| E-mail co_mod              | **Inchangé** : extrait seul, jamais l'auteur (FR42), même signée                                                                                      |
| Historique résident        | Badge « Anonyme » / « Signée » pour que l'auteur se souvienne de son choix                                                                            |

## Composants

1. **Migration** `suggestions_signed` :
   `alter table public.suggestions add column signed boolean not null default false;`
   puis `grant insert (body, signed) on public.suggestions to authenticated;`
   (ADR 0004 — grants colonne). Les policies RLS ne changent pas : `user_id` et
   `residence_id` restent posés par défaut, le résident ne peut toujours écrire
   que sa propre ligne.
2. **Validation** `lib/validation/suggestion.ts` : `zSuggestion` gagne
   `signed: z.coerce.boolean().default(false)` (une checkbox absente du FormData
   vaut `false`).
3. **Helper identité** — généralisation de `lib/content/author-label.ts` :
   `resolveNeighbourLabels(ids, { scope })` (admin client, batch, server-only)
   renvoie par id la matière brute `{ displayName, villa, identityMode, pseudonym,
deleted }`. Chaque appelant applique **sa** règle : les bons plans gardent leur
   comportement via un wrapper `resolveTipAuthorLabels` inchangé côté signature ;
   les suggestions décident sur `signed`. `user_id` n'est jamais sérialisé vers le
   client — seul le libellé part.
4. **Server Action** `submitSuggestion` : lit la checkbox, insère
   `{ body, signed }`. Rate-limit, garde `requireResident`, notification co_mod :
   inchangés.
5. **Page résident** : lit `profiles.identity_mode` (session, RLS self) et passe
   `defaultSigned` au formulaire ; l'historique affiche le badge du choix.
6. **Formulaire** : case à cocher + libellé explicite sur ce que verra le co_mod
   (« Les co-mods verront ton nom et ta villa »), cible tactile ≥ 44 px.
7. **Page co_mod** : `select` gagne `signed` ; libellé résolu par le helper ;
   l'intro « Auteur pseudonymisé » devient « Auteur pseudonymisé, sauf si le
   voisin a signé ».
8. **i18n** : nouvelles clés `suggestion.signed*` et `suggestion.comod.authorNamed`
   dans `fr.json` et `ar.json`.

## Sécurité / invariants

- Le grant colonne empêche un résident de forger `user_id`, `residence_id` ou
  `state` ; `signed` est la seule capacité ajoutée, et elle ne porte que sur sa
  propre ligne.
- Le nom d'un voisin n'est jamais lisible par un autre résident via RLS : la
  résolution passe par l'admin client **côté serveur uniquement**, dans une page
  déjà réservée aux co_mods (proxy + `requireComod` + RLS).
- Le défaut sûr est le pseudonyme à chaque branche d'échec (colonne absente,
  profil manquant, `display_name` vide, utilisateur purgé).
- Aucune suggestion déjà envoyée ne change de visibilité.

## Tests

- Unitaires : règle de libellé (signée avec nom / signée sans `display_name` →
  pseudonyme / anonyme / auteur purgé), parsing de la checkbox absente ou présente.
- L'invariant RLS (« un résident n'écrit que `body` et `signed`, sur sa propre
  ligne ») est porté par le grant colonne de la migration. Pas de cas ajouté dans
  `tests/rls.test.ts` : ce fichier est `skipIf` sans stack Docker et n'est jamais
  exécuté en CI — à vérifier à la main sur la stack locale si Docker est dispo.
- Non couvert : le rendu réel de la page co_mod avec un compte co_mod — vérifié
  manuellement sur le preview Vercel.

## Hors scope

Répondre à une suggestion depuis l'app (canal de discussion), notifications au
suggérant, vote ou commentaire — l'anti-toxicité par construction de la story 6.5
reste la règle.
