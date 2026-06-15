import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectLocale } from '@/lib/i18n/detect-locale';
import { log } from '@/lib/logger';

type SignOutScope = 'local' | 'global';

function parseScope(value: string | null): SignOutScope {
  return value === 'global' ? 'global' : 'local';
}

// Same-origin check for CSRF defence: an attacker page cannot force-logout the
// user just by submitting a cross-origin form, even though SameSite=Lax cookies
// would technically tag along.
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    // Some browsers omit Origin on same-origin POSTs; fall back to Referer.
    const referer = request.headers.get('referer');
    if (!referer) return false;
    try {
      return new URL(referer).origin === new URL(request.url).origin;
    } catch {
      return false;
    }
  }
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scope = parseScope(searchParams.get('scope'));
  const locale = detectLocale(request);

  if (!isSameOrigin(request)) {
    log({
      level: 'warn',
      event: 'auth.signout_rejected_csrf',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: { scope },
    });
    return new NextResponse('Forbidden', { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.auth.signOut({ scope });

  log({
    level: 'info',
    event: 'auth.signout',
    user_id: user?.id ?? null,
    residence_id: null,
    request_id: null,
    payload: { scope },
  });

  const home = new URL(`/${locale}/`, request.url);
  const response = NextResponse.redirect(home, 303);
  // Belt-and-braces: signOut already clears cookies via @supabase/ssr setAll,
  // but on this redirect response we expire them explicitly so no stale cookie
  // can survive the transient redirect.
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', { maxAge: 0, path: '/' });
    }
  }
  return response;
}

export async function GET() {
  return new NextResponse('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
}

export async function PUT() {
  return new NextResponse('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
}

export async function DELETE() {
  return new NextResponse('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
}
