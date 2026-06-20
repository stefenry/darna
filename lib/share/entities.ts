// Story 6.1 — référentiel des entités partageables (URLs canoniques + deep link).
//
// Une « entité partageable » a : un segment d'URL canonique COURT et SANS locale
// (FR36, ADR 0003 — endpoints partageables hors `[locale]`), une table source, et
// un chemin communautaire authentifié (la vraie fiche, RLS-scopée) vers lequel on
// redirige un résident connecté. Les valeurs littérales (segments) sont stables :
// elles sont collées dans WhatsApp et ne doivent JAMAIS changer (liens éternels).

export const SHARE_KINDS = ['artisan', 'alert', 'tip', 'guide_entry'] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

export function isShareKind(v: string): v is ShareKind {
  return (SHARE_KINDS as readonly string[]).includes(v);
}

/** Segment de l'URL canonique courte, locale-less (`/artisan/<slug>`). Stable. */
export const CANONICAL_SEGMENT: Record<ShareKind, string> = {
  artisan: 'artisan',
  alert: 'alerte',
  tip: 'bon-plan',
  guide_entry: 'guide',
};

/** Segment de la route communautaire authentifiée (`/<locale>/community/<seg>/<slug>`). */
export const COMMUNITY_SEGMENT: Record<ShareKind, string> = {
  artisan: 'artisan',
  alert: 'alertes',
  tip: 'bons-plans',
  guide_entry: 'guide',
};

/** Table Postgres source (résolution slug → entité). */
export const ENTITY_TABLE: Record<ShareKind, 'artisans' | 'alerts' | 'tips' | 'guide_entries'> = {
  artisan: 'artisans',
  alert: 'alerts',
  tip: 'tips',
  guide_entry: 'guide_entries',
};

/** Clé i18n du type, pour les badges/teasers (`share.kind.<key>`). */
export const KIND_LABEL_KEY: Record<ShareKind, string> = {
  artisan: 'artisan',
  alert: 'alert',
  tip: 'tip',
  guide_entry: 'guide',
};
