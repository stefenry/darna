// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const getUserMock = vi.fn();
const getClaimsMock = vi.fn();
const logMock = vi.fn();
// Cookies que le client Supabase mocké écrit quand il « rafraîchit » la session.
let cookiesWrittenByRefresh: { name: string; value: string; options: Record<string, unknown> }[] =
  [];

vi.mock('next-intl/middleware', () => ({
  default: () => (request: NextRequest) => NextResponse.next({ request }),
}));

vi.mock('@/lib/env', () => ({
  env: {
    client: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://abcdef.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      NEXT_PUBLIC_SITE_URL: 'https://darna.test',
    },
  },
}));

vi.mock('@/lib/logger', () => ({ log: (entry: unknown) => logMock(entry) }));

vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: (c: typeof cookiesWrittenByRefresh) => void } },
  ) => ({
    auth: {
      getUser: async () => {
        // Le vrai client écrit les cookies pivotés via setAll pendant le refresh.
        if (cookiesWrittenByRefresh.length > 0) options.cookies.setAll(cookiesWrittenByRefresh);
        return getUserMock();
      },
      getClaims: async () => getClaimsMock(),
    },
  }),
}));

import { proxy } from '@/proxy';

const NOW_SECONDS = Math.floor(Date.now() / 1000);
const FRESH = NOW_SECONDS + 3000;
const NEAR_EXPIRY = NOW_SECONDS + 60;

function sessionCookieValue(expiresAt: number): string {
  const raw = JSON.stringify({ expires_at: expiresAt, access_token: 'jwt', refresh_token: 'rt' });
  return `base64-${Buffer.from(raw, 'utf8').toString('base64url')}`;
}

function makeRequest(path: string, sessionExpiresAt?: number): NextRequest {
  const headers = new Headers();
  if (sessionExpiresAt !== undefined) {
    headers.set('cookie', `sb-abcdef-auth-token=${sessionCookieValue(sessionExpiresAt)}`);
  }
  return new NextRequest(`https://darna.test${path}`, { headers });
}

function claims(role: string | null) {
  return {
    data: { claims: { sub: 'u1', app_metadata: role ? { role } : {} } },
    error: null,
  };
}

describe('proxy — persistance de session', () => {
  beforeEach(() => {
    getUserMock.mockReset();
    getClaimsMock.mockReset();
    logMock.mockReset();
    cookiesWrittenByRefresh = [];
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    getClaimsMock.mockResolvedValue({ data: null, error: null });
  });
  afterEach(() => vi.restoreAllMocks());

  describe('coût réseau', () => {
    it('ne touche pas Supabase pour un visiteur anonyme', async () => {
      await proxy(makeRequest('/fr'));
      expect(getUserMock).not.toHaveBeenCalled();
      expect(getClaimsMock).not.toHaveBeenCalled();
    });

    it('vérifie les claims localement (pas de getUser) quand le token est frais', async () => {
      getClaimsMock.mockResolvedValue(claims('resident'));

      const response = await proxy(makeRequest('/fr/community', FRESH));

      expect(getClaimsMock).toHaveBeenCalledTimes(1);
      expect(getUserMock).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe('refresh anticipé', () => {
    it('rafraîchit et renvoie le cookie pivoté au navigateur', async () => {
      getUserMock.mockResolvedValue({
        data: { user: { id: 'u1', app_metadata: { role: 'resident' } } },
        error: null,
      });
      cookiesWrittenByRefresh = [
        {
          name: 'sb-abcdef-auth-token',
          value: sessionCookieValue(NOW_SECONDS + 3600),
          options: { path: '/', maxAge: 34560000 },
        },
      ];

      const response = await proxy(makeRequest('/fr/community', NEAR_EXPIRY));

      expect(getUserMock).toHaveBeenCalledTimes(1);
      // Le Set-Cookie voyage bien vers le navigateur : c'est tout l'objet du fix.
      expect(response.cookies.get('sb-abcdef-auth-token')?.value).toBe(
        sessionCookieValue(NOW_SECONDS + 3600),
      );
      expect(logMock).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth.session_refreshed_by_proxy',
          payload: expect.objectContaining({ reason: 'near_expiry' }),
        }),
      );
    });

    it('rafraîchit aussi un token déjà expiré', async () => {
      await proxy(makeRequest('/fr/community', NOW_SECONDS - 10));
      expect(getUserMock).toHaveBeenCalledTimes(1);
      expect(getClaimsMock).not.toHaveBeenCalled();
    });

    it('rafraîchit quand le cookie est illisible plutôt que de supposer la session valide', async () => {
      const request = new NextRequest('https://darna.test/fr/community', {
        headers: new Headers({ cookie: 'sb-abcdef-auth-token=base64-not-a-session' }),
      });

      await proxy(request);

      expect(getUserMock).toHaveBeenCalledTimes(1);
      expect(logMock).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth.session_rejected',
          payload: expect.objectContaining({ phase: 'refresh' }),
        }),
      );
    });
  });

  describe('gardes (inchangées)', () => {
    it('redirige vers /admission sans session', async () => {
      const response = await proxy(makeRequest('/fr/community'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/fr/admission');
    });

    it('redirige vers /admission quand la session est rejetée', async () => {
      getUserMock.mockResolvedValue({
        data: { user: null },
        error: { code: 'refresh_token_already_used', status: 400 },
      });

      const response = await proxy(makeRequest('/fr/community', NOW_SECONDS - 10));

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/fr/admission');
    });

    it('renvoie 403 sur /comod pour un résident', async () => {
      getClaimsMock.mockResolvedValue(claims('resident'));
      const response = await proxy(makeRequest('/fr/comod', FRESH));
      expect(response.status).toBe(403);
    });

    it('laisse passer un co_mod sur /comod', async () => {
      getClaimsMock.mockResolvedValue(claims('co_mod'));
      const response = await proxy(makeRequest('/fr/comod', FRESH));
      expect(response.status).toBe(200);
    });

    it('laisse passer les routes publiques sans session valide', async () => {
      const response = await proxy(makeRequest('/fr'));
      expect(response.status).toBe(200);
    });
  });

  describe('observabilité', () => {
    it('logue auth.session_rejected quand un refresh est refusé', async () => {
      getUserMock.mockResolvedValue({
        data: { user: null },
        error: { code: 'refresh_token_already_used', status: 400 },
      });

      await proxy(makeRequest('/fr/community', NOW_SECONDS - 10));

      expect(logMock).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          event: 'auth.session_rejected',
          payload: expect.objectContaining({
            phase: 'refresh',
            errorCode: 'refresh_token_already_used',
          }),
        }),
      );
    });

    it('logue auth.session_rejected quand le JWT ne se vérifie pas', async () => {
      getClaimsMock.mockResolvedValue({ data: null, error: { code: 'bad_jwt', status: 401 } });

      await proxy(makeRequest('/fr/community', FRESH));

      expect(logMock).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth.session_rejected',
          payload: expect.objectContaining({ phase: 'verify', errorCode: 'bad_jwt' }),
        }),
      );
    });

    it('ne logue rien pour un visiteur anonyme', async () => {
      await proxy(makeRequest('/fr/community'));
      expect(logMock).not.toHaveBeenCalledWith(
        expect.objectContaining({ event: 'auth.session_rejected' }),
      );
    });

    it('logue une panne Supabase (throw) sans casser la requête', async () => {
      getClaimsMock.mockRejectedValue(new TypeError('fetch failed'));

      const response = await proxy(makeRequest('/fr', FRESH));

      expect(response.status).toBe(200);
      expect(logMock).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'auth.middleware_supabase_failure' }),
      );
    });
  });
});
