// Feedback bêta 2026-07-22 — fusion admission_requests × users × profiles pour la
// liste « qui habite où ». `admission_requests` (state=accepted) définit QUI est
// dans le roster, mais tout ce qui est éditable vient de l'état COURANT :
//   - villa / tranche → `profiles` (modifiables dans /community/profil/parametres)
//   - nom             → `users.display_name` (idem)
// Fallback sur la photo d'admission quand la valeur courante manque (row profiles
// absente — bug connu, cf. migration 20260706090001 — ou nom jamais renseigné).
//
// 2026-07-26 : le nom a été ajouté à cette règle. Il restait figé sur le prénom
// de la demande d'admission, si bien qu'un résident ayant changé son nom
// apparaissait encore sous l'ancien dans la liste co_mod.

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
  /** Nom choisi par le résident ; null tant qu'il n'en a pas défini. */
  display_name: string | null;
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
    // Nom courant s'il existe et n'est pas blanc, sinon prénom de l'admission.
    const currentName = u.display_name?.trim();
    const list = byVilla.get(villa) ?? [];
    list.push({
      userId: a.user_id,
      firstName: currentName || a.first_name,
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
