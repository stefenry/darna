# 0001 — Recherche : Postgres FTS (pas d'Algolia/Meilisearch)

## Context

L'annuaire d'artisans (epic 2) et le guide résident (epic 3) nécessitent une recherche
plein-texte bilingue (FR/AR). Les options : un service externe (Algolia, Meilisearch) ou la
recherche native Postgres (`tsvector`/`tsquery` + `pg_trgm`). Contraintes du projet : budget
quasi-nul (free tiers), hébergement EU exclusif (CNDP/RGPD), zéro service hors-UE, volume
modeste (≈150 villas, quelques centaines d'artisans).

## Decision

Utiliser **Postgres Full-Text Search** (`tsvector` généré + index GIN, complété par `pg_trgm`
pour le fuzzy/typo) directement dans Supabase. Pas de service de recherche externe au MVP.
La configuration FTS gère le français ; l'arabe est indexé en `simple` + `pg_trgm` (la config
`arabic` n'existe pas en standard Postgres).

## Consequences

- ✅ Zéro coût additionnel, zéro sous-traitant hors-UE, une seule source de vérité (la DB).
- ✅ Recherche transactionnellement cohérente (pas de pipeline d'indexation à synchroniser).
- ⚠️ Pas de ranking/typo-tolérance aussi riche qu'Algolia ; suffisant à l'échelle MVP.
- ⚠️ Le tuning FTS bilingue (surtout AR) demande de l'attention — réévaluer si le volume
  explose (V3 multi-résidence) ou si l'arabe devient prioritaire (V1.5).

## Status

Accepted — décision step-04. Implémentation epic 2.1 (schéma artisans + FTS).
