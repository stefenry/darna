// Story 2.5 (AC2/AC3/AC6) — webhook de consentement artisan. Le form de la page
// /consent/[token] POSTe ici. Valide le token (re-HMAC), applique la décision via
// la RPC transactionnelle `process_artisan_consent` (SECURITY DEFINER), notifie
// le contributeur par e-mail, puis redirige (PRG) vers la page GET.
//
// Sécurité : `not_found` → 401 générique (AR38, ne révèle pas l'existence) ;
// idempotent (`already_used` → simple redirection, pas de double e-mail).

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashConsentToken } from '@/lib/consent/token';
import { sendTransactionalEmail } from '@/lib/email/send';
import { checkLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;
type ConsentRow = {
  status: string;
  artisan_id: string | null;
  slug: string | null;
  contributor_id: string | null;
  display_name_fr: string | null;
};

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = await checkLimit(`consent:${ip}`, 20, 600);
  if (!rl.success) return new NextResponse('Too Many Requests', { status: 429 });

  const form = await request.formData();
  const raw = String(form.get('token') ?? '');
  const decision = String(form.get('decision') ?? '');
  if (!raw || (decision !== 'accept' && decision !== 'refuse')) {
    return new NextResponse('Bad Request', { status: 400 });
  }

  const tokenHash = hashConsentToken(raw, env.server.CONSENT_TOKEN_SECRET);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('process_artisan_consent', {
    p_token_hash: tokenHash,
    p_decision: decision,
  });
  if (error) {
    log({
      level: 'error',
      event: 'consent.rpc_failed',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { errorCode: error.code ?? 'unknown' },
    });
    return new NextResponse('Server Error', { status: 500 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as ConsentRow | undefined;
  // AR38 : token inexistant/falsifié → 401 sans rien révéler.
  if (!row || row.status === 'not_found') {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  if (row.status === 'accepted' || row.status === 'refused') {
    await notifyContributor(admin, row).catch((cause) => {
      log({
        level: 'error',
        event: 'consent.email_failed',
        user_id: null,
        residence_id: null,
        request_id: null,
        payload: { reason: cause instanceof Error ? cause.name : 'unknown' },
      });
    });
  }

  // PRG : la page GET (re)montre l'état courant (idempotent pour expired/already_used).
  return NextResponse.redirect(`${env.client.NEXT_PUBLIC_SITE_URL}/consent/${raw}`, {
    status: 303,
  });
}

async function notifyContributor(admin: SupabaseAdmin, row: ConsentRow): Promise<void> {
  if (!row.contributor_id) return;
  const { data: authUser } = await admin.auth.admin.getUserById(row.contributor_id);
  const email = authUser?.user?.email;
  if (!email) return;

  const { data: profile } = await admin
    .from('profiles')
    .select('language')
    .eq('user_id', row.contributor_id)
    .maybeSingle();
  const locale = profile?.language === 'ar' ? 'ar' : 'fr';
  const artisanName = row.display_name_fr ?? '';

  if (row.status === 'accepted') {
    const ficheUrl = `${env.client.NEXT_PUBLIC_SITE_URL}/${locale}/community/artisan/${row.slug}`;
    await sendTransactionalEmail({
      template: 'artisan-consent-accepted',
      to: email,
      locale,
      vars: { artisanName, ficheUrl },
    });
  } else {
    await sendTransactionalEmail({
      template: 'artisan-consent-refused',
      to: email,
      locale,
      vars: { artisanName },
    });
  }
}
