/**
 * Seed dev/local : crée un résident validé (auth.users + public.users + profiles),
 * met à jour son role + JWT app_metadata, et retourne un magic-link.
 *
 * Usage :
 *   pnpm tsx scripts/seed-resident.ts                       # défaut : test@darna.local, villa 1
 *   pnpm tsx scripts/seed-resident.ts <email> <villa>       # custom
 *
 * À usage strict dev local (Supabase Docker stack). Ne JAMAIS exécuter en prod.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types.generated';

const RESIDENCE_ID_DARNA = '00000000-0000-0000-0000-000000000001';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[seed-resident] Variable d'environnement manquante : ${name}`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const secret = requireEnv('SUPABASE_SECRET_KEY');
  const siteUrl = requireEnv('NEXT_PUBLIC_SITE_URL');

  const email = (process.argv[2] ?? 'test@darna.local').toLowerCase();
  const villa = Number(process.argv[3] ?? '1');
  if (!Number.isInteger(villa) || villa < 1 || villa > 150) {
    console.error('[seed-resident] villa doit être un entier 1..150');
    process.exit(1);
  }

  const admin = createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { params: { eventsPerSecond: 0 } },
    global: { fetch: globalThis.fetch },
  });

  // 1. Créer ou récupérer l'auth.users (idempotent via createUser email_confirm)
  console.log(`[seed-resident] création auth.users pour ${email}…`);
  let userId: string;
  const { data: existing, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    console.error('[seed-resident] listUsers échec :', listErr.message);
    process.exit(1);
  }
  const found = existing.users.find((u) => u.email?.toLowerCase() === email);
  if (found) {
    userId = found.id;
    console.log(`[seed-resident] user existe (${userId})`);
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { role: 'resident', residence_id: RESIDENCE_ID_DARNA },
    });
    if (createErr || !created.user) {
      console.error('[seed-resident] createUser échec :', createErr?.message);
      process.exit(1);
    }
    userId = created.user.id;
    console.log(`[seed-resident] auth.users créé (${userId})`);
  }

  // 2. Mettre à jour app_metadata (source de vérité JWT) — idempotent
  const { error: metaErr } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role: 'resident', residence_id: RESIDENCE_ID_DARNA },
  });
  if (metaErr) {
    console.error('[seed-resident] updateUserById app_metadata échec :', metaErr.message);
    process.exit(1);
  }

  // 3. Mettre à jour public.users.role (cohérence DB ↔ JWT) — la ligne est créée
  //    auto par le trigger handle_new_auth_user (role='demandeur' par défaut).
  const { error: roleErr } = await admin
    .from('users')
    .update({ role: 'resident' })
    .eq('id', userId);
  if (roleErr) {
    console.error('[seed-resident] update users.role échec :', roleErr.message);
    process.exit(1);
  }

  // 4. Upsert profiles (villa, langue par défaut, identity_mode pseudo).
  const { error: profileErr } = await admin.from('profiles').upsert({
    user_id: userId,
    residence_id: RESIDENCE_ID_DARNA,
    villa,
    language: 'fr',
    identity_mode: 'pseudo',
  });
  if (profileErr) {
    console.error('[seed-resident] upsert profile échec :', profileErr.message);
    process.exit(1);
  }

  // 4b. Insert admission_requests state='accepted' — `resolveRedirect` (callback
  //     /auth/confirm) route vers /fr/community uniquement si une admission
  //     acceptée existe pour l'user. Sans ça → /fr/admission (visiteur).
  //     Idempotent : delete d'abord les anciennes pour repartir clean.
  await admin.from('admission_requests').delete().eq('user_id', userId);
  const { error: admissionErr } = await admin.from('admission_requests').insert({
    user_id: userId,
    residence_id: RESIDENCE_ID_DARNA,
    villa,
    first_name: 'Test',
    contact_channel: 'email',
    state: 'accepted',
    decided_by: userId,
    decided_at: new Date().toISOString(),
  });
  if (admissionErr) {
    console.error('[seed-resident] insert admission_requests échec :', admissionErr.message);
    process.exit(1);
  }

  // 5. Générer un magic-link — flow PKCE compatible avec /auth/confirm de l'app.
  //    On utilise `hashed_token` (PKCE) qui passe par le callback Next, lequel
  //    pose les cookies session sur le bon domaine (vs. /auth/v1/verify direct
  //    qui pose les cookies sur le domaine Supabase et ne propage pas).
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${siteUrl}/fr/community` },
  });
  if (linkErr || !linkData) {
    console.error('[seed-resident] generateLink échec :', linkErr?.message);
    process.exit(1);
  }

  console.log('');
  console.log('✅ Résident seedé');
  console.log(`   email      : ${email}`);
  console.log(`   user_id    : ${userId}`);
  console.log(`   role       : resident`);
  console.log(`   villa      : ${villa}`);
  console.log(`   residence  : Darna (${RESIDENCE_ID_DARNA})`);
  console.log('');
  // Le flow utilisé par `/auth/confirm` (cf. app/auth/confirm/route.ts) attend
  // `token_hash` + `type=email` (PKCE-style) ; pas le `/auth/v1/verify` direct.
  // Cookies posés par le callback Next sur l'origin de l'app → session vivante.
  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) {
    console.error('[seed-resident] generateLink n’a pas renvoyé hashed_token');
    process.exit(1);
  }
  const appLink = `${siteUrl}/auth/confirm?token_hash=${tokenHash}&type=email&next=/fr/community`;

  console.log('🔗 Magic-link (clique pour te connecter) :');
  console.log(`   ${appLink}`);
}

main().catch((err) => {
  console.error('[seed-resident] erreur fatale :', err);
  process.exit(1);
});
