// Story 4.x — config partagée du contenu éphémère (alertes & bons plans).
//
// Valeurs littérales (durées, catégories, clés de modèle) résolues i18n au render
// (NFR47, pas de display_name en DB). Centralise les constantes utilisées par les
// Server Actions (4.2/4.3), le feed (4.4) et le cron (4.5).

import type { Locale } from '@/lib/i18n/config';

// ── Durées d'alerte (FR27/FR28) ──────────────────────────────────────────────
export const ALERT_DURATIONS_HOURS = [24, 72, 168] as const;
export type AlertDurationHours = (typeof ALERT_DURATIONS_HOURS)[number];

export function isAlertDuration(n: number): n is AlertDurationHours {
  return (ALERT_DURATIONS_HOURS as readonly number[]).includes(n);
}

// ── Modèles d'alerte (FR27) — clés seedées en 20260630090100 ──────────────────
export const ALERT_TEMPLATE_KEYS = [
  'coupure_eau',
  'coupure_electricite',
  'desinsectisation',
  'chien_perdu',
  'objet_perdu',
  'colis_livre',
  'autre',
] as const;
export type AlertTemplateKey = (typeof ALERT_TEMPLATE_KEYS)[number];

export function isAlertTemplateKey(v: string): v is AlertTemplateKey {
  return (ALERT_TEMPLATE_KEYS as readonly string[]).includes(v);
}

// ── Catégories de bon plan (FR29) — enum tip_category ─────────────────────────
export const TIP_CATEGORY_KEYS = ['offre_voisin', 'pret_objet', 'evenement', 'autre'] as const;
export type TipCategoryKey = (typeof TIP_CATEGORY_KEYS)[number];

export function isTipCategoryKey(v: string): v is TipCategoryKey {
  return (TIP_CATEGORY_KEYS as readonly string[]).includes(v);
}

/** Plafond d'expiration d'un bon plan (FR29 « max 30 days »). */
export const TIP_MAX_EXPIRY_DAYS = 30;

// ── Temps restant avant expiration (4.4 « expire dans 18h ») ──────────────────
export type TimeRemaining =
  | { state: 'expired' }
  | { state: 'soon' }
  | { state: 'hours'; value: number }
  | { state: 'days'; value: number };

/**
 * État d'expiration pur (l'i18n est résolu par l'appelant). ≥48h → jours, arrondi
 * au jour le PLUS PROCHE (pas tronqué) pour ne pas sous-estimer le délai affiché
 * — « expire dans 3 jours » pour ~71h, pas « 2 jours ».
 */
export function timeRemaining(expiresAtIso: string, nowMs: number): TimeRemaining {
  const ms = new Date(expiresAtIso).getTime() - nowMs;
  if (ms <= 0) return { state: 'expired' };
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 48) return { state: 'days', value: Math.round(hours / 24) };
  if (hours >= 1) return { state: 'hours', value: hours };
  return { state: 'soon' };
}

/**
 * Sélection FR/AR avec fallback FR (FR48 — MVP FR-only, AR différé V1.5). Le
 * champ AR est rendu seulement s'il est non vide ; sinon on retombe sur FR.
 */
export function pickLocalized(
  locale: Locale,
  fr: string,
  ar: string | null | undefined,
): { value: string; untranslated: boolean } {
  if (locale === 'ar' && ar && ar.trim().length > 0) {
    return { value: ar, untranslated: false };
  }
  return { value: fr, untranslated: locale === 'ar' };
}
