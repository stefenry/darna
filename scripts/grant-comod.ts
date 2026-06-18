/**
 * Ops CLI — bootstrap de l'identité co-mod (story 1.8 AC2). Idempotent.
 *
 *   pnpm grant:comod
 *
 * Pose, pour chaque e-mail de INITIAL_COMOD_EMAILS :
 *   1. l'existence de l'auth.users (via generateLink — crée si absent) ;
 *   2. app_metadata = { role: 'co_mod', residence_id } (source de vérité du JWT,
 *      lue par le proxy + les policies RLS) ;
 *   3. public.users.role = 'co_mod' (cohérence DB ↔ JWT).
 *
 * À exécuter UNE FOIS par environnement (local / preview / prod) AVANT de tester
 * la queue co-mod. Sans ce bootstrap, aucun co-mod ne passe le proxy ni les RLS
 * (gap D3 : rien ne synchronise public.users.role → app_metadata).
 *
 * Script ops hors-runtime : lit process.env directement (comme budget-alert.ts),
 * en dehors de la boundary lib/env.ts fail-fast.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types.generated';
import { applyComodRole } from './_apply-comod-role';

const RESIDENCE_ID_DARNA = '00000000-0000-0000-0000-000000000001';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[grant-comod] Variable d'environnement manquante : ${name}`);
    process.exit(1);
  }
  return value;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local?.[0] ?? ''}***@${domain ?? ''}`;
}

async function main(): Promise<void> {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const secret = requireEnv('SUPABASE_SECRET_KEY');
  const emails = requireEnv('INITIAL_COMOD_EMAILS')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (emails.length === 0) {
    console.error('[grant-comod] INITIAL_COMOD_EMAILS ne contient aucun e-mail.');
    process.exit(1);
  }

  const admin = createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let granted = 0;
  for (const email of emails) {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const userId = link.data?.user?.id;
    if (link.error || !userId) {
      console.error(
        `[grant-comod] generateLink a échoué pour ${maskEmail(email)} : ${link.error?.message ?? 'no user'}`,
      );
      continue;
    }

    const ok = await applyComodRole(admin, userId, RESIDENCE_ID_DARNA, maskEmail(email));
    if (!ok) continue;

    granted += 1;
    // Log sans PII (user_id UUID uniquement).
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event: 'comod.granted', user_id: userId }));
  }

  // eslint-disable-next-line no-console
  console.log(`[grant-comod] Terminé : ${granted}/${emails.length} co-mod(s) provisionné(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((cause) => {
    console.error('[grant-comod] Erreur fatale :', cause);
    process.exit(1);
  });
