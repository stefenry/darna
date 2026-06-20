// Story 2.5 — lecture/validation d'un token de consentement (pour la PAGE, GET).
// L'écriture (accept/refuse) passe par la RPC `process_artisan_consent` (webhook).
// `artisan_consent_tokens` est deny-all client → lecture via client ADMIN.
//
// Sécurité (AR38) : token introuvable OU hash incohérent → MÊME statut `invalid`
// (ne jamais révéler l'existence). Re-hash via le secret HMAC (2.4).
//
// Hardening review 2026-06-19 :
//   P3  filter `artisans.deleted_at IS NULL` côté embed.
//   P9  récupération `profiles.identity_mode` du contributeur (pseudo/named).
//   P16 borne max-length `raw` (DoS HMAC sur input démesuré).

import { createAdminClient } from '@/lib/supabase/admin';
import { hashConsentToken } from './token';
import { env } from '@/lib/env';
import type { Locale } from '@/lib/i18n/config';
import type { Database } from '@/lib/supabase/types.generated';

type ArtisanState = Database['public']['Enums']['artisan_state'];
type IdentityMode = 'pseudo' | 'identified';
type EmbeddedTag = { key: string; label_fr: string; label_ar: string | null };

/** Story 2.7 — diff PII proposée par le contributeur (re-consent sur fiche published). */
export type ReconsentDiff = {
  name: { from: string; to: string } | null;
  phoneChanged: boolean;
};

export type ConsentLookup =
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'used'; slug: string; displayName: string; state: ArtisanState }
  | {
      status: 'valid';
      displayName: string;
      tags: string[];
      contributorIdentityMode: IdentityMode;
      reconsent: ReconsentDiff | null;
    };

const RAW_MIN = 16;
const RAW_MAX = 200;
const PHONE_NORMALIZE = /[\s.\-()]+/g;

function pickLocale(locale: Locale, fr: string, ar: string | null): string {
  return locale === 'ar' && ar?.trim() ? ar : fr;
}

export async function resolveConsentToken(raw: string, locale: Locale): Promise<ConsentLookup> {
  // Bornes d'entropie : raw < 16 invalide ; raw > 200 = abuseur (DoS HMAC).
  if (!raw || raw.length < RAW_MIN || raw.length > RAW_MAX) return { status: 'invalid' };

  const tokenHash = hashConsentToken(raw, env.server.CONSENT_TOKEN_SECRET);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('artisan_consent_tokens')
    .select(
      'expires_at, used_at, artisans ( slug, display_name_fr, display_name_ar, phone_e164, pending_display_name_fr, pending_phone_e164, state, deleted_at, created_by, artisan_tags ( tags ( key, label_fr, label_ar ) ) )',
    )
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data || !data.artisans) return { status: 'invalid' };

  const artisan = data.artisans as unknown as {
    slug: string;
    display_name_fr: string;
    display_name_ar: string | null;
    phone_e164: string;
    pending_display_name_fr: string | null;
    pending_phone_e164: string | null;
    state: ArtisanState;
    deleted_at: string | null;
    created_by: string | null;
    artisan_tags: { tags: EmbeddedTag | null }[] | null;
  };

  // P3 : artisan soft-deleted (par co-mod) entre SMS et consult → invalid
  // (cohérent avec AR38 : ne révèle pas l'état modération à l'artisan).
  if (artisan.deleted_at) return { status: 'invalid' };

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

  // P9 : récupération identity_mode du contributeur pour afficher la mention
  // pseudo/nommé (AC1). Aucun fail-stop : si le profil est manquant (RGPD
  // cascade), on retombe sur 'pseudo' (option la plus discrète).
  let contributorIdentityMode: IdentityMode = 'pseudo';
  if (artisan.created_by) {
    const { data: profile } = await admin
      .from('profiles')
      .select('identity_mode')
      .eq('user_id', artisan.created_by)
      .maybeSingle();
    if (profile?.identity_mode === 'identified') {
      contributorIdentityMode = 'identified';
    }
  }

  // Story 2.7 — diff PII si un re-consent draft est en cours (fiche published).
  const pendingName = artisan.pending_display_name_fr;
  const pendingPhone = artisan.pending_phone_e164;
  const nameChanged = pendingName != null && pendingName.trim() !== artisan.display_name_fr.trim();
  const phoneChanged =
    pendingPhone != null &&
    pendingPhone.replace(PHONE_NORMALIZE, '') !== artisan.phone_e164.replace(PHONE_NORMALIZE, '');
  const reconsent: ReconsentDiff | null =
    nameChanged || phoneChanged
      ? {
          name: nameChanged ? { from: artisan.display_name_fr, to: pendingName! } : null,
          phoneChanged,
        }
      : null;

  return { status: 'valid', displayName, tags, contributorIdentityMode, reconsent };
}
