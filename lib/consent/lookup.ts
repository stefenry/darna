// Story 2.5 — lecture/validation d'un token de consentement (pour la PAGE, GET).
// L'écriture (accept/refuse) passe par la RPC `process_artisan_consent` (webhook).
// `artisan_consent_tokens` est deny-all client → lecture via client ADMIN.
//
// Sécurité (AR38) : token introuvable OU hash incohérent → MÊME statut `invalid`
// (ne jamais révéler l'existence). Re-hash via le secret HMAC (2.4).

import { createAdminClient } from '@/lib/supabase/admin';
import { hashConsentToken } from './token';
import { env } from '@/lib/env';
import type { Locale } from '@/lib/i18n/config';
import type { Database } from '@/lib/supabase/types.generated';

type ArtisanState = Database['public']['Enums']['artisan_state'];
type EmbeddedTag = { key: string; label_fr: string; label_ar: string | null };

export type ConsentLookup =
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'used'; slug: string; displayName: string; state: ArtisanState }
  | { status: 'valid'; displayName: string; tags: string[] };

function pickLocale(locale: Locale, fr: string, ar: string | null): string {
  return locale === 'ar' && ar?.trim() ? ar : fr;
}

export async function resolveConsentToken(raw: string, locale: Locale): Promise<ConsentLookup> {
  if (!raw || raw.length < 16) return { status: 'invalid' };

  const tokenHash = hashConsentToken(raw, env.server.CONSENT_TOKEN_SECRET);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('artisan_consent_tokens')
    .select(
      'expires_at, used_at, artisans ( slug, display_name_fr, display_name_ar, state, artisan_tags ( tags ( key, label_fr, label_ar ) ) )',
    )
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data || !data.artisans) return { status: 'invalid' };

  const artisan = data.artisans as unknown as {
    slug: string;
    display_name_fr: string;
    display_name_ar: string | null;
    state: ArtisanState;
    artisan_tags: { tags: EmbeddedTag | null }[] | null;
  };
  const displayName = pickLocale(locale, artisan.display_name_fr, artisan.display_name_ar);

  if (data.used_at) {
    return { status: 'used', slug: artisan.slug, displayName, state: artisan.state };
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { status: 'expired' };
  }

  const tags = (artisan.artisan_tags ?? [])
    .map((at) => at.tags)
    .filter((tag): tag is EmbeddedTag => !!tag)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((tag) => pickLocale(locale, tag.label_fr, tag.label_ar));

  return { status: 'valid', displayName, tags };
}
