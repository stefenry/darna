import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';
import { log } from '@/lib/logger';

// Story 1.10b (AR31) — Rate-limiting Upstash (sliding window, EU Frankfurt).
// Boundary unique : tout endpoint sensible passe par `checkLimit`. **Fail-open**
// obligatoire : un Upstash injoignable ne doit JAMAIS bloquer l'auth/admission
// (un blip Redis ne ferme pas la porte aux utilisateurs légitimes).

let redisSingleton: Redis | null = null;
function getRedis(): Redis {
  if (!redisSingleton) {
    redisSingleton = new Redis({
      url: env.server.UPSTASH_REDIS_REST_URL,
      token: env.server.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisSingleton;
}

// Une instance Ratelimit par couple (limit, fenêtre) — réutilisée entre appels.
const limiters = new Map<string, Ratelimit>();
function getLimiter(limit: number, windowSeconds: number): Ratelimit {
  const cacheKey = `${limit}:${windowSeconds}`;
  let rl = limiters.get(cacheKey);
  if (!rl) {
    rl = new Ratelimit({
      redis: getRedis(),
      // Fenêtre en secondes → convertie en format canonique Upstash.
      // On préfère la forme humaine lisible quand possible, mais la librairie
      // accepte aussi la notation '<n> s' pour les durées non-arrondies.
      limiter: Ratelimit.slidingWindow(
        limit,
        windowSeconds >= 86400
          ? `${Math.round(windowSeconds / 86400)} d`
          : windowSeconds >= 3600
            ? `${Math.round(windowSeconds / 3600)} h`
            : windowSeconds >= 60
              ? `${Math.round(windowSeconds / 60)} m`
              : `${windowSeconds} s`,
      ),
      prefix: 'darna:rl',
      analytics: false,
    });
    limiters.set(cacheKey, rl);
  }
  return rl;
}

export type LimitResult = { success: boolean; reset: number };

/**
 * Consomme un jeton pour `key`. Retourne `{ success:false }` si la limite est
 * dépassée. Fail-open (`success:true`) si Upstash est injoignable.
 */
// Timeout fail-open : si Upstash stalle (TCP half-open, pas de rejection),
// on abandonne après 2s plutôt que de bloquer l'action pour toute la durée
// du timeout Vercel (~30s). Cohérent avec la politique fail-open AR31.
const UPSTASH_TIMEOUT_MS = 2000;

export async function checkLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<LimitResult> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('upstash_timeout')), UPSTASH_TIMEOUT_MS),
    );
    const { success, reset } = await Promise.race([
      getLimiter(limit, windowSeconds).limit(key),
      timeoutPromise,
    ]);
    return { success, reset };
  } catch (cause) {
    log({
      level: 'error',
      event: 'rate_limit.degraded',
      user_id: null,
      residence_id: null,
      request_id: null,
      payload: {
        errorName: cause instanceof Error ? cause.name : 'unknown',
        errorMessage: cause instanceof Error ? cause.message : String(cause),
      },
    });
    return { success: true, reset: 0 };
  }
}

/**
 * Réponse 429 + `Retry-After` pour les Route Handlers (webhooks/cron). `reset`
 * est un timestamp epoch-ms (Upstash) ; on en dérive les secondes restantes.
 */
export function tooManyRequests(reset: number): Response {
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return Response.json(
    { error: { code: 'rate_limited', message_key: 'errors.rate_limit.exceeded' } },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}
