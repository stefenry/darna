# 0007 — Supabase Free tier au MVP + backup hebdomadaire vers R2

## Context

Supabase Free tier ne fournit pas de Point-in-Time Recovery (PITR) ; le tier Pro (PITR, RPO
≈5 min) coûte ~25 $/mois. Au MVP (≈50 villas en bêta, budget quasi-nul), le Pro n'est pas
justifié, mais un filet de sécurité de sauvegarde reste indispensable (audit CNDP, perte de
données).

## Decision

Rester sur **Supabase Free tier** au MVP, avec un **backup hebdomadaire applicatif** :

- Cron Vercel `app/api/cron/weekly-backup` (dimanche 03:00 UTC, Bearer `CRON_SECRET`) →
  invoque la Supabase Edge Function `weekly-backup`.
- L'Edge Function `pg_dump` → gzip → upload **Cloudflare R2** (`r2://darna-backups/postgres/YYYY-MM-DD.sql.gz`),
  **rétention 12 semaines** (rolling). Échec → alerte (Sentry + e-mail ops).
- **RPO 7 jours** au MVP.

**Migration vers Pro tier** (RPO ≈5 min) déclenchée par : ouverture publique > 50 résidents
actifs **OU** avant un audit CNDP formel.

## Consequences

- ✅ Filet de sécurité EU (R2) sans coût Supabase Pro ; rétention 3 mois.
- ⚠️ **Scaffold au MVP (D6)** : la route cron + l'Edge Function + le cron Vercel + les vars env
  R2 (optionnelles) sont en place ; l'**upload R2 réel** s'active quand le bucket + les secrets
  sont provisionnés (cf. `docs/runbook.md`). Vérification du 1er dump = obligatoire pré-bêta.
- ⚠️ RPO 7j = perte possible d'une semaine en cas de sinistre — acceptable bêta, à revoir au
  passage Pro.

## Status

Accepted — Gap #1. Scaffold story 1.10d ; activation R2 + migration Pro à planifier pré-bêta.
