# ADR 0002 — Vitest 4 (variance vs `architecture.md` qui prescrit Vitest 2)

- **Statut** : accepté
- **Date** : 2026-05-23 (implémenté), formalisé 2026-05-24
- **Décideur** : Stephane
- **Stories impactées** : 1.1

## Contexte

L'architecture (`architecture.md#Versions-vérifiées-recherche-web-mai-2026`) prescrit **Vitest 2**. À l'installation (mai 2026), `pnpm add -D vitest` a résolu **Vitest 4.1.7** (release récente). Vitest 4 apporte :

- nouvelle compaction du process pool (réduit la conso mémoire),
- support natif de Vite 7,
- breaking changes mineurs sur l'API `vi.stubEnv` et le format des snapshots (non utilisés ici).

Les 23 tests existants (`lib/env.test.ts`, `lib/logger.test.ts`, `lib/validation/*.test.ts`) tournent sans modification.

## Décision

**Adopter Vitest 4.1.7** comme version de référence du projet, plutôt que pinner Vitest 2.x.

## Conséquences

**Acceptées** :

- Configuration `vitest.config.ts` minimale (jsdom, globals, setupFiles) compatible v4 sans modification.
- `@vitejs/plugin-react@6` aligné sur le requirement Vite 7 de Vitest 4.
- `jsdom@29` (livré comme peer dep récente).

**Risques** :

- En cas de régression Vitest 4 → 4.x, pinner ou descendre majeure (le tooling est central, donc downgrade reste possible).
- Aucune dépendance sur des features Vitest 2-only repérée dans l'arborescence de tests prévue (`tests/setup.ts`, `lib/**/*.test.ts`, `e2e/**` Playwright).

## Alternatives écartées

- **Pinner Vitest 2.x** : la majeure étant déjà stable (mai 2026), s'aligner sur la dernière LTS pré-évite une migration future.
- **Pinner Vitest 3.x** : pas de version 3.x identifiée comme LTS prolongée, donc autant aller à 4.
