# Annuaire compact, créateur affiché, WhatsApp — design

> Date : 2026-07-26 · Statut : validé · Demande : « la liste des artisans devrait être
> plus compacte : le bouton pour appeler pourrait être juste à côté du nom » ·
> « j'aimerais voir sur la fiche de l'artisan le nom du voisin qui l'a créé (ou pseudo
> si choix d'être anonyme) » · « peut-on faire un lien pour envoyer un message WhatsApp
> directement depuis la fiche de l'artisan ? »

Trois évolutions de la même surface (annuaire + fiche artisan), livrées ensemble.

## Contexte

`ArtisanCard` (story 2.2) empile aujourd'hui quatre rangées : en-tête (nom + prix),
chip métier, deux jauges de notation, pied (badge facture + mini-bouton d'appel).
La carte entière est un lien via un overlay absolu ; le bouton `tel:` est un lien
DOM **séparé** au-dessus (`z-10`) — pas de lien imbriqué, HTML valide.

La fiche artisan affiche le nom, le prix, les compétences, la facture et le
téléphone. `artisans.created_by` existe (`on delete set null`, ADR 0006) mais n'est
jamais affiché. Un résident ne peut pas lire le `display_name` d'un autre résident
via RLS — d'où le helper admin server-only `lib/content/author-label.ts`.

Le numéro est stocké en E.164 (`phone_e164`, `+212…`).

## Décisions

| Question                    | Décision                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Carte : disposition         | 3 rangées — nom + bouton d'appel / meta inline (chip · prix · facture) / 2 jauges                                                                                                    |
| Carte : nom long            | `min-w-0` + troncature, pour que le bouton ne soit jamais poussé hors de la carte                                                                                                    |
| Carte : a11y                | Cible tactile ≥ 44 px et `aria-label` « Appeler {nom} » conservés (job a11y bloquant en CI) ; le bouton reste un lien DOM séparé de l'overlay                                        |
| Créateur : règle d'identité | Préférence globale `profiles.identity_mode` — même sémantique que les bons plans. Aucune migration, effet immédiat sur les fiches existantes                                         |
| Créateur : contrepartie     | Assumée — basculer sa préférence réécrit le libellé de ses anciennes fiches                                                                                                          |
| Créateur : repli            | `created_by` null (purge RGPD) → « Voisin supprimé » ; `identity_mode = 'identified'` sans `display_name` → pseudonyme                                                               |
| Créateur : emplacement      | Ligne discrète sous l'en-tête de la fiche : « Fiche ajoutée par … »                                                                                                                  |
| WhatsApp : cible            | `https://wa.me/<e164 sans +>`, **conversation vide** (aucun texte imposé au nom du voisin)                                                                                           |
| WhatsApp : emplacement      | Fiche artisan uniquement, à côté d'« Appeler » — pas sur la carte, qui doit maigrir                                                                                                  |
| WhatsApp : libellé          | Icône message + libellé « WhatsApp » (Lucide n'a plus d'icônes de marque). On ne peut pas savoir si le numéro a WhatsApp : le libellé annonce le canal, il ne promet pas une réponse |

## Composants

1. **`ArtisanCard`** — passage à 3 rangées. Le pied disparaît ; `InvoiceBadge`
   rejoint la ligne meta avec le chip et le prix (`flex-wrap`, séparateurs
   discrets). Le mini-bouton d'appel monte dans l'en-tête, à droite du nom.
2. **Helper WhatsApp** `lib/artisans/whatsapp.ts` : `waMeUrl(phoneE164)` → retire
   le `+`, valide que le reste est bien numérique, renvoie `null` sinon (l'UI
   n'affiche alors pas le bouton plutôt que de produire un lien cassé).
3. **Bouton WhatsApp** dans le bloc contact de la fiche : `target="_blank"`,
   `rel="noopener noreferrer"`. Lien sortant simple, sans script tiers — la
   promesse « sans tracker » de la page d'accueil reste tenue.
4. **Créateur** : la couche données de la fiche (`artisan/[slug]/data.ts`) lit
   `created_by` (server-only) et résout le libellé via `resolveNeighbourLabels`
   (scope `artisans`) ; seul le libellé traverse vers le client, jamais l'`user_id`.
   Rendu par une ligne `text-sm text-neutral-500` sous l'en-tête.
5. **i18n** : clés `community.artisan.createdBy*` et `community.artisan.whatsapp`
   dans `fr.json` et `ar.json`.

## Dépendance

Le point 4 utilise `resolveNeighbourLabels`, introduit par la spec
`2026-07-26-suggestions-identite-design.md`. Si ce chantier est mergé en premier,
il embarque le helper ; sinon il le consomme. Les deux branches partent de `main` :
la première mergée fait référence, la seconde rebase.

## Sécurité / invariants

- Aucun changement de RLS, aucune migration.
- `created_by` ne quitte jamais le serveur ; le client ne reçoit qu'un libellé
  déjà résolu.
- Défaut sûr : toute branche d'échec (profil manquant, `display_name` vide,
  auteur purgé) retombe sur le pseudonyme ou « Voisin supprimé », jamais sur un
  nom par accident.
- Le lien `wa.me` n'expose rien de plus que le `tel:` déjà présent : le numéro de
  l'artisan est déjà affiché sur la fiche.

## Tests

- Unitaires : `waMeUrl` (numéro marocain nominal, numéro non numérique, chaîne
  vide) ; règle de libellé créateur (identifié / pseudo / purgé).
- Rendu : la carte garde son lien d'ouverture et son bouton d'appel étiquetés ;
  le job a11y de la CI vérifie les cibles tactiles et les contrastes.
- Vérification visuelle sur le serveur de dev (capture avant/après de la liste)
  avant d'ouvrir la PR.

## Hors scope

Bouton WhatsApp sur les cartes de l'annuaire, message pré-rempli, détection de la
présence réelle de WhatsApp sur le numéro, affichage du créateur dans la liste.
