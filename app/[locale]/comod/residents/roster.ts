// Feedback bêta 2026-07-22 — fusion admission_requests × users × profiles pour
// la liste « qui habite où ». `admission_requests` (state=accepted) reste le
// roster (chaque résident validé y est, first_name non éditable) mais
// villa/tranche viennent du profil COURANT quand la row `profiles` existe : le
// résident peut les modifier dans /community/profil/parametres et la liste
// co_mod doit suivre. Fallback admission si la row profile manque (bug
// profiles connu, cf. migration 20260706090001).

export type RosterAdmission = {
  user_id: string;
  villa: number;
  tranche: string | null;
  first_name: string;
  created_at: string;
};

export type RosterUser = {
  id: string;
  role: string;
  deleted_at: string | null;
};

export type RosterProfile = {
  user_id: string;
  villa: number;
  tranche: string | null;
};

export type Resident = {
  userId: string;
  firstName: string;
  tranche: string | null;
  isComod: boolean;
};

type Input = {
  /** Admissions acceptées, triées created_at DESC (la 1re par user gagne). */
  admissions: RosterAdmission[];
  users: RosterUser[];
  profiles: RosterProfile[];
  locale: string;
};

/** Villas triées numériquement → résidents triés par prénom (locale). */
export function buildVillaRoster({ admissions, users, profiles, locale }: Input) {
  const userMap = new Map(users.map((u) => [u.id, u]));
  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

  const seen = new Set<string>();
  const byVilla = new Map<number, Resident[]>();
  for (const a of admissions) {
    if (seen.has(a.user_id)) continue;
    const u = userMap.get(a.user_id);
    if (!u || u.deleted_at) continue; // compte supprimé / hors résidence
    seen.add(a.user_id);
    // Le profil courant (s'il existe) est autoritatif pour villa ET tranche —
    // y compris une tranche remise à null par le résident.
    const profile = profileMap.get(a.user_id);
    const villa = profile?.villa ?? a.villa;
    const tranche = profile ? profile.tranche : a.tranche;
    const list = byVilla.get(villa) ?? [];
    list.push({
      userId: a.user_id,
      firstName: a.first_name,
      tranche,
      isComod: u.role === 'co_mod',
    });
    byVilla.set(villa, list);
  }

  const sorted = new Map<number, Resident[]>();
  for (const villa of [...byVilla.keys()].sort((x, y) => x - y)) {
    sorted.set(
      villa,
      byVilla.get(villa)!.sort((p, q) => p.firstName.localeCompare(q.firstName, locale)),
    );
  }
  return sorted;
}
