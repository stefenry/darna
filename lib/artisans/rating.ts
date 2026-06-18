// Story 2.2 (AC1) — logique pure de notation typée 4 axes, partagée entre la
// carte annuaire (2 jauges « top axes ») et la fiche (4 jauges, story 2.3).
// Aucune I/O, aucun JSX → testable sans rendu.

export const RATING_AXES = ['depannage', 'petits-travaux', 'travail-soigne', 'urgences'] as const;

export type RatingAxis = (typeof RATING_AXES)[number];

export type AxisScore = {
  axis: RatingAxis;
  /** Moyenne 1-5, ou null si aucune voix sur cet axe (état « NA »). */
  average: number | null;
  /** Nombre de voix sur cet axe. */
  count: number;
};

/**
 * Forme des colonnes de la vue `artisan_rating_aggregates`.
 * PostgREST sérialise `numeric(3,2)` et `bigint` en **string** ; `unknown` ici
 * force tous les callers à passer par `toAxisScores` (qui coerce via Number).
 */
export type RatingAggregateRow = {
  avg_depannage: unknown;
  n_depannage: unknown;
  avg_petits_travaux: unknown;
  n_petits_travaux: unknown;
  avg_travail_soigne: unknown;
  n_travail_soigne: unknown;
  avg_urgences: unknown;
  n_urgences: unknown;
};

/**
 * Mapping `tag → 2 axes pertinents`. Utilisé pour les artisans sans aucun vote
 * (count_total = 0) afin d'afficher 2 jauges NA cohérentes avec le métier
 * plutôt que les 2 axes canoniques par défaut (qui mentaient sur la couverture
 * — review 2026-06-17 D4). Tags inconnus retombent sur les 2 axes canoniques.
 */
const TAG_TO_AXES: Record<string, readonly [RatingAxis, RatingAxis]> = {
  plomberie: ['depannage', 'urgences'],
  electricite: ['depannage', 'urgences'],
  peinture: ['petits-travaux', 'travail-soigne'],
  menuiserie: ['petits-travaux', 'travail-soigne'],
  carrelage: ['petits-travaux', 'travail-soigne'],
  climatisation: ['depannage', 'urgences'],
  jardinage: ['petits-travaux', 'travail-soigne'],
  serrurerie: ['depannage', 'urgences'],
};

/** Renvoie `null` si l'entrée n'est pas numériquement convertible (PostgREST string ou null). */
function coerceNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function coerceCount(v: unknown): number {
  const n = coerceNumber(v);
  return n == null || n < 0 ? 0 : Math.trunc(n);
}

/** Convertit une ligne d'agrégat (ou son absence) en 4 `AxisScore` ordonnés. */
export function toAxisScores(row: RatingAggregateRow | null | undefined): AxisScore[] {
  return [
    {
      axis: 'depannage',
      average: coerceNumber(row?.avg_depannage),
      count: coerceCount(row?.n_depannage),
    },
    {
      axis: 'petits-travaux',
      average: coerceNumber(row?.avg_petits_travaux),
      count: coerceCount(row?.n_petits_travaux),
    },
    {
      axis: 'travail-soigne',
      average: coerceNumber(row?.avg_travail_soigne),
      count: coerceCount(row?.n_travail_soigne),
    },
    {
      axis: 'urgences',
      average: coerceNumber(row?.avg_urgences),
      count: coerceCount(row?.n_urgences),
    },
  ];
}

/**
 * Sélectionne les `n` axes les plus pertinents pour la carte : tri par nombre
 * de voix décroissant, puis par moyenne décroissante.
 *
 * Cas spécial **artisan sans aucun vote** (`tagKey` fourni, count_total = 0) :
 * renvoie les 2 axes pertinents du métier (mapping `TAG_TO_AXES`) en état NA,
 * plutôt que les 2 axes canoniques (qui afficheraient toujours
 * « dépannage + petits-travaux » → mensonge de couverture, review 2026-06-17 D4).
 */
export function topAxes(scores: AxisScore[], n: number, tagKey?: string | null): AxisScore[] {
  const totalCount = scores.reduce((sum, s) => sum + s.count, 0);
  if (totalCount === 0 && tagKey && TAG_TO_AXES[tagKey]) {
    const preferred = TAG_TO_AXES[tagKey];
    const byAxis = new Map(scores.map((s) => [s.axis, s]));
    const picked = preferred.map((axis) => byAxis.get(axis)).filter((s): s is AxisScore => !!s);
    return picked.slice(0, n);
  }

  return [...scores]
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const avgA = a.average ?? -1;
      const avgB = b.average ?? -1;
      if (avgB !== avgA) return avgB - avgA;
      return RATING_AXES.indexOf(a.axis) - RATING_AXES.indexOf(b.axis);
    })
    .slice(0, n);
}
