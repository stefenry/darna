// Supabase Edge Function — weekly-backup (story 1.10d, AR29/NFR33).
//
// Déclenchée par le cron Vercel `app/api/cron/weekly-backup/route.ts`
// (admin.functions.invoke('weekly-backup')). Génère un dump SQL et l'uploade sur
// Cloudflare R2 (`r2://${bucket}/postgres/YYYY-MM-DD.sql.gz`, rétention 12 sem).
//
// ⚠️ SCAFFOLD (story 1.10d D6) : l'upload R2 réel est gardé derrière les secrets
// R2. Tant qu'ils sont absents (MVP), la fonction est un no-op explicite. Voir la
// checklist d'activation dans docs/runbook.md (« Backup hebdomadaire »).
//
// Fichier Deno — exclu de tsc / eslint (tsconfig + eslint.config.mjs).
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async (_req: Request): Promise<Response> => {
  const r2 = {
    accountId: Deno.env.get('R2_ACCOUNT_ID'),
    accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID'),
    secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY'),
    bucket: Deno.env.get('R2_BUCKET'),
  };

  if (!r2.accountId || !r2.accessKeyId || !r2.secretAccessKey || !r2.bucket) {
    console.warn('[weekly-backup] R2 non provisionné — no-op (scaffold MVP).');
    return Response.json({ ok: true, skipped: 'r2_not_configured' });
  }

  const date = new Date().toISOString().slice(0, 10);
  const key = `postgres/${date}.sql.gz`;

  // TODO (post-provisioning R2) :
  //   1. pg_dump via SUPABASE_DB_URL (connexion directe Postgres) → gzip.
  //   2. PUT S3-compatible signé vers https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}.
  //   3. Lister `postgres/` + supprimer les objets > 12 semaines (rétention rolling).
  console.log(`[weekly-backup] TODO upload ${key} → r2://${r2.bucket}`);

  return Response.json({ ok: true, key });
});
