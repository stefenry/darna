# ADR 0003 — Bundle d'implémentation : story 1.1 et 1.2 livrées ensemble

- **Statut** : accepté (rétroactivement)
- **Date** : 2026-05-23 (implémenté), formalisé 2026-05-24
- **Décideur** : Stephane
- **Stories impactées** : 1.1, 1.2

## Contexte

Story 1.1 (« Initialisation projet & toolchain ») et Story 1.2 (« Pipeline CI/CD, observabilité GlitchTip & budget alerting ») devaient être livrées séparément selon les epics. Story 1.2 dépend de 1.1 mais pas l'inverse — donc isoler 1.2 dans une story dédiée était un choix de phasage, pas une contrainte technique.

À l'implémentation, le dev a livré les deux stories dans la même passe :

- Tous les fichiers de 1.2 (`instrumentation.ts`, `sentry.{client,server,edge}.config.ts`, `lib/logger.ts`, `lib/logger.test.ts`, `.github/workflows/{ci,release,mirror,budget-alert}.yml`, `.lighthouserc.json`, `scripts/budget-alert.ts`, `vercel.json`, dépendance `@sentry/nextjs@^10.53.1`) sont présents au working tree.
- `next.config.ts` a été enveloppé dans `withSentryConfig` (déviation par rapport à AC6 de 1.1 qui prescrivait un placeholder vide).
- `.env.example` contient les variables `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` (non listées dans AC4 original de 1.1).
- La review de 1.1 (2026-05-24) a découvert ce bundle et tranché : **accepter** plutôt que rollback.

## Décision

**Accepter le bundle 1.1 + 1.2 comme implémentation effective**. Mettre à jour :

1. **Spec 1.1** (`1-1-initialisation-projet-toolchain-de-developpement.md`) — élargir AC1/AC4/AC6 pour couvrir le scope effectif, retirer 1.2 de la table § Out-of-scope, rectifier les Completion Notes.
2. **Spec 1.2** (`1-2-pipeline-ci-cd-observabilite-glitchtip-budget-alerting.md`) — laisser `Status: review` (le code est livré, restera à valider sous code-review séparée si désiré).
3. **`sprint-status.yaml`** — passer story 1.2 de `ready-for-dev` à `review`.

## Conséquences

**Acceptées** :

- Moins de cycles de checkout/install : l'observabilité est dispo dès J1 pour débugger les stories suivantes.
- Le `lib/logger.ts` est utilisable immédiatement par toutes les Server Actions / Route Handlers que les stories 1.3+ produiront.
- Le pipeline CI/CD tourne dès le premier push GitHub.

**Risques** :

- Le test/lint/typecheck couvre l'ensemble du bundle ; un bug propre à 1.2 sera attribué à la mauvaise story dans le rétro.
- Sprint planning devient asymétrique : 1.1 a livré ~2× le scope estimé. À noter pour calibrer la vélocité solo-dev.
- Story 1.2 est marquée `review` sans avoir traversé sa propre passe `bmad-code-review` (les findings de la review 1.1 portent partiellement sur du code 1.2).

**Engagements** :

- Une code-review dédiée à 1.2 sera lancée si Stephane juge nécessaire avant de passer au merge.
- Les ADRs 0001 (Tailwind 3.4) et 0002 (Vitest 4) accompagnent ce bundle.

## Alternatives écartées

- **Rollback 1.2 hors 1.1** : 10 fichiers à supprimer + dépendance à retirer + risque de casser ce qui marche. ROI négatif vu que tout fonctionne.
- **Marquer 1.2 `done` directement** : prématuré, le code 1.2 n'a pas eu sa propre review d'acceptance contre ses 9 ACs.
