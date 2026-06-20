import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { routing } from '@/lib/i18n/routing';
import { env } from '@/lib/env';
import { detectLocale } from '@/lib/i18n/detect-locale';
import { log } from '@/lib/logger';

const intlMiddleware = createIntlMiddleware(routing);

// Word-boundary + supported-locale anchor. Without it `/profilepublic`,
// `/community-news`, `/admin-help` would match, and `/zz/community` (unsupported
// locale) would slip through.
const COMMUNITY_PATTERN =
  /^\/(?:(?:fr|ar)\/)?(?:community|annuaire|artisan|alertes|guide|profil)(?:\/|$)/;
const COMOD_PATTERN = /^\/(?:(?:fr|ar)\/)?(?:comod|moderation|admin)(?:\/|$)/;

// Story 1.10a — constante anti-typo (deferred 1.4 #56). Une faute de frappe sur
// la valeur fermerait silencieusement l'accès co-mod.
const CO_MOD_ROLE = 'co_mod';

function isCommunityRoute(pathname: string) {
  return COMMUNITY_PATTERN.test(pathname);
}

function isComodRoute(pathname: string) {
  return COMOD_PATTERN.test(pathname);
}

function isProtectedRoute(pathname: string) {
  return isCommunityRoute(pathname) || isComodRoute(pathname);
}

// Copy cookies preserving their options (path, secure, httpOnly, sameSite,
// maxAge…). Passing a RequestCookie to .set() silently strips options, which
// would downgrade Supabase session cookies to session-only / non-secure.
function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    const { name, value, ...options } = cookie;
    to.cookies.set(name, value, options);
  }
}

// Supabase SSR recommended pattern (Next 16):
// always reconstruct `NextResponse.next({ request })` when cookies are written,
// so the freshly written cookies travel with the response — even when we end up
// returning a redirect or a 403.
async function refreshSupabaseSession(request: NextRequest): Promise<{
  user: User | null;
  response: NextResponse;
}> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.client.NEXT_PUBLIC_SUPABASE_URL,
    env.client.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  try {
    const { data } = await supabase.auth.getUser();
    return { user: data.user ?? null, response: supabaseResponse };
  } catch (cause) {
    log({
      level: 'error',
      event: 'auth.middleware_supabase_failure',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: {
        errorName: cause instanceof Error ? cause.name : 'unknown',
      },
    });
    return { user: null, response: supabaseResponse };
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Locale handling (next-intl) — may return a NextResponse.redirect.
  const intlResponse = intlMiddleware(request);

  // 2. Refresh Supabase session and pick up updated cookies on supabaseResponse.
  const { user, response: supabaseResponse } = await refreshSupabaseSession(request);

  // 3. Auth guards for protected routes.
  if (isProtectedRoute(pathname)) {
    if (!user) {
      const locale = detectLocale(request);
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${locale}/admission`;
      const redirectResponse = NextResponse.redirect(redirectUrl);
      copyCookies(supabaseResponse, redirectResponse);
      return redirectResponse;
    }

    if (isComodRoute(pathname) && user.app_metadata?.role !== CO_MOD_ROLE) {
      // NFR21 — 403 avec corps localisé (story 1.8). Le statut HTTP 403 est
      // conservé ; le message est minimal (une page React 403 riche reste
      // différée à 1.10). Une garde server-side requireComod() double cette
      // protection côté (comod)/layout.tsx.
      const locale = detectLocale(request);
      // Texte cohérent avec messages/{fr,ar}.json comod.forbidden.body.
      const message =
        locale === 'ar'
          ? 'الوصول محجوز لمشرفي الحي.'
          : 'Cet espace est réservé aux co-modérateurs de la résidence.';
      const forbidden = new NextResponse(message, {
        status: 403,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          vary: 'accept-language',
        },
      });
      copyCookies(supabaseResponse, forbidden);
      return forbidden;
    }
  }

  // 4. Merge intl + supabase responses so we keep both intl rewrites/redirects
  //    and Supabase refreshed cookies.
  copyCookies(supabaseResponse, intlResponse);
  return intlResponse;
}

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|fonts/|icons/|install/|og/|manifest.webmanifest|sw.js|robots.txt|sitemap.xml|api/|auth/|consent/|respond/|artisan/contact).*)',
      // Story 1.10a (deferred 1.4 #58) — skip les requêtes RSC/prefetch :
      // évite un appel Supabase getUser() à chaque fetch RSC client-side
      // (latence + risque de boucle redirect). Les soft-navigations restent
      // gardées par les layouts (requireComod / requireResident, défense en
      // profondeur) ; les chargements complets (sans header RSC) passent par
      // le proxy. Le refresh de session se fait aux chargements complets.
      missing: [
        { type: 'header', key: 'RSC' },
        { type: 'header', key: 'Next-Router-Prefetch' },
      ],
    },
  ],
};
