// Story 1.10a (D7) — Validation centralisée des magic-links Supabase, dédupliquée
// depuis auth-signin / admission-submit / comod-actions. En production, seul
// `https:` est accepté (refuse un lien cleartext si NEXT_PUBLIC_SITE_URL=http://…) ;
// hors-prod, `http:` reste toléré (tunnel / staging local).
export function isSafeActionLink(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:') return true;
    if (parsed.protocol === 'http:') return process.env.NODE_ENV !== 'production';
    return false;
  } catch {
    return false;
  }
}
