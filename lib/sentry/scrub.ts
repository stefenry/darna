// Story 2.5 review P13 — Sentry scrubber pour les URLs contenant des tokens
// sensibles (`/consent/[raw]`, `/auth/confirm?token_hash=...`). Le raw token de
// consentement reste valide 24h–7j ; toute fuite Sentry = compromission.

const CONSENT_PATH = /\/consent\/[^/?#]+/g;
const TOKEN_HASH_QUERY = /([?&])(token_hash|token)=[^&#]+/g;

function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  return url
    .replace(CONSENT_PATH, '/consent/[REDACTED]')
    .replace(TOKEN_HASH_QUERY, '$1$2=[REDACTED]');
}

type SentryEvent = {
  request?: { url?: string };
  transaction?: string;
  breadcrumbs?: { data?: { url?: string }; message?: string }[];
};

export function scrubSentryEvent<T extends SentryEvent>(event: T): T {
  if (event.request?.url) {
    event.request.url = scrubUrl(event.request.url)!;
  }
  if (event.transaction) {
    event.transaction = scrubUrl(event.transaction)!;
  }
  if (Array.isArray(event.breadcrumbs)) {
    for (const bc of event.breadcrumbs) {
      if (bc.data?.url) bc.data.url = scrubUrl(bc.data.url)!;
      if (bc.message) bc.message = scrubUrl(bc.message)!;
    }
  }
  return event;
}
