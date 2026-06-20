// Story 5.2/5.3 — libellés FR partagés pour les e-mails de modération (MVP FR-only,
// comme la notif admission 1.7). Source unique réutilisée par report-submit (notif
// co_mod) et les actions de modération (notif auteur/reporter).

import type { ReportReason, ReportTargetType } from '@/lib/validation/report';
import type { RemovalMotive } from '@/lib/validation/moderation';

export const TARGET_LABELS_FR: Record<ReportTargetType, string> = {
  artisan: 'Fiche artisan',
  rating: 'Avis / commentaire',
  alert: 'Alerte',
  alert_comment: "Commentaire d'alerte",
  tip: 'Bon plan',
  guide_entry: 'Entrée du guide',
  useful_number: 'Numéro utile',
};

export const REASON_LABELS_FR: Record<ReportReason, string> = {
  diffamation: 'Diffamation',
  info_erronee: 'Info erronée',
  harcelement: 'Harcèlement',
  spam: 'Spam',
  hors_charte: 'Hors-charte',
  autre: 'Autre',
};

export const MOTIVE_LABELS_FR: Record<RemovalMotive, string> = {
  diffamation: 'Diffamation',
  info_erronee: 'Info erronée',
  hors_charte: 'Hors-charte',
  autre: 'Autre',
};
