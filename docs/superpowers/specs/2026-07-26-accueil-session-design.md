# Accueil conscient de la session — design

> Date : 2026-07-26 · Statut : validé · Demande : « sur l'écran d'accueil, il n'y a
> actuellement que deux boutons : "demander accès" et "installer l'app". Mais quand on
> a déjà un accès, il n'est pas évident qu'il faille cliquer de nouveau sur "demander
> l'accès"… c'est déroutant pour les nouveaux utilisateurs au début. »

## Contexte

`app/[locale]/(public)/page.tsx` affiche deux CTA : « Demander l'accès » (`/admission`)
et « Installer l'app » (`/install`). Le lien de connexion existe, mais **enterré en bas
de `/admission`** (« Déjà demandé l'accès ? Me connecter »). Il faut donc passer par le
mauvais bouton pour trouver le bon lien.

Deuxième problème, non signalé mais plus grave : la page ne fait **aucune vérification
de session**, et `start_url` vaut `/` dans le manifeste. Un résident déjà connecté qui
ouvre la PWA installée atterrit donc sur une page marketing qui lui propose de demander
un accès qu'il a déjà. Ce défaut a été confirmé en situation réelle : la vérification
des previews Vercel par Stéphane a échoué pour exactement cette raison — sur une
origine sans session, l'accueil n'offre aucune porte d'entrée.

## Décisions

| Question                          | Décision                                                                                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Utilisateur connecté              | L'accueil **reste affiché** mais reconnaît la session — pas de redirection automatique (décision explicite : la page de présentation doit rester montrable depuis son propre téléphone) |
| CTA résident / co_mod             | « Entrer dans Darna » → destination résolue par `resolveRedirect` (`/community/` ou `/comod`)                                                                                           |
| CTA demande en attente ou refusée | « Voir ma demande d'accès » → `/admission/pending` ou `/admission/refused`                                                                                                              |
| CTA connecté sans demande         | « Demander l'accès » → `/admission` (il doit effectivement postuler)                                                                                                                    |
| CTA anonyme                       | « Demander l'accès » **+ lien secondaire visible** « J'ai déjà un accès — Me connecter » → `/auth/login`                                                                                |
| Lien de connexion                 | Affiché **uniquement** hors session (inutile et déroutant sinon)                                                                                                                        |
| « Installer l'app »               | Masqué quand l'app est déjà installée, via `@media (display-mode: standalone)` en CSS pur — pas de JS, pas d'hydratation                                                                |
| Destination                       | Toujours `resolveRedirect`, le helper déjà utilisé par `/auth/confirm` : une seule source de vérité pour « où va ce compte »                                                            |
| AR                                | Pas de nouvelles clés : le namespace `home` d'`ar.json` n'a déjà que `title`/`subtitle`, les CTA tombent en fallback FR (dette V1.5 assumée)                                            |

## Composants

1. **`lib/auth/home-cta.ts`** — fonction pure `homeCta(destination: string | null, locale: string): HomeCta`
   qui traduit une destination `resolveRedirect` en intention d'UI :
   `{ kind: 'apply' } | { kind: 'enter'; href } | { kind: 'pending'; href }`.
   Aucune dépendance base ni React → testable en isolation, et c'est là que vit la
   seule logique de décision.
2. **`app/[locale]/(public)/_components/home-actions.tsx`** — présentation seule
   (Server Component, `useTranslations`). Props : `cta: HomeCta`, `signedIn: boolean`,
   `locale: string`. Rend le bouton principal, le lien de connexion (si `!signedIn`)
   et le bouton d'installation.
3. **`page.tsx`** — reste mince : résout la session (`getUser`), appelle
   `resolveRedirect` si session, dérive le `HomeCta`, passe le tout au composant.

## Conséquences assumées

- L'accueil devient **dynamique** : une vérification de session par lancement de la
  PWA. C'est un appel réseau que le proxy fait déjà sur cette route.
- **Hors ligne**, le service worker peut servir une version en cache de l'accueil avec
  le CTA de l'autre état. Rien de sensible ne fuite (le libellé d'un bouton), donc on
  accepte et on documente plutôt que d'exclure `/` du cache de navigation.

## Sécurité

- Aucune donnée nouvelle exposée : le CTA ne dit rien que le visiteur ne sache déjà de
  sa propre session.
- `resolveRedirect` est déjà la garde de routage post-login ; l'accueil ne fait que
  l'appeler, il n'invente aucune règle d'accès. Les pages de destination restent
  protégées par le proxy et les gardes de layout.

## Tests

- Unitaires sur `homeCta` : les cinq destinations possibles de `resolveRedirect`
  (`/community/`, `/comod`, `/admission/pending`, `/admission/refused`, `/admission`)
  plus le cas « pas de session ».
- Rendu de `HomeActions` : les trois états, la présence du lien de connexion hors
  session et son absence en session, et la classe de masquage du bouton d'installation.
- Non couvert : le rendu réel de `page.tsx` (Server Component asynchrone avec accès
  base) — vérifié à la main sur la stack locale, connecté et déconnecté.

## Hors scope

Redirection automatique, bouton de déconnexion sur l'accueil, porte unique
« e-mail d'abord » (incompatible avec l'anti-énumération AR31 — cf. discussion).
