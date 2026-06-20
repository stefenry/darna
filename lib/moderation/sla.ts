// Story 5.3 (NFR27) — SLA modération : un signalement ouvert doit être traité sous
// 24h de PRÉSENCE (heures 7h–23h). On compte les heures écoulées qui tombent dans
// la fenêtre quotidienne [07:00, 23:00) et on alerte au-delà de 24 heures-présence.
//
// Le calcul se fait en heure UTC (déterministe + testable). Raffinement fuseau
// Africa/Casablanca différé (le décalage ≤ 1h ne change pas la surface utile :
// surfacer les reports en retard). Borne d'itération : pas horaire, plafond 60j.

export const PRESENCE_START_HOUR = 7;
export const PRESENCE_END_HOUR = 23; // exclu
export const SLA_PRESENCE_HOURS = 24;
const MAX_ITERATIONS = 60 * 24; // garde-fou (60 jours d'heures)

/**
 * Nombre d'heures de présence (07h–23h UTC) écoulées entre `start` et `now`.
 * Approche par pas horaire : pour chaque heure entamée, compte la fraction
 * d'heure qui tombe dans la fenêtre de présence.
 */
export function presenceHoursElapsed(startMs: number, nowMs: number): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(nowMs) || nowMs <= startMs) return 0;
  let total = 0;
  let cursor = startMs;
  let iterations = 0;
  while (cursor < nowMs && iterations < MAX_ITERATIONS) {
    const d = new Date(cursor);
    const hour = d.getUTCHours();
    // Fin de l'heure courante (prochaine frontière horaire pile).
    const nextHourBoundary = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      hour + 1,
    );
    const segmentEnd = Math.min(nextHourBoundary, nowMs);
    if (hour >= PRESENCE_START_HOUR && hour < PRESENCE_END_HOUR) {
      total += (segmentEnd - cursor) / 3_600_000;
    }
    cursor = segmentEnd;
    iterations += 1;
  }
  return total;
}

/** True si le signalement ouvert dépasse le SLA de 24h-présence. */
export function isSlaBreached(createdAtIso: string, nowMs: number): boolean {
  const start = new Date(createdAtIso).getTime();
  if (Number.isNaN(start)) return false;
  return presenceHoursElapsed(start, nowMs) >= SLA_PRESENCE_HOURS;
}
