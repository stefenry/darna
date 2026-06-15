import * as Sentry from '@sentry/nextjs';

type LogLevel = 'info' | 'warn' | 'error';

type LogEntry = {
  ts: string;
  level: LogLevel;
  event: string;
  user_id: string | null;
  residence_id: string | null;
  request_id: string | null;
  payload?: Record<string, unknown>;
};

// PII keys jamais loguées (AR26, NFR16). Liste extensive — le filtrage est
// défensif : si un caller tente `payload: { email: ... }`, la clé est strippée
// silencieusement plutôt que d'envoyer la PII à GlitchTip / stdout.
const PII_KEYS = new Set([
  'email',
  'phone',
  'phone_e164',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'magic_link',
  'first_name',
  'last_name',
  'full_name',
]);

function stripPIIDeep(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return '[circular]';
  seen.add(value as object);
  if (Array.isArray(value)) {
    return value.map((item) => stripPIIDeep(item, seen));
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEYS.has(key)) continue;
    out[key] = stripPIIDeep(child, seen);
  }
  return out;
}

function stripPII(
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!payload) return undefined;
  return stripPIIDeep(payload, new WeakSet()) as Record<string, unknown>;
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, val) => {
    if (val !== null && typeof val === 'object') {
      if (seen.has(val as object)) return '[circular]';
      seen.add(val as object);
    }
    return val;
  });
}

export function log(entry: Omit<LogEntry, 'ts'>): void {
  const safePayload = stripPII(entry.payload);
  const output: LogEntry = {
    ts: new Date().toISOString(),
    ...entry,
    payload: safePayload,
  };

  if (entry.level === 'error') {
    Sentry.captureMessage(entry.event, {
      level: 'error',
      extra: { ...safePayload, request_id: entry.request_id },
    });
  }

  // eslint-disable-next-line no-console
  console.log(safeStringify(output));
}
