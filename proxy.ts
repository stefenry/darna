import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/lib/i18n/routing';
import { env } from '@/lib/env';
import { detectLocale } from '@/lib/i18n/detect-locale';
import { needsProactiveRefresh, readSessionCookie } from '@/lib/auth/session-cookie';
import { log } from '@/lib/logger';

const intlMiddleware = createIntlMiddleware(routing);

// Marge de rafraîchissement anticipé. L'access token vit 1 h (`jwt_expiry`) ;
// dès qu'il lui reste moins que cette marge, on le renouvelle ICI. C'est le
// cœur du fix de persistance : le proxy est le seul endroit de l'app où un
// token pivoté est réellement persisté (`cookies().set()` throw dans un Server
// Component, cf. le catch de lib/supabase/server.ts). La marge est plus large
// que celle d'auth-js (90 s) pour qu'un rendu RSC déclenché juste après le
// proxy ne tombe jamais lui-même sur une session à rafraîchir.
const SESSION_REFRESH_MARGIN_SECONDS = 5 * 60;

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

// Identité minimale nécessaire aux gardes du proxy. Volontairement pas un
// `User` complet : selon le chemin emprunté on dispose soit du user renvoyé par
// getUser(), soit des claims du JWT vérifié localement.
type SessionIdentity = { userId: string; role: string | null };

/**
 * Résout la session pour cette requête et renvoie la réponse porteuse des
 * cookies éventuellement rafraîchis.
 *
 * Trois chemins, du moins cher au plus cher :
 *
 * 1. Aucun cookie de session → visiteur anonyme, zéro appel réseau (avant, on
 *    payait un getUser() même déconnecté).
 * 2. Access token encore valide → `getClaims()` vérifie la signature ES256
 *    localement (JWKS mis en cache au niveau du module par auth-js) : zéro
 *    appel réseau lui aussi.
 * 3. Access token expiré ou proche de l'expiration → `getUser()`, qui
 *    déclenche le refresh et la rotation ; le Set-Cookie part avec la réponse.
 *
 * Le point 3 est ce qui manquait : les requêtes RSC/prefetch étaient exclues du
 * matcher, donc le premier à constater l'expiration était un Server Component,
 * dont le token pivoté est irrécupérable → session révoquée au bout du
 * `refresh_token_reuse_interval` et reconnexion quotidienne (PWA iOS en tête).
 *
 * Compromis assumé sur le point 2 : entre deux refresh (≤ 1 h), le proxy fait
 * confiance à un JWT valide et non expiré, sans rejouer la révocation
 * côté serveur. Les gardes autoritaires restent `requireResident` /
 * `requireComod` (getUser() réseau dans les layouts) et la RLS.
 */
async function resolveSession(request: NextRequest): Promise<{
  identity: SessionIdentity | null;
  response: NextResponse;
}> {
  let supabaseResponse = NextResponse.next({ request });

  const sessionState = readSessionCookie(request.cookies.getAll());
  if (sessionState.kind === 'absent') {
    return { identity: null, response: supabaseResponse };
  }

  const supabase = createServerClient(
    env.client.NEXT_PUBLIC_SUPABASE_URL,
    env.client.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // Supabase SSR recommended pattern (Next 16): always reconstruct
        // `NextResponse.next({ request })` when cookies are written, so the
        // freshly written cookies travel with the response — even when we end
        // up returning a redirect or a 403.
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

  const mustRefresh = needsProactiveRefresh(
    sessionState,
    Math.floor(Date.now() / 1000),
    SESSION_REFRESH_MARGIN_SECONDS,
  );

  try {
    if (mustRefresh) {
      const { data, error } = await supabase.auth.getUser();
      const user = data.user ?? null;

      if (!user) {
        // Observabilité : cookie de session présent mais refresh refusé
        // (refresh token déjà consommé / révoqué). C'est LE symptôme des
        // reconnexions quotidiennes ; sans ce log il est invisible côté serveur
        // (l'utilisateur est juste redirigé vers /admission).
        log({
          level: 'warn',
          event: 'auth.session_rejected',
          user_id: null,
          residence_id: null,
          request_id: null,
          payload: {
            phase: 'refresh',
            errorCode: error?.code ?? 'unknown',
            errorName: error?.name ?? 'unknown',
            errorStatus: error?.status ?? null,
          },
        });
        return { identity: null, response: supabaseResponse };
      }

      log({
        level: 'info',
        event: 'auth.session_refreshed_by_proxy',
        user_id: user.id,
        residence_id: null,
        request_id: null,
        payload: {
          reason: sessionState.kind === 'unreadable' ? 'unreadable_cookie' : 'near_expiry',
        },
      });

      return {
        identity: { userId: user.id, role: user.app_metadata?.role ?? null },
        response: supabaseResponse,
      };
    }

    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims ?? null;

    if (!claims) {
      log({
        level: 'warn',
        event: 'auth.session_rejected',
        user_id: null,
        residence_id: null,
        request_id: null,
        payload: {
          phase: 'verify',
          errorCode: error?.code ?? 'unknown',
          errorName: error?.name ?? 'unknown',
          errorStatus: error?.status ?? null,
        },
      });
      return { identity: null, response: supabaseResponse };
    }

    const role = claims.app_metadata?.role;
    return {
      identity: { userId: claims.sub, role: typeof role === 'string' ? role : null },
      response: supabaseResponse,
    };
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
    return { identity: null, response: supabaseResponse };
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Locale handling (next-intl) — may return a NextResponse.redirect.
  const intlResponse = intlMiddleware(request);

  // 2. Resolve/refresh the Supabase session; supabaseResponse carries any
  //    rotated cookie.
  const { identity, response: supabaseResponse } = await resolveSession(request);

  // 3. Auth guards for protected routes.
  if (isProtectedRoute(pathname)) {
    if (!identity) {
      const locale = detectLocale(request);
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${locale}/admission`;
      const redirectResponse = NextResponse.redirect(redirectUrl);
      copyCookies(supabaseResponse, redirectResponse);
      return redirectResponse;
    }

    if (isComodRoute(pathname) && identity.role !== CO_MOD_ROLE) {
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
        '/((?!_next/static|_next/image|favicon.ico|fonts/|icons/|install/|og/|manifest.webmanifest|sw.js|swe-worker-|robots.txt|sitemap.xml|api/|auth/|consent/|respond/|artisan/contact).*)',
      // `swe-worker-<hash>.js` (régression prod 2026-08-05) : @serwist/next
      // génère ce Web Worker dans `public/` pour `cacheOnNavigation`, ET
      // l'inscrit dans le manifeste de précache du Service Worker. Sans cette
      // exclusion, `localePrefix: 'always'` le redirigeait en 307 vers
      // `/fr/swe-worker-<hash>.js` → 404 → le `cache.addAll()` de l'`install`
      // échouait → le SW ne s'activait JAMAIS → l'app ne fonctionnait pas du
      // tout hors-ligne. Exclusion par PRÉFIXE : le hash dépend de la version
      // de Serwist. Verrouillé par tests/offline/proxy-sw-assets.test.ts.
      // Les requêtes RSC/prefetch NE SONT PLUS exclues du matcher (elles
      // l'étaient depuis la story 1.10a / deferred 1.4 #58). Les exclure
      // laissait le refresh de session se produire à l'intérieur d'un Server
      // Component, où le token pivoté est perdu → session morte et reconnexion
      // quotidienne.
      //
      // NB : on ne peut PAS distinguer une requête RSC ici — Next supprime les
      // FLIGHT_HEADERS (RSC, Next-Router-Prefetch…) avant d'appeler le proxy
      // (cf. next/dist/server/web/adapter.js, « Headers should only be stripped
      // for middleware »). L'objectif latence de 1.10a est donc tenu autrement :
      // resolveSession ne fait aucun appel réseau tant que l'access token est
      // valide (vérification ES256 locale), et un seul par heure et par
      // utilisateur au moment du refresh.
    },
  ],
};
