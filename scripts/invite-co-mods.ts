/**
 * Ops CLI — invitation des co-modérateurs (story 1.10d, AR34). Idempotent.
 *
 *   pnpm invite:comods
 *
 * Script CANONIQUE d'onboarding co-mod en prod : pour chaque e-mail de
 * INITIAL_COMOD_EMAILS, envoie une invitation Supabase (`inviteUserByEmail`)
 * AVEC `app_metadata.role='co_mod'` + `residence_id` pré-assignés, et
 * synchronise `public.users.role='co_mod'` (cohérence DB ↔ JWT).
 *
 * Idempotent pour les users déjà confirmés (email_exists) : retrouve le user
 * par e-mail via listUsers et applique quand même role+app_metadata.
 *
 * Procédure (cf. docs/runbook.md §3) :
 *   1. définir INITIAL_COMOD_EMAILS dans l'env (CSV) ;
 *   2. `pnpm invite:comods` ;
 *   3. SUPPRIMER INITIAL_COMOD_EMAILS de l'env (jamais d'e-mail co-mod en clair).
 *
 * Variante dev/local sans envoi d'invitation : `scripts/grant-comod.ts`
 * (`pnpm grant:comod`, via generateLink). Même logique app_metadata.
 *
 * Script ops hors-runtime : lit process.env directement (hors boundary lib/env).
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types.generated';
import { applyComodRole } from './_apply-comod-role';

const RESIDENCE_ID_DARNA = '00000000-0000-0000-0000-000000000001';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[invite-co-mods] Variable d'environnement manquante : ${name}`);
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
    console.error('[invite-co-mods] INITIAL_COMOD_EMAILS ne contient aucun e-mail.');
    process.exit(1);
  }

  const admin = createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let invited = 0;
  for (const email of emails) {
    // Envoie l'invitation (crée l'auth.users si absent).
    const invite = await admin.auth.admin.inviteUserByEmail(email);
    let userId = invite.data?.user?.id;

    if (!userId) {
      // User already confirmed (email_exists) — still apply role idempotently.
      const isConfirmed =
        invite.error?.message.toLowerCase().includes('already registered') ||
        invite.error?.message.toLowerCase().includes('email_exists') ||
        invite.error?.status === 422;

      if (!isConfirmed) {
        console.error(
          `[invite-co-mods] inviteUserByEmail a échoué pour ${maskEmail(email)} : ${invite.error?.message ?? 'no user'}`,
        );
        continue;
      }

      // Retrouve le user confirmé pour appliquer son rôle (max 1000 users, acceptable pour une résidence MVP).
      const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = listData?.users.find((u) => u.email === email)?.id;
      if (!userId) {
        console.error(`[invite-co-mods] Utilisateur confirmé introuvable pour ${maskEmail(email)}`);
        continue;
      }
    }

    const ok = await applyComodRole(admin, userId, RESIDENCE_ID_DARNA, maskEmail(email));
    if (!ok) continue;

    invited += 1;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event: 'comod.invited', user_id: userId }));
  }

  // eslint-disable-next-line no-console
  console.log(`[invite-co-mods] Terminé : ${invited}/${emails.length} co-mod(s) invité(s).`);
  console.warn("[invite-co-mods] Rappel : supprime INITIAL_COMOD_EMAILS de l'env après usage.");

  if (invited === 0 && emails.length > 0) {
    console.error(
      '[invite-co-mods] Aucun co-mod invité avec succès — vérifier les erreurs ci-dessus.',
    );
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((cause) => {
    console.error('[invite-co-mods] Erreur fatale :', cause);
    process.exit(1);
  });
